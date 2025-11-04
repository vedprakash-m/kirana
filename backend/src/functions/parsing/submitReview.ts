/**
 * Micro-Review Submission Function
 * 
 * Handles user review actions on parsed items:
 * - accept: Use parsed data as-is
 * - edit: Apply user corrections
 * - reject: Discard item (log only)
 * 
 * Smart Merge Logic (same as CSV parser):
 * 1. SKU cache lookup (if available)
 * 2. canonicalName + brand (case-insensitive, exact match)
 * 3. canonicalName only (case-insensitive, potential match)
 * 
 * On accept/edit:
 * - If shouldMerge=true → create transaction for existing item
 * - If shouldMerge=false → create new item + transaction
 * 
 * Cache updates:
 * - High-confidence items (≥0.9) cached
 * - User edits (confidence 1.0) cached
 * 
 * Analytics:
 * - All actions logged to events container (TTL 90 days)
 * - Includes: original parsing, corrections, merge decision, time spent
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getItemRepository } from '../../repositories/itemRepository';
import { getTransactionRepository } from '../../repositories/transactionRepository';
import { getNormalizationCache } from '../../services/normalizationCache';
import { getCosmosDbService } from '../../services/cosmosDbService';
import {
  CreateItemDto,
  CreateTransactionDto,
  ParsedItem,
  ErrorCode,
  ApiResponse
} from '../../types/shared';

/**
 * Review action type
 */
type ReviewAction = 'accept' | 'edit' | 'reject';

/**
 * Review submission request
 */
interface SubmitReviewRequest {
  householdId: string;
  userId: string;
  action: ReviewAction;
  parsedItem: ParsedItem;
  corrections?: Partial<ParsedItem>; // For 'edit' action
  timeSpentMs?: number; // Time user spent reviewing
}

/**
 * Review submission response
 */
interface SubmitReviewResponse {
  itemId?: string;
  transactionId?: string;
  merged: boolean;
  mergeReason?: string;
  action: ReviewAction;
  remainingReviews: number;
}

/**
 * Merge result
 */
interface MergeResult {
  shouldMerge: boolean;
  existingItemId?: string;
  mergeReason?: string;
}

/**
 * Analytics event
 */
interface AnalyticsEvent {
  id: string;
  householdId: string;
  userId: string;
  type: 'item_corrected' | 'item_rejected' | 'item_accepted';
  timestamp: string;
  data: {
    originalParsing: ParsedItem;
    corrections?: Partial<ParsedItem>;
    mergeDecision?: MergeResult;
    action: ReviewAction;
    timeSpentMs?: number;
  };
  ttl: number; // 90 days
}

/**
 * Smart Merge: Check for existing items
 * 
 * Hierarchy:
 * 1. canonicalName + brand (case-insensitive, exact match)
 * 2. canonicalName only (case-insensitive, potential match)
 */
async function checkForExistingItem(
  canonicalName: string,
  brand: string | undefined,
  householdId: string
): Promise<MergeResult> {
  const itemRepo = await getItemRepository();
  const existingItems = await itemRepo.getByHousehold(householdId);
  
  const canonicalLower = canonicalName.toLowerCase();
  const brandLower = brand?.toLowerCase();
  
  // Check for exact match: canonicalName + brand
  if (brand) {
    const exactMatch = existingItems.find(item =>
      item.canonicalName.toLowerCase() === canonicalLower &&
      item.brand?.toLowerCase() === brandLower
    );
    
    if (exactMatch) {
      return {
        shouldMerge: true,
        existingItemId: exactMatch.id,
        mergeReason: `Exact match: "${exactMatch.canonicalName}" (${exactMatch.brand})`
      };
    }
  }
  
  // Check for potential match: canonicalName only
  const potentialMatch = existingItems.find(item =>
    item.canonicalName.toLowerCase() === canonicalLower
  );
  
  if (potentialMatch) {
    // Different brands → auto-merge (user already reviewed)
    return {
      shouldMerge: true,
      existingItemId: potentialMatch.id,
      mergeReason: `Name match: "${potentialMatch.canonicalName}" (merged after user review)`
    };
  }
  
  return { shouldMerge: false };
}

/**
 * Handle accept action
 */
async function handleAccept(
  request: SubmitReviewRequest
): Promise<SubmitReviewResponse> {
  const { householdId, userId, parsedItem } = request;
  
  // Check for existing item (Smart Merge)
  const mergeResult = await checkForExistingItem(
    parsedItem.canonicalName!,
    parsedItem.brand,
    householdId
  );
  
  if (mergeResult.shouldMerge && mergeResult.existingItemId) {
    // Merge: Create transaction for existing item
    const transactionRepo = await getTransactionRepository();
    
    const transactionDto: CreateTransactionDto = {
      itemId: mergeResult.existingItemId,
      purchaseDate: parsedItem.purchaseDate || new Date().toISOString(),
      quantity: parsedItem.quantity || 1,
      totalPrice: parsedItem.price || 0,
      vendor: parsedItem.vendor || 'Other' as any,
      source: 'manual' as any,
      sourceMetadata: {
        rawText: parsedItem.rawText,
        confidence: parsedItem.confidence
      }
    };
    
    const transaction = await transactionRepo.create(
      householdId,
      userId,
      transactionDto
    );
    
    // Update cache (high confidence)
    if (parsedItem.confidence >= 0.9) {
      const cache = await getNormalizationCache();
      await cache.set(parsedItem.rawText, parsedItem.vendor?.toLowerCase() || 'unknown', {
        canonicalName: parsedItem.canonicalName!,
        brand: parsedItem.brand,
        category: parsedItem.category!,
        quantity: parsedItem.quantity || 1,
        unitOfMeasure: parsedItem.unitOfMeasure!,
        packageSize: parsedItem.packageSize || 1,
        packageUnit: parsedItem.packageUnit!,
        confidence: parsedItem.confidence
      });
    }
    
    return {
      itemId: mergeResult.existingItemId,
      transactionId: transaction.id,
      merged: true,
      mergeReason: mergeResult.mergeReason,
      action: 'accept',
      remainingReviews: 0 // TODO: Query actual count
    };
  } else {
    // New item: Create item + transaction
    const itemRepo = await getItemRepository();
    const transactionRepo = await getTransactionRepository();
    
    const itemDto: CreateItemDto = {
      canonicalName: parsedItem.canonicalName!,
      brand: parsedItem.brand,
      category: parsedItem.category!,
      quantity: parsedItem.quantity || 1,
      unitOfMeasure: parsedItem.unitOfMeasure!,
      packageSize: parsedItem.packageSize || 1,
      packageUnit: parsedItem.packageUnit!,
      preferredVendor: parsedItem.vendor,
      teachModeEnabled: false
    };
    
    const item = await itemRepo.create(householdId, userId, itemDto);
    
    const transactionDto: CreateTransactionDto = {
      itemId: item.id,
      purchaseDate: parsedItem.purchaseDate || new Date().toISOString(),
      quantity: parsedItem.quantity || 1,
      totalPrice: parsedItem.price || 0,
      vendor: parsedItem.vendor || 'Other' as any,
      source: 'manual' as any,
      sourceMetadata: {
        rawText: parsedItem.rawText,
        confidence: parsedItem.confidence
      }
    };
    
    const transaction = await transactionRepo.create(
      householdId,
      userId,
      transactionDto
    );
    
    // Update cache (high confidence)
    if (parsedItem.confidence >= 0.9) {
      const cache = await getNormalizationCache();
      await cache.set(parsedItem.rawText, parsedItem.vendor?.toLowerCase() || 'unknown', {
        canonicalName: parsedItem.canonicalName!,
        brand: parsedItem.brand,
        category: parsedItem.category!,
        quantity: parsedItem.quantity || 1,
        unitOfMeasure: parsedItem.unitOfMeasure!,
        packageSize: parsedItem.packageSize || 1,
        packageUnit: parsedItem.packageUnit!,
        confidence: parsedItem.confidence
      });
    }
    
    return {
      itemId: item.id,
      transactionId: transaction.id,
      merged: false,
      action: 'accept',
      remainingReviews: 0 // TODO: Query actual count
    };
  }
}

/**
 * Handle edit action
 */
async function handleEdit(
  request: SubmitReviewRequest
): Promise<SubmitReviewResponse> {
  const { householdId, userId, parsedItem, corrections } = request;
  
  if (!corrections) {
    throw new Error('Corrections are required for edit action');
  }
  
  // Apply corrections
  const correctedItem: ParsedItem = {
    ...parsedItem,
    ...corrections,
    confidence: 1.0, // User corrections = 100% confidence
    userReviewed: true
  };
  
  // Check for existing item (Smart Merge)
  const mergeResult = await checkForExistingItem(
    correctedItem.canonicalName!,
    correctedItem.brand,
    householdId
  );
  
  if (mergeResult.shouldMerge && mergeResult.existingItemId) {
    // Merge: Create transaction for existing item
    const transactionRepo = await getTransactionRepository();
    
    const transactionDto: CreateTransactionDto = {
      itemId: mergeResult.existingItemId,
      purchaseDate: correctedItem.purchaseDate || new Date().toISOString(),
      quantity: correctedItem.quantity || 1,
      totalPrice: correctedItem.price || 0,
      vendor: correctedItem.vendor || 'Other' as any,
      source: 'manual' as any,
      sourceMetadata: {
        rawText: parsedItem.rawText,
        confidence: 1.0,
        notes: `Corrected and merged: ${mergeResult.mergeReason}`
      }
    };
    
    const transaction = await transactionRepo.create(
      householdId,
      userId,
      transactionDto
    );
    
    // Always cache user corrections (confidence 1.0)
    const cache = await getNormalizationCache();
    await cache.set(parsedItem.rawText, parsedItem.vendor?.toLowerCase() || 'unknown', {
      canonicalName: correctedItem.canonicalName!,
      brand: correctedItem.brand,
      category: correctedItem.category!,
      quantity: correctedItem.quantity || 1,
      unitOfMeasure: correctedItem.unitOfMeasure!,
      packageSize: correctedItem.packageSize || 1,
      packageUnit: correctedItem.packageUnit!,
      confidence: 1.0
    });
    
    return {
      itemId: mergeResult.existingItemId,
      transactionId: transaction.id,
      merged: true,
      mergeReason: mergeResult.mergeReason,
      action: 'edit',
      remainingReviews: 0
    };
  } else {
    // New item: Create item + transaction
    const itemRepo = await getItemRepository();
    const transactionRepo = await getTransactionRepository();
    
    const itemDto: CreateItemDto = {
      canonicalName: correctedItem.canonicalName!,
      brand: correctedItem.brand,
      category: correctedItem.category!,
      quantity: correctedItem.quantity || 1,
      unitOfMeasure: correctedItem.unitOfMeasure!,
      packageSize: correctedItem.packageSize || 1,
      packageUnit: correctedItem.packageUnit!,
      preferredVendor: correctedItem.vendor,
      teachModeEnabled: false
    };
    
    const item = await itemRepo.create(householdId, userId, itemDto);
    
    const transactionDto: CreateTransactionDto = {
      itemId: item.id,
      purchaseDate: correctedItem.purchaseDate || new Date().toISOString(),
      quantity: correctedItem.quantity || 1,
      totalPrice: correctedItem.price || 0,
      vendor: correctedItem.vendor || 'Other' as any,
      source: 'manual' as any,
      sourceMetadata: {
        rawText: parsedItem.rawText,
        confidence: 1.0,
        notes: 'User corrected'
      }
    };
    
    const transaction = await transactionRepo.create(
      householdId,
      userId,
      transactionDto
    );
    
    // Always cache user corrections (confidence 1.0)
    const cache = await getNormalizationCache();
    await cache.set(parsedItem.rawText, parsedItem.vendor?.toLowerCase() || 'unknown', {
      canonicalName: correctedItem.canonicalName!,
      brand: correctedItem.brand,
      category: correctedItem.category!,
      quantity: correctedItem.quantity || 1,
      unitOfMeasure: correctedItem.unitOfMeasure!,
      packageSize: correctedItem.packageSize || 1,
      packageUnit: correctedItem.packageUnit!,
      confidence: 1.0
    });
    
    return {
      itemId: item.id,
      transactionId: transaction.id,
      merged: false,
      action: 'edit',
      remainingReviews: 0
    };
  }
}

/**
 * Handle reject action
 */
async function handleReject(): Promise<SubmitReviewResponse> {
  // Just log rejection (no item/transaction created)
  return {
    merged: false,
    action: 'reject',
    remainingReviews: 0 // TODO: Query actual count
  };
}

/**
 * Log analytics event
 */
async function logAnalytics(
  request: SubmitReviewRequest,
  result: SubmitReviewResponse
): Promise<void> {
  try {
    const cosmosService = await getCosmosDbService();
    const eventsContainer = cosmosService.getEventsContainer();
    
    const eventType = request.action === 'accept' 
      ? 'item_accepted' 
      : request.action === 'edit'
      ? 'item_corrected'
      : 'item_rejected';
    
    const event: AnalyticsEvent = {
      id: uuidv4(),
      householdId: request.householdId,
      userId: request.userId,
      type: eventType as any,
      timestamp: new Date().toISOString(),
      data: {
        originalParsing: request.parsedItem,
        corrections: request.corrections,
        mergeDecision: result.merged ? {
          shouldMerge: result.merged,
          mergeReason: result.mergeReason
        } : undefined,
        action: request.action,
        timeSpentMs: request.timeSpentMs
      },
      ttl: 90 * 24 * 60 * 60 // 90 days
    };
    
    await eventsContainer.items.create(event);
    console.log(`📊 Analytics logged: ${eventType} (time: ${request.timeSpentMs}ms)`);
  } catch (error) {
    console.error('Failed to log analytics:', error);
    // Don't throw - analytics failure shouldn't block the request
  }
}

/**
 * Azure Function: Submit Review
 * 
 * POST /api/parsing/submitReview
 * Body: SubmitReviewRequest
 * Response: SubmitReviewResponse
 */
async function submitReview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = await request.json() as SubmitReviewRequest;
    
    // Validate input
    if (!body.householdId || !body.userId || !body.action || !body.parsedItem) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'householdId, userId, action, and parsedItem are required'
          }
        } as ApiResponse<never>
      };
    }
    
    if (!['accept', 'edit', 'reject'].includes(body.action)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'action must be one of: accept, edit, reject'
          }
        } as ApiResponse<never>
      };
    }
    
    if (body.action === 'edit' && !body.corrections) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'corrections are required for edit action'
          }
        } as ApiResponse<never>
      };
    }
    
    // Handle action
    let result: SubmitReviewResponse;
    
    switch (body.action) {
      case 'accept':
        result = await handleAccept(body);
        break;
      case 'edit':
        result = await handleEdit(body);
        break;
      case 'reject':
        result = await handleReject();
        break;
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }
    
    // Log analytics
    await logAnalytics(body, result);
    
    context.log(`✅ Review submitted: ${body.action} (merged: ${result.merged})`);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: result
      } as ApiResponse<SubmitReviewResponse>
    };
    
  } catch (error: any) {
    context.error('Review submission error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: `Failed to submit review: ${error.message}`
        }
      } as ApiResponse<never>
    };
  }
}

// Register Azure Function
app.http('parsing-submit-review', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'parsing/submitReview',
  handler: submitReview
});
