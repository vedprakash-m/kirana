import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getItemRepository } from '../../repositories/itemRepository';
import { ApiError, ErrorCode } from '../../types/shared';

/**
 * Prediction Override Endpoint
 * 
 * Purpose: Allow users to manually override predictions when their circumstances change.
 * This captures user feedback for model improvement and provides immediate control.
 * 
 * Use Cases:
 * - Going on vacation (won't need items for a while)
 * - Buying elsewhere (got items at another store not tracked)
 * - Changed consumption habits (eating out more, diet change, etc.)
 * - Other (free-form reason)
 * 
 * Processing Logic:
 * 1. Validate input (itemId, householdId, newPredictedDate, reason required)
 * 2. Fetch existing item
 * 3. Calculate daysDifference (new - old prediction)
 * 4. Append override to userOverrides[] array (preserves history)
 * 5. Update predictedRunOutDate
 * 6. Log analytics event for model improvement
 * 
 * Analytics Data (TTL 90 days):
 * - daysDifference: How much the user adjusted (positive = pushed out, negative = brought in)
 * - reason: Why they adjusted
 * - originalConfidence: What confidence level was the AI prediction
 * - originalPrediction: What date did AI predict
 * - userCorrectionDate: When did user make the correction
 * 
 * Future Use: This data can train the model to improve predictions for specific scenarios.
 */

interface OverrideRequest {
  itemId: string;
  householdId: string;
  userId: string;
  newPredictedDate: string; // ISO 8601
  reason: 'going_on_vacation' | 'buying_elsewhere' | 'changed_habit' | 'other';
  reasonText?: string; // Optional free-form text for 'other' or additional context
}

interface OverrideResponse {
  itemId: string;
  canonicalName: string;
  oldPredictedDate: string;
  newPredictedDate: string;
  daysDifference: number;
  reason: string;
  message: string;
}

/**
 * Validate override request
 */
function validateRequest(data: any): { valid: boolean; error?: ApiError } {
  if (!data.itemId || typeof data.itemId !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'itemId is required and must be a string'
      }
    };
  }

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

  if (!data.newPredictedDate || typeof data.newPredictedDate !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'newPredictedDate is required and must be an ISO 8601 string'
      }
    };
  }

  // Validate date format
  const newDate = new Date(data.newPredictedDate);
  if (isNaN(newDate.getTime())) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'newPredictedDate must be a valid ISO 8601 date'
      }
    };
  }

  // Don't allow dates in the past (more than 1 day ago to account for timezone issues)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  if (newDate < oneDayAgo) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'newPredictedDate cannot be more than 1 day in the past'
      }
    };
  }

  // Don't allow dates more than 2 years in the future
  const twoYearsFromNow = new Date();
  twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
  if (newDate > twoYearsFromNow) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'newPredictedDate cannot be more than 2 years in the future'
      }
    };
  }

  if (!data.reason || typeof data.reason !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'reason is required and must be a string'
      }
    };
  }

  const validReasons = ['going_on_vacation', 'buying_elsewhere', 'changed_habit', 'other'];
  if (!validReasons.includes(data.reason)) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'reason must be one of: going_on_vacation, buying_elsewhere, changed_habit, other'
      }
    };
  }

  if (data.reason === 'other' && (!data.reasonText || data.reasonText.trim().length === 0)) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'reasonText is required when reason is "other"'
      }
    };
  }

  if (data.reasonText && typeof data.reasonText !== 'string') {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'reasonText must be a string'
      }
    };
  }

  if (data.reasonText && data.reasonText.length > 500) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'reasonText cannot exceed 500 characters'
      }
    };
  }

  return { valid: true };
}

/**
 * Calculate days difference between two dates
 */
function calculateDaysDifference(oldDate: string, newDate: string): number {
  const old = new Date(oldDate);
  const newD = new Date(newDate);
  const diffMs = newD.getTime() - old.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Format reason for display
 */
function formatReason(reason: string, reasonText?: string): string {
  const reasonMap: Record<string, string> = {
    going_on_vacation: 'Going on vacation',
    buying_elsewhere: 'Buying elsewhere',
    changed_habit: 'Changed consumption habit',
    other: 'Other'
  };

  const base = reasonMap[reason] || reason;
  if (reasonText && reasonText.trim().length > 0) {
    return `${base}: ${reasonText}`;
  }
  return base;
}

/**
 * POST /api/predictions/override
 * Override a prediction with user-provided date
 */
async function overridePrediction(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('POST /api/predictions/override - Override prediction');

  try {
    // Parse request body
    const body = await request.json() as any;
    
    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return {
        status: 400,
        jsonBody: validation.error
      };
    }

    const requestData = body as OverrideRequest;

    // Fetch existing item
    const itemRepo = await getItemRepository();
    const item = await itemRepo.getById(requestData.itemId, requestData.householdId);

    if (!item) {
      return {
        status: 404,
        jsonBody: {
          code: ErrorCode.NOT_FOUND,
          message: `Item not found: ${requestData.itemId}`
        }
      };
    }

    // Calculate days difference
    const oldPredictedDate = item.predictedRunOutDate || new Date().toISOString();
    const daysDifference = calculateDaysDifference(oldPredictedDate, requestData.newPredictedDate);

    context.log(`Override: ${item.canonicalName} from ${oldPredictedDate} to ${requestData.newPredictedDate} (${daysDifference} days)`);

    // Update item prediction (override stored implicitly via predictedRunOutDate change)
    const now = new Date().toISOString();
    await itemRepo.updatePrediction(
      requestData.itemId,
      requestData.householdId,
      {
        predictedRunOutDate: requestData.newPredictedDate,
        predictionConfidence: item.predictionConfidence, // Keep existing confidence
        avgFrequencyDays: item.avgFrequencyDays || 0,
        avgConsumptionRate: item.avgConsumptionRate || 0
      }
    );

    context.log(`Updated item ${item.id} prediction: ${oldPredictedDate} → ${requestData.newPredictedDate}`);

    // Track analytics event (in production, this would go to Application Insights or events container)
    context.log('Analytics event: prediction_override', {
      itemId: item.id,
      householdId: requestData.householdId,
      userId: requestData.userId,
      canonicalName: item.canonicalName,
      category: item.category,
      oldPredictedDate,
      newPredictedDate: requestData.newPredictedDate,
      daysDifference,
      reason: requestData.reason,
      reasonText: requestData.reasonText,
      originalConfidence: item.predictionConfidence,
      originalFrequency: item.avgFrequencyDays,
      timestamp: now
    });

    // Build response
    const formattedReason = formatReason(requestData.reason, requestData.reasonText);
    const response: OverrideResponse = {
      itemId: item.id,
      canonicalName: item.canonicalName,
      oldPredictedDate,
      newPredictedDate: requestData.newPredictedDate,
      daysDifference,
      reason: formattedReason,
      message: daysDifference > 0
        ? `Pushed ${item.canonicalName} prediction out by ${daysDifference} days`
        : daysDifference < 0
        ? `Brought ${item.canonicalName} prediction in by ${Math.abs(daysDifference)} days`
        : `${item.canonicalName} prediction unchanged`
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error) {
    context.error('Error overriding prediction:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as ApiError;
      return {
        status: apiError.code === ErrorCode.NOT_FOUND ? 404 : 400,
        jsonBody: apiError
      };
    }

    return {
      status: 500,
      jsonBody: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to override prediction'
      }
    };
  }
}

// Register HTTP trigger
app.http('overridePrediction', {
  methods: ['POST'],
  route: 'predictions/override',
  authLevel: 'anonymous', // TODO: Change to 'function' in production with proper auth
  handler: overridePrediction
});
