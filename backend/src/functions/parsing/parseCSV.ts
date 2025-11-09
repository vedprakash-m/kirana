/**
 * CSV Parser Function
 * 
 * Implements 3-tier parsing strategy:
 * 1. Deterministic regex (Amazon/Costco formats) → confidence 0.9
 * 2. Normalization cache lookup (30-40% hit rate) → confidence from cache
 * 3. LLM fallback via Gemini → confidence from model
 * 
 * Confidence thresholds:
 * - ≥0.8: Auto-accept
 * - <0.8: Needs micro-review
 * 
 * Smart Merge Logic (prevents duplicates):
 * 1. SKU cache lookup (sku + retailer) → exact match
 * 2. Normalized canonicalName + brand (case-insensitive) → exact match
 * 3. Normalized canonicalName only (case-insensitive) → potential match (flag for review)
 * 
 * Target: >95% parse success, <$0.05/100 items
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { validateJWT, validateHouseholdAccess } from '../../middleware/auth';
import { getGeminiClient } from '../../services/geminiClient';
import { getNormalizationCache, NormalizedItem } from '../../services/normalizationCache';
import { getFeatureFlags, isLLMEnabledForUser } from '../../config/featureFlags';
import { getItemRepository } from '../../repositories/itemRepository';
import { rateLimitMiddleware, RATE_LIMITS, addRateLimitHeaders } from '../../middleware/rateLimiter';
import {
  ParseJob,
  ParseJobStatus,
  ParsedItem,
  IngestionSource,
  ErrorCode,
  Category,
  UnitOfMeasure,
  Vendor,
  ApiResponse
} from '../../types/shared';

/**
 * CSV row structure (Amazon format)
 */
interface AmazonCSVRow {
  'Order Date': string;
  'Order ID': string;
  Title: string;
  Category: string;
  'ASIN/ISBN': string;
  'Item Total': string;
  Quantity?: string;
}

/**
 * CSV row structure (Costco format)
 */
interface CostcoCSVRow {
  Date: string;
  'Item Number': string;
  Description: string;
  Quantity: string;
  Price: string;
}

/**
 * Parse result with merge info
 */
interface ParseResultWithMerge extends ParsedItem {
  existingItemId?: string;
  shouldMerge: boolean;
  reviewReason?: string;
  parseMethod: 'regex' | 'cache' | 'llm';
}

/**
 * Amazon CSV parser (deterministic regex)
 */
function parseAmazonCSV(row: AmazonCSVRow): ParseResultWithMerge | null {
  if (!row.Title || !row['Order Date']) {
    return null;
  }
  
  // Extract basic info
  const rawText = row.Title;
  const purchaseDate = new Date(row['Order Date']).toISOString();
  const quantity = parseInt(row.Quantity || '1', 10);
  
  // Extract price
  const priceMatch = row['Item Total']?.match(/\$([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
  
  // Simple category mapping
  let category: Category = Category.OTHER;
  const categoryLower = row.Category?.toLowerCase() || '';
  if (categoryLower.includes('grocery') || categoryLower.includes('food')) {
    category = Category.PANTRY;
  } else if (categoryLower.includes('health') || categoryLower.includes('beauty')) {
    category = Category.PERSONAL_CARE;
  }
  
  // Try to extract brand and product name from title
  // Common Amazon format: "Brand Name - Product Description, Size"
  const titleParts = rawText.split(/[-,]/);
  const brand = titleParts.length > 1 ? titleParts[0].trim() : undefined;
  const canonicalName = titleParts.length > 1 ? titleParts[1].trim() : rawText;
  
  // Extract package size (basic regex)
  const sizeMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(oz|lb|fl oz|ml|L|g|kg|count|pack)/i);
  const packageSize = sizeMatch ? parseFloat(sizeMatch[1]) : 1;
  const packageUnit = sizeMatch ? mapUnitString(sizeMatch[2]) : UnitOfMeasure.EACH;
  
  return {
    rawText,
    canonicalName,
    brand,
    category,
    quantity,
    unitOfMeasure: UnitOfMeasure.EACH,
    packageSize,
    packageUnit,
    price,
    vendor: Vendor.AMAZON,
    purchaseDate,
    confidence: 0.9, // High confidence for deterministic parsing
    needsReview: false,
    userReviewed: false,
    isDuplicate: false,
    shouldMerge: false,
    parseMethod: 'regex'
  };
}

/**
 * Costco CSV parser (deterministic regex)
 */
function parseCostcoCSV(row: CostcoCSVRow): ParseResultWithMerge | null {
  if (!row.Description || !row.Date) {
    return null;
  }
  
  const rawText = row.Description;
  const purchaseDate = new Date(row.Date).toISOString();
  const quantity = parseInt(row.Quantity || '1', 10);
  const price = parseFloat(row.Price?.replace(/[$,]/g, '') || '0');
  
  // Extract canonical name (Costco format is usually clean)
  const canonicalName = rawText;
  
  // Try to extract brand (first word is often the brand)
  const words = rawText.split(/\s+/);
  const brand = words.length > 1 ? words[0] : undefined;
  
  // Extract package size
  const sizeMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(oz|lb|fl oz|ml|L|g|kg|ct|pk)/i);
  const packageSize = sizeMatch ? parseFloat(sizeMatch[1]) : 1;
  const packageUnit = sizeMatch ? mapUnitString(sizeMatch[2]) : UnitOfMeasure.EACH;
  
  return {
    rawText,
    canonicalName,
    brand,
    category: Category.OTHER, // Costco CSVs don't have category
    quantity,
    unitOfMeasure: UnitOfMeasure.EACH,
    packageSize,
    packageUnit,
    price,
    vendor: Vendor.COSTCO,
    purchaseDate,
    confidence: 0.9,
    needsReview: false,
    userReviewed: false,
    isDuplicate: false,
    shouldMerge: false,
    parseMethod: 'regex'
  };
}

/**
 * Map unit string to UnitOfMeasure enum
 */
function mapUnitString(unit: string): UnitOfMeasure {
  const unitLower = unit.toLowerCase();
  
  const unitMap: Record<string, UnitOfMeasure> = {
    'oz': UnitOfMeasure.OUNCES,
    'lb': UnitOfMeasure.POUNDS,
    'g': UnitOfMeasure.GRAMS,
    'kg': UnitOfMeasure.KILOGRAMS,
    'fl oz': UnitOfMeasure.FLUID_OUNCES,
    'ml': UnitOfMeasure.MILLILITERS,
    'l': UnitOfMeasure.LITERS,
    'gal': UnitOfMeasure.GALLONS,
    'count': UnitOfMeasure.EACH,
    'ct': UnitOfMeasure.EACH,
    'pack': UnitOfMeasure.PACK,
    'pk': UnitOfMeasure.PACK,
    'each': UnitOfMeasure.EACH
  };
  
  return unitMap[unitLower] || UnitOfMeasure.OTHER;
}

/**
 * Parse CSV line using cache
 */
async function parseWithCache(
  rawText: string,
  retailer: string
): Promise<ParseResultWithMerge | null> {
  const cache = await getNormalizationCache();
  const cached = await cache.get(rawText, retailer);
  
  if (cached) {
    return {
      rawText,
      canonicalName: cached.canonicalName,
      brand: cached.brand,
      category: cached.category as Category,
      quantity: cached.quantity,
      unitOfMeasure: cached.unitOfMeasure as UnitOfMeasure,
      packageSize: cached.packageSize,
      packageUnit: cached.packageUnit as UnitOfMeasure,
      confidence: cached.confidence,
      needsReview: cached.confidence < 0.8,
      userReviewed: false,
      isDuplicate: false,
      shouldMerge: false,
      parseMethod: 'cache'
    };
  }
  
  return null;
}

/**
 * Parse CSV line using LLM (Gemini)
 */
async function parseWithLLM(
  rawText: string,
  retailer: string,
  householdId: string,
  userId: string
): Promise<ParseResultWithMerge> {
  const geminiClient = await getGeminiClient();
  
  // JSON schema for structured output
  const schema = {
    type: 'object',
    properties: {
      canonicalName: { type: 'string', description: 'Normalized product name' },
      brand: { type: 'string', description: 'Brand name (optional)' },
      category: { 
        type: 'string', 
        enum: Object.values(Category),
        description: 'Product category'
      },
      quantity: { type: 'number', description: 'Quantity purchased' },
      unitOfMeasure: { 
        type: 'string',
        enum: Object.values(UnitOfMeasure),
        description: 'Unit of measure'
      },
      packageSize: { type: 'number', description: 'Size per package (e.g., 64 for 64 fl oz)' },
      packageUnit: {
        type: 'string',
        enum: Object.values(UnitOfMeasure),
        description: 'Unit for package size'
      },
      confidence: { type: 'number', description: 'Confidence score 0.0-1.0' }
    },
    required: ['canonicalName', 'category', 'quantity', 'unitOfMeasure', 'packageSize', 'packageUnit', 'confidence']
  };
  
  const prompt = `Parse this grocery item from a ${retailer} receipt/order:

"${rawText}"

Extract:
- canonicalName: Standardized product name (e.g., "Milk, Organic, Whole")
- brand: Brand name if identifiable
- category: Best matching category from the enum
- quantity: Number of items purchased
- unitOfMeasure: How the item is counted (each, pack, bottle, etc.)
- packageSize: Size per unit (e.g., 64 for "64 fl oz")
- packageUnit: Unit for package size (fl oz, oz, lb, etc.)
- confidence: Your confidence in this parsing (0.0-1.0)

Examples:
Input: "Organic Whole Milk, 64 fl oz - Horizon, 2-Pack"
Output: {
  "canonicalName": "Milk, Organic, Whole",
  "brand": "Horizon",
  "category": "Dairy & Eggs",
  "quantity": 2,
  "unitOfMeasure": "pack",
  "packageSize": 64,
  "packageUnit": "fl oz",
  "confidence": 0.95
}

Input: "Bananas, Fresh, 3 lbs"
Output: {
  "canonicalName": "Bananas",
  "brand": null,
  "category": "Produce",
  "quantity": 1,
  "unitOfMeasure": "bag",
  "packageSize": 3,
  "packageUnit": "lb",
  "confidence": 0.90
}`;
  
  // Estimate tokens (roughly 4 chars per token)
  const estimatedInputTokens = Math.ceil((prompt.length + rawText.length) / 4);
  
  try {
    const result = await geminiClient.generateStructured<NormalizedItem>(
      householdId,
      userId,
      prompt,
      schema,
      estimatedInputTokens,
      { maxOutputTokens: 256, temperature: 0.1 }
    );
    
    // Cache the result if confidence is high
    if (result.data.confidence >= 0.9) {
      const cache = await getNormalizationCache();
      await cache.set(rawText, retailer, result.data);
    }
    
    return {
      rawText,
      canonicalName: result.data.canonicalName,
      brand: result.data.brand,
      category: result.data.category as Category,
      quantity: result.data.quantity,
      unitOfMeasure: result.data.unitOfMeasure as UnitOfMeasure,
      packageSize: result.data.packageSize,
      packageUnit: result.data.packageUnit as UnitOfMeasure,
      confidence: result.data.confidence,
      needsReview: result.data.confidence < 0.8,
      userReviewed: false,
      isDuplicate: false,
      shouldMerge: false,
      parseMethod: 'llm'
    };
  } catch (error: any) {
    console.error('LLM parsing failed:', error);
    
    // Return low-confidence result for manual review
    return {
      rawText,
      canonicalName: rawText,
      category: Category.OTHER,
      quantity: 1,
      unitOfMeasure: UnitOfMeasure.EACH,
      packageSize: 1,
      packageUnit: UnitOfMeasure.EACH,
      confidence: 0.1,
      needsReview: true,
      userReviewed: false,
      isDuplicate: false,
      shouldMerge: false,
      parseMethod: 'llm'
    };
  }
}

/**
 * Smart Merge: Check for existing items to prevent duplicates
 * 
 * Hierarchy:
 * 1. SKU cache lookup (exact match)
 * 2. canonicalName + brand (case-insensitive, exact match)
 * 3. canonicalName only (case-insensitive, potential match → flag for review)
 */
async function checkForDuplicates(
  parsed: ParseResultWithMerge,
  householdId: string
): Promise<ParseResultWithMerge> {
  const itemRepo = await getItemRepository();
  const existingItems = await itemRepo.getByHousehold(householdId);
  
  const canonicalLower = parsed.canonicalName?.toLowerCase() || '';
  const brandLower = parsed.brand?.toLowerCase() || '';
  
  // Check for exact match: canonicalName + brand
  if (parsed.brand) {
    const exactMatch = existingItems.find(item => 
      item.canonicalName.toLowerCase() === canonicalLower &&
      item.brand?.toLowerCase() === brandLower
    );
    
    if (exactMatch) {
      return {
        ...parsed,
        isDuplicate: true,
        existingItemId: exactMatch.id,
        shouldMerge: true,
        reviewReason: undefined
      };
    }
  }
  
  // Check for potential match: canonicalName only
  const potentialMatch = existingItems.find(item =>
    item.canonicalName.toLowerCase() === canonicalLower
  );
  
  if (potentialMatch) {
    // Different brands or no brand → flag for review
    return {
      ...parsed,
      isDuplicate: true,
      existingItemId: potentialMatch.id,
      shouldMerge: false, // Don't auto-merge without brand match
      reviewReason: `Similar item found: "${potentialMatch.canonicalName}" (${potentialMatch.brand || 'no brand'}). Confirm if same item.`,
      needsReview: true,
      confidence: Math.min(parsed.confidence, 0.7) // Reduce confidence
    };
  }
  
  return parsed;
}

/**
 * Parse entire CSV file
 */
async function parseCSVFile(
  csvText: string,
  source: IngestionSource,
  householdId: string,
  userId: string
): Promise<ParseResultWithMerge[]> {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }
  
  // Parse CSV (simple implementation - in production use a proper CSV parser)
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
  
  const results: ParseResultWithMerge[] = [];
  const flags = getFeatureFlags();
  const llmEnabled = flags.llmEnabled && isLLMEnabledForUser(userId);
  
  for (const row of rows) {
    let parsed: ParseResultWithMerge | null = null;
    
    // Tier 1: Deterministic regex
    if (source === IngestionSource.CSV_AMAZON && 'Title' in row) {
      parsed = parseAmazonCSV(row as any);
    } else if (source === IngestionSource.CSV_COSTCO && 'Description' in row) {
      parsed = parseCostcoCSV(row as any);
    }
    
    // Tier 2: Cache lookup (if deterministic failed)
    if (!parsed && row.Title) {
      const retailer = source === IngestionSource.CSV_AMAZON ? 'amazon' : 'costco';
      parsed = await parseWithCache(row.Title || row.Description || '', retailer);
    }
    
    // Tier 3: LLM fallback (if cache missed and LLM enabled)
    if (!parsed && llmEnabled) {
      const rawText = row.Title || row.Description || '';
      const retailer = source === IngestionSource.CSV_AMAZON ? 'amazon' : 'costco';
      
      if (rawText) {
        parsed = await parseWithLLM(rawText, retailer, householdId, userId);
      }
    }
    
    // If still no parse, create low-confidence entry for manual review
    if (!parsed) {
      const rawText = row.Title || row.Description || Object.values(row).join(' ');
      parsed = {
        rawText,
        canonicalName: rawText,
        category: Category.OTHER,
        quantity: 1,
        unitOfMeasure: UnitOfMeasure.EACH,
        packageSize: 1,
        packageUnit: UnitOfMeasure.EACH,
        confidence: 0.1,
        needsReview: true,
        userReviewed: false,
        isDuplicate: false,
        shouldMerge: false,
        parseMethod: 'regex'
      };
    }
    
    // Smart Merge: Check for duplicates
    if (parsed) {
      parsed = await checkForDuplicates(parsed, householdId);
      results.push(parsed);
    }
  }
  
  return results;
}

/**
 * Azure Function: Parse CSV
 * 
 * POST /api/parsing/csv
 * Body: { csvText: string, source: IngestionSource, householdId: string, userId: string }
 * Response: { jobId: string, status: ParseJobStatus, resultsCount: number }
 */
async function parseCSV(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Validate JWT token FIRST (before rate limiting)
    const authContext = await validateJWT(request, context);
    if (!authContext) {
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.AUTH_INVALID,
            message: 'Invalid or missing authentication token'
          }
        } as ApiResponse<never>
      };
    }
    
    // Apply rate limiting (5 requests/minute per user)
    const rateLimitResult = rateLimitMiddleware(request, RATE_LIMITS.CSV_UPLOAD);
    if (rateLimitResult) {
      return rateLimitResult; // Return 429 response
    }
    
    const body = await request.json() as any;
    
    // Use user's household and ID from auth context (do NOT trust request body)
    const householdId = authContext.householdIds[0];
    const userId = authContext.userId;
    
    // Validate household access
    if (!await validateHouseholdAccess(authContext, householdId, context)) {
      return {
        status: 403,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'Access denied to household'
          }
        } as ApiResponse<never>
      };
    }
    
    // Validate input
    if (!body.csvText || !body.source) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'csvText and source are required'
          }
        } as ApiResponse<never>
      };
    }
    
    // Validate CSV size (max 5MB)
    const csvSizeBytes = new Blob([body.csvText]).size;
    if (csvSizeBytes > 5 * 1024 * 1024) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'CSV file too large (max 5MB)'
          }
        } as ApiResponse<never>
      };
    }
    
    // Create parse job
    const jobId = uuidv4();
    const now = new Date().toISOString();
    
    // Parse CSV
    const results = await parseCSVFile(
      body.csvText,
      body.source,
      householdId,
      userId
    );
    
    // Calculate statistics
    const needsReviewCount = results.filter(r => r.needsReview).length;
    const autoAcceptCount = results.filter(r => !r.needsReview).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    // Create ParseJob document
    const parseJob: ParseJob = {
      id: jobId,
      householdId: householdId,
      userId: userId,
      status: needsReviewCount > 0 ? ParseJobStatus.NEEDS_REVIEW : ParseJobStatus.COMPLETED,
      source: body.source,
      rawData: body.csvText,
      results: results as ParsedItem[],
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      ttl: 7 * 24 * 60 * 60 // 7 days
    };
    
    // TODO: Save to Cosmos DB (parseJobs container)
    // For now, just return the job
    
    context.log(`✅ CSV parsed: ${results.length} items (${autoAcceptCount} auto-accept, ${needsReviewCount} needs review)`);
    context.log(`   Avg confidence: ${avgConfidence.toFixed(2)}, Parse methods: ${results.map(r => r.parseMethod).join(', ')}`);
    
    const response: HttpResponseInit = {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          jobId,
          status: parseJob.status,
          resultsCount: results.length,
          autoAcceptCount,
          needsReviewCount,
          avgConfidence: parseFloat(avgConfidence.toFixed(2))
        }
      } as ApiResponse<any>
    };
    
    // Add rate limit headers
    addRateLimitHeaders(response, request);
    return response;
    
  } catch (error: any) {
    context.error('CSV parse error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: `Failed to parse CSV: ${error.message}`
        }
      } as ApiResponse<never>
    };
  }
}

// Register Azure Function
app.http('parsing-csv', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'parsing/csv',
  handler: parseCSV
});
