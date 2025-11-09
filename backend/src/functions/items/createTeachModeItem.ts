import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT, validateHouseholdAccess } from '../../middleware/auth';
import { getItemRepository } from '../../repositories/itemRepository';
import { getTransactionRepository } from '../../repositories/transactionRepository';
import { 
  ApiError, 
  ErrorCode, 
  CreateItemDto, 
  PredictionConfidence, 
  Category, 
  Vendor, 
  IngestionSource,
  UnitOfMeasure
} from '../../types/shared';

/**
 * Teach Mode Quick Entry Endpoint
 * 
 * Purpose: Create item with immediate prediction from user-provided frequency.
 * This is the fast-track onboarding path where users manually enter items
 * they know they buy regularly.
 * 
 * Processing Logic:
 * 1. Validate input (canonicalName, lastPurchaseDate, frequency required)
 * 2. Check for duplicate items (case-insensitive canonicalName match)
 * 3. Create item with provided details
 * 4. Create synthetic transaction (sourceType='teach_mode')
 * 5. Calculate prediction from frequency (daily=1, weekly=7, biweekly=14, monthly=30)
 * 6. Update item with prediction (confidence='low' until 3+ purchases)
 * 7. Track analytics event
 * 
 * Frequency Mapping:
 * - daily: 1 day
 * - weekly: 7 days
 * - biweekly: 14 days
 * - monthly: 30 days
 * 
 * Initial Confidence: Always 'low' since only 1 purchase exists.
 * Confidence improves as more purchases are recorded.
 */

interface TeachModeRequest {
  householdId: string;
  userId: string;
  canonicalName: string;
  brand?: string;
  category?: string;
  lastPurchaseDate: string; // ISO 8601
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  emoji?: string;
}

interface TeachModeResponse {
  itemId: string;
  canonicalName: string;
  brand?: string;
  category?: string;
  predictedRunOutDate: string;
  predictionConfidence: PredictionConfidence;
  daysUntilRunOut: number;
  frequency: string;
  message: string;
}

const FREQUENCY_TO_DAYS: Record<TeachModeRequest['frequency'], number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30
};

/**
 * Validate teach mode request
 */
function validateRequest(data: any): { valid: boolean; error?: ApiError } {
  if (!data.householdId || typeof data.householdId !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'householdId is required and must be a string'
      }
    };
  }

  if (!data.userId || typeof data.userId !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'userId is required and must be a string'
      }
    };
  }

  if (!data.canonicalName || typeof data.canonicalName !== 'string' || data.canonicalName.trim().length === 0) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'canonicalName is required and cannot be empty'
      }
    };
  }

  if (data.canonicalName.length > 100) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'canonicalName cannot exceed 100 characters'
      }
    };
  }

  if (!data.lastPurchaseDate || typeof data.lastPurchaseDate !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'lastPurchaseDate is required and must be an ISO 8601 string'
      }
    };
  }

  // Validate date format
  const purchaseDate = new Date(data.lastPurchaseDate);
  if (isNaN(purchaseDate.getTime())) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'lastPurchaseDate must be a valid ISO 8601 date'
      }
    };
  }

  // Don't allow future dates
  if (purchaseDate > new Date()) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'lastPurchaseDate cannot be in the future'
      }
    };
  }

  // Don't allow dates older than 2 years
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  if (purchaseDate < twoYearsAgo) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'lastPurchaseDate cannot be older than 2 years'
      }
    };
  }

  if (!data.frequency || typeof data.frequency !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'frequency is required and must be one of: daily, weekly, biweekly, monthly'
      }
    };
  }

  const validFrequencies: string[] = ['daily', 'weekly', 'biweekly', 'monthly'];
  if (!validFrequencies.includes(data.frequency)) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'frequency must be one of: daily, weekly, biweekly, monthly'
      }
    };
  }

  // Optional fields validation
  if (data.brand && typeof data.brand !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'brand must be a string'
      }
    };
  }

  if (data.category && typeof data.category !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'category must be a string'
      }
    };
  }

  if (data.emoji && typeof data.emoji !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'emoji must be a string'
      }
    };
  }

  return { valid: true };
}

/**
 * Check for duplicate item (case-insensitive canonicalName match)
 */
async function checkDuplicate(
  householdId: string,
  canonicalName: string,
  context: InvocationContext
): Promise<{ isDuplicate: boolean; existingItemId?: string }> {
  try {
    const itemRepo = await getItemRepository();
    const existingItems = await itemRepo.getByHousehold(householdId, false);

    // Case-insensitive match on canonicalName
    const normalizedName = canonicalName.toLowerCase().trim();
    const duplicate = existingItems.find(
      (item) => item.canonicalName.toLowerCase().trim() === normalizedName
    );

    if (duplicate) {
      context.log(`Duplicate found: ${duplicate.canonicalName} (${duplicate.id})`);
      return { isDuplicate: true, existingItemId: duplicate.id };
    }

    return { isDuplicate: false };
  } catch (error) {
    context.error('Error checking for duplicates:', error);
    // If check fails, proceed anyway to avoid blocking user
    return { isDuplicate: false };
  }
}

/**
 * Calculate predicted run-out date from frequency
 */
function calculatePredictedDate(lastPurchaseDate: string, frequency: TeachModeRequest['frequency']): string {
  const lastPurchase = new Date(lastPurchaseDate);
  const frequencyDays = FREQUENCY_TO_DAYS[frequency];
  
  const predictedDate = new Date(lastPurchase);
  predictedDate.setDate(predictedDate.getDate() + frequencyDays);
  
  return predictedDate.toISOString();
}

/**
 * Calculate days until run-out
 */
function calculateDaysUntilRunOut(predictedDate: string): number {
  const now = new Date();
  const predicted = new Date(predictedDate);
  const diffMs = predicted.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * POST /api/items/teach-mode
 * Create item via Teach Mode (manual quick entry)
 */
async function createTeachModeItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('POST /api/items/teach-mode - Create teach mode item');

  try {
    // Validate JWT token
    const authContext = await validateJWT(request, context);
    if (!authContext) {
      return {
        status: 401,
        jsonBody: {
          code: ErrorCode.AUTH_INVALID,
          message: 'Invalid or missing authentication token'
        }
      };
    }
    
    // Parse request body
    const body = await request.json() as any;
    
    // Use user's household and ID from auth context (do NOT trust request body)
    const householdId = authContext.householdIds[0];
    const userId = authContext.userId;
    
    // Validate household access
    if (!await validateHouseholdAccess(authContext, householdId, context)) {
      return {
        status: 403,
        jsonBody: {
          code: ErrorCode.FORBIDDEN,
          message: 'Access denied to household'
        }
      };
    }
    
    // Validate request
    const validation = validateRequest({ ...body, householdId, userId });
    if (!validation.valid) {
      return {
        status: 400,
        jsonBody: validation.error
      };
    }

    const requestData: TeachModeRequest = { ...body, householdId, userId };

    // Check for duplicate items
    const duplicateCheck = await checkDuplicate(
      householdId,
      requestData.canonicalName,
      context
    );

    if (duplicateCheck.isDuplicate) {
      return {
        status: 409,
        jsonBody: {
          code: ErrorCode.DUPLICATE_ITEM,
          message: `Item "${requestData.canonicalName}" already exists in your inventory`,
          existingItemId: duplicateCheck.existingItemId
        }
      };
    }

    // Calculate predicted run-out date
    const predictedRunOutDate = calculatePredictedDate(
      requestData.lastPurchaseDate,
      requestData.frequency
    );
    const daysUntilRunOut = calculateDaysUntilRunOut(predictedRunOutDate);

    // Create item with teach mode defaults
    const itemRepo = await getItemRepository();
    const createItemDto: CreateItemDto = {
      canonicalName: requestData.canonicalName.trim(),
      brand: requestData.brand?.trim(),
      category: requestData.category ? (requestData.category as Category) : Category.OTHER,
      quantity: 1,
      unitOfMeasure: UnitOfMeasure.EACH,
      packageSize: 1,
      packageUnit: UnitOfMeasure.EACH,
      preferredVendor: Vendor.OTHER,
      teachModeEnabled: true,
      teachModeFrequencyDays: FREQUENCY_TO_DAYS[requestData.frequency]
    };

    const item = await itemRepo.create(
      requestData.householdId,
      requestData.userId,
      createItemDto
    );

    context.log(`Created item: ${item.id} (${item.canonicalName})`);

    // Create synthetic transaction
    const transactionRepo = await getTransactionRepository();
    await transactionRepo.create(requestData.householdId, requestData.userId, {
      itemId: item.id,
      quantity: 1,
      totalPrice: 0,
      purchaseDate: requestData.lastPurchaseDate,
      vendor: Vendor.OTHER,
      source: IngestionSource.TEACH_MODE,
      sourceMetadata: {
        rawText: `Teach Mode: ${item.canonicalName}`,
        confidence: 1.0,
        restockAction: false
      }
    });

    context.log(`Created synthetic transaction for teach mode item: ${item.id}`);

    // Update item with prediction
    await itemRepo.updatePrediction(
      item.id,
      requestData.householdId,
      {
        predictedRunOutDate,
        predictionConfidence: PredictionConfidence.LOW, // Always low for single purchase
        avgFrequencyDays: FREQUENCY_TO_DAYS[requestData.frequency],
        avgConsumptionRate: 0 // Not applicable for teach mode (unknown)
      }
    );

    context.log(`Updated item ${item.id} with prediction`);

    // Track analytics event (in production, this would go to Application Insights or events container)
    context.log('Analytics event: teach_mode_item_created', {
      itemId: item.id,
      householdId: requestData.householdId,
      userId: requestData.userId,
      canonicalName: item.canonicalName,
      frequency: requestData.frequency,
      frequencyDays: FREQUENCY_TO_DAYS[requestData.frequency],
      predictedRunOutDate,
      daysUntilRunOut,
      predictionConfidence: PredictionConfidence.LOW
    });

    // Build response
    const response: TeachModeResponse = {
      itemId: item.id,
      canonicalName: item.canonicalName,
      brand: item.brand,
      category: item.category,
      predictedRunOutDate,
      predictionConfidence: PredictionConfidence.LOW,
      daysUntilRunOut,
      frequency: requestData.frequency,
      message: `${item.canonicalName} added! Confidence will improve as you record more purchases.`
    };

    return {
      status: 201,
      jsonBody: response
    };

  } catch (error) {
    context.error('Error creating teach mode item:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as ApiError;
      return {
        status: apiError.code === ErrorCode.DUPLICATE_ITEM ? 409 : 400,
        jsonBody: apiError
      };
    }

    return {
      status: 500,
      jsonBody: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to create teach mode item'
      }
    };
  }
}

// Register HTTP trigger
app.http('createTeachModeItem', {
  methods: ['POST'],
  route: 'items/teach-mode',
  authLevel: 'function',
  handler: createTeachModeItem
});
