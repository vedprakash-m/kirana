/**
 * Budget Check Middleware
 * 
 * Enforces LLM cost budgets at the middleware level before expensive operations.
 * Prevents budget overruns by checking limits before making LLM API calls.
 * 
 * PRD Reference: Section 10 - Cost Controls ($0.20/user/month, $50/day system-wide)
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { getCostTrackingService } from '../services/costTrackingService';

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  degradedMode: boolean;
  currentSpend?: {
    userMonthly: number;
    systemDaily: number;
  };
  limits?: {
    userMonthly: number;
    systemDaily: number;
  };
}

/**
 * Middleware to check budget before LLM operations
 * Returns 503 Service Unavailable if budget exceeded
 */
export async function checkBudgetMiddleware(
  request: HttpRequest,
  context: InvocationContext,
  estimatedTokens: { input: number; output: number }
): Promise<BudgetCheckResult> {
  try {
    const costTrackingService = await getCostTrackingService();
    
    // Extract household ID and user ID from query params or body
    const householdId = extractHouseholdId(request);
    const userId = extractUserId(request);
    
    if (!householdId || !userId) {
      context.warn('Budget check: No householdId or userId found in request');
      return {
        allowed: true, // Allow if we can't determine user (will be caught by auth)
        degradedMode: false
      };
    }

    // Estimate cost for this operation
    const costEstimate = costTrackingService.estimateCost(
      estimatedTokens.input,
      estimatedTokens.output
    );

    // Check if operation would exceed budgets
    const budgetStatus = await costTrackingService.checkBudget(
      householdId,
      userId,
      costEstimate.estimatedCost
    );

    if (!budgetStatus.allowed) {
      context.warn('Budget exceeded', {
        householdId,
        userId,
        estimatedCost: costEstimate.estimatedCost,
        message: budgetStatus.message,
        userMonthlySpend: budgetStatus.userMonthlySpend,
        systemDailySpend: budgetStatus.systemDailySpend
      });

      return {
        allowed: false,
        reason: budgetStatus.message,
        degradedMode: true,
        currentSpend: {
          userMonthly: budgetStatus.userMonthlySpend,
          systemDaily: budgetStatus.systemDailySpend
        },
        limits: {
          userMonthly: budgetStatus.userMonthlyCap,
          systemDaily: budgetStatus.systemDailyCap
        }
      };
    }

    context.log('Budget check passed', {
      householdId,
      userId,
      estimatedCost: costEstimate.estimatedCost,
      userMonthlySpend: budgetStatus.userMonthlySpend,
      systemDailySpend: budgetStatus.systemDailySpend
    });

    return {
      allowed: true,
      degradedMode: false,
      currentSpend: {
        userMonthly: budgetStatus.userMonthlySpend,
        systemDaily: budgetStatus.systemDailySpend
      },
      limits: {
        userMonthly: budgetStatus.userMonthlyCap,
        systemDaily: budgetStatus.systemDailyCap
      }
    };

  } catch (error) {
    context.error('Budget check failed', error);
    
    // On error, allow the operation but log for monitoring
    // This prevents budget check failures from blocking legitimate operations
    return {
      allowed: true,
      degradedMode: false,
      reason: 'Budget check error - allowing operation'
    };
  }
}

/**
 * Extract householdId from request (query params or body)
 */
function extractHouseholdId(request: HttpRequest): string | null {
  // Try query params first
  const queryHouseholdId = request.query.get('householdId');
  if (queryHouseholdId) {
    return queryHouseholdId;
  }

  // Try request body (for POST/PUT requests)
  try {
    const body = request.body;
    if (body && typeof body === 'object' && body !== null) {
      const bodyObj = body as unknown as Record<string, unknown>;
      if (typeof bodyObj.householdId === 'string') {
        return bodyObj.householdId;
      }
    }
  } catch {
    // Body parsing failed, continue
  }

  return null;
}

/**
 * Extract userId from request (headers, query params, or body)
 */
function extractUserId(request: HttpRequest): string | null {
  // Try header first (from auth middleware)
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId) {
    return headerUserId;
  }

  // Try query params
  const queryUserId = request.query.get('userId');
  if (queryUserId) {
    return queryUserId;
  }

  // Try request body
  try {
    const body = request.body;
    if (body && typeof body === 'object' && body !== null) {
      const bodyObj = body as unknown as Record<string, unknown>;
      if (typeof bodyObj.userId === 'string') {
        return bodyObj.userId;
      }
    }
  } catch {
    // Body parsing failed, continue
  }

  return null;
}

/**
 * Create standardized 503 response for budget exceeded
 */
export function createBudgetExceededResponse(checkResult: BudgetCheckResult) {
  return {
    status: 503,
    jsonBody: {
      success: false,
      error: {
        code: 'BUDGET_EXCEEDED',
        message: checkResult.reason || 'LLM budget limit exceeded',
        degradedMode: true,
        details: {
          currentSpend: checkResult.currentSpend,
          limits: checkResult.limits,
          suggestion: checkResult.reason?.includes('user')
            ? 'Your monthly LLM budget has been reached. Try again next month or use manual entry.'
            : 'System LLM capacity reached. Try again later or use manual entry.'
        }
      }
    }
  };
}

/**
 * Helper to estimate tokens for common operations
 */
export const TokenEstimates = {
  // CSV parsing estimates per line
  CSV_PARSE_PER_LINE: {
    input: 100,  // Prompt + CSV line
    output: 50   // Structured JSON response
  },
  
  // Receipt OCR estimates per image
  RECEIPT_OCR: {
    input: 800,  // Image tokens + prompt
    output: 200  // Multiple items extracted
  },
  
  // Email parsing estimates
  EMAIL_PARSE: {
    input: 500,  // Email text + prompt
    output: 150  // Structured data
  },
  
  // Teach Mode validation
  TEACH_MODE_VALIDATION: {
    input: 150,  // Item data + prompt
    output: 50   // Validation result
  },
  
  // Smart merge decision
  SMART_MERGE: {
    input: 200,  // Two items + prompt
    output: 30   // Merge decision
  }
};

/**
 * Example usage in an Azure Function:
 * 
 * ```typescript
 * import { checkBudgetMiddleware, createBudgetExceededResponse, TokenEstimates } from '../middleware/budgetCheck';
 * 
 * export async function parseCSV(request: HttpRequest, context: InvocationContext) {
 *   // Estimate tokens based on CSV size
 *   const lineCount = countCSVLines(request.body);
 *   const estimatedTokens = {
 *     input: TokenEstimates.CSV_PARSE_PER_LINE.input * lineCount,
 *     output: TokenEstimates.CSV_PARSE_PER_LINE.output * lineCount
 *   };
 * 
 *   // Check budget before processing
 *   const budgetCheck = await checkBudgetMiddleware(request, context, estimatedTokens);
 *   
 *   if (!budgetCheck.allowed) {
 *     return createBudgetExceededResponse(budgetCheck);
 *   }
 * 
 *   // Proceed with LLM call...
 *   const result = await geminiClient.parse(csvData);
 * 
 *   // Record actual usage
 *   await costTrackingService.recordUsage(
 *     householdId,
 *     'csv_parse',
 *     result.usage.inputTokens,
 *     result.usage.outputTokens
 *   );
 * 
 *   return { status: 200, jsonBody: result };
 * }
 * ```
 */
