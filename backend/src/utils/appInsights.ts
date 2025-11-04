/**
 * Application Insights Service (Backend)
 * 
 * Centralized observability for backend operations.
 * Tracks custom metrics for LLM costs, parse jobs, predictions, and budget enforcement.
 */

import { TelemetryClient } from 'applicationinsights';
import * as appInsights from 'applicationinsights';

// Application Insights connection string from environment
const CONNECTION_STRING = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

let telemetryClient: TelemetryClient | null = null;

/**
 * Initialize Application Insights
 */
export function initializeAppInsights(): void {
  if (!CONNECTION_STRING) {
    console.warn('Application Insights connection string not configured. Telemetry disabled.');
    return;
  }

  try {
    // Setup Application Insights
    appInsights.setup(CONNECTION_STRING)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, false)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false) // Disable live metrics stream for cost control
      .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
      .start();

    telemetryClient = appInsights.defaultClient;

    // Set cloud role name for better filtering in Azure Portal
    telemetryClient.context.tags[telemetryClient.context.keys.cloudRole] = 'kirana-backend';

    console.log('Application Insights initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Application Insights:', error);
  }
}

/**
 * Get the telemetry client instance
 */
export function getTelemetryClient(): TelemetryClient | null {
  return telemetryClient;
}

/**
 * Track LLM API call metrics
 */
export function trackLLMCall(params: {
  model: string;
  operation: string; // 'parse_csv' | 'parse_photo' | 'classification'
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  durationMs: number;
  success: boolean;
  userId?: string;
  householdId?: string;
  errorMessage?: string;
}): void {
  if (!telemetryClient) return;

  const {
    model,
    operation,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    durationMs,
    success,
    userId,
    householdId,
    errorMessage,
  } = params;

  // Track custom metric: LLM cost
  telemetryClient.trackMetric({
    name: 'llm_cost',
    value: cost,
    properties: {
      model,
      operation,
      success: success.toString(),
      userId,
      householdId,
    },
  });

  // Track custom metric: LLM tokens
  telemetryClient.trackMetric({
    name: 'llm_tokens',
    value: totalTokens,
    properties: {
      model,
      operation,
      promptTokens: promptTokens.toString(),
      completionTokens: completionTokens.toString(),
      userId,
      householdId,
    },
  });

  // Track custom metric: LLM duration
  telemetryClient.trackMetric({
    name: 'llm_duration_ms',
    value: durationMs,
    properties: {
      model,
      operation,
      success: success.toString(),
    },
  });

  // Track event with all details
  telemetryClient.trackEvent({
    name: 'LLMCall',
    properties: {
      model,
      operation,
      promptTokens: promptTokens.toString(),
      completionTokens: completionTokens.toString(),
      totalTokens: totalTokens.toString(),
      cost: cost.toString(),
      durationMs: durationMs.toString(),
      success: success.toString(),
      userId,
      householdId,
      errorMessage,
    },
  });

  // Track exception if failed
  if (!success && errorMessage) {
    telemetryClient.trackException({
      exception: new Error(errorMessage),
      properties: {
        operation: 'LLMCall',
        model,
        llmOperation: operation,
        userId,
        householdId,
      },
    });
  }
}

/**
 * Track parse job metrics
 */
export function trackParseJob(params: {
  jobType: 'csv' | 'photo';
  rowCount?: number;
  itemCount: number;
  parseSuccessRate: number;
  durationMs: number;
  success: boolean;
  userId?: string;
  householdId?: string;
  errorMessage?: string;
}): void {
  if (!telemetryClient) return;

  const {
    jobType,
    rowCount,
    itemCount,
    parseSuccessRate,
    durationMs,
    success,
    userId,
    householdId,
    errorMessage,
  } = params;

  // Track custom metric: Parse job duration
  telemetryClient.trackMetric({
    name: 'parse_job_duration_ms',
    value: durationMs,
    properties: {
      jobType,
      success: success.toString(),
      userId,
      householdId,
    },
  });

  // Track custom metric: Parse success rate
  telemetryClient.trackMetric({
    name: 'parse_success_rate',
    value: parseSuccessRate,
    properties: {
      jobType,
      userId,
      householdId,
    },
  });

  // Track event with all details
  telemetryClient.trackEvent({
    name: 'ParseJob',
    properties: {
      jobType,
      rowCount: rowCount?.toString(),
      itemCount: itemCount.toString(),
      parseSuccessRate: parseSuccessRate.toString(),
      durationMs: durationMs.toString(),
      success: success.toString(),
      userId,
      householdId,
      errorMessage,
    },
  });

  // Track exception if failed
  if (!success && errorMessage) {
    telemetryClient.trackException({
      exception: new Error(errorMessage),
      properties: {
        operation: 'ParseJob',
        jobType,
        userId,
        householdId,
      },
    });
  }
}

/**
 * Track prediction calculation metrics
 */
export function trackPredictionCalculation(params: {
  itemId: string;
  algorithm: string; // 'exponential_smoothing' | 'frequency_based'
  confidence: 'high' | 'medium' | 'low' | 'teach_mode';
  durationMs: number;
  factorsMet: number;
  totalFactors: number;
  userId?: string;
  householdId?: string;
}): void {
  if (!telemetryClient) return;

  const {
    itemId,
    algorithm,
    confidence,
    durationMs,
    factorsMet,
    totalFactors,
    userId,
    householdId,
  } = params;

  // Track custom metric: Prediction duration
  telemetryClient.trackMetric({
    name: 'prediction_duration_ms',
    value: durationMs,
    properties: {
      algorithm,
      confidence,
      userId,
      householdId,
    },
  });

  // Track event with all details
  telemetryClient.trackEvent({
    name: 'PredictionCalculation',
    properties: {
      itemId,
      algorithm,
      confidence,
      durationMs: durationMs.toString(),
      factorsMet: factorsMet.toString(),
      totalFactors: totalFactors.toString(),
      userId,
      householdId,
    },
  });
}

/**
 * Track budget enforcement triggers
 */
export function trackBudgetEnforcement(params: {
  triggerType: 'daily_limit' | 'user_limit' | 'global_limit';
  currentSpend: number;
  limit: number;
  userId?: string;
  householdId?: string;
  action: 'throttle' | 'block';
}): void {
  if (!telemetryClient) return;

  const { triggerType, currentSpend, limit, userId, householdId, action } = params;

  // Track custom metric: Budget enforcement
  telemetryClient.trackMetric({
    name: 'budget_enforcement_trigger',
    value: 1,
    properties: {
      triggerType,
      action,
      userId,
      householdId,
    },
  });

  // Track event with all details
  telemetryClient.trackEvent({
    name: 'BudgetEnforcement',
    properties: {
      triggerType,
      currentSpend: currentSpend.toString(),
      limit: limit.toString(),
      utilizationPercent: ((currentSpend / limit) * 100).toFixed(2),
      action,
      userId,
      householdId,
    },
  });

  // Log warning to console
  console.warn(`Budget enforcement triggered: ${triggerType} - ${action}`, {
    currentSpend,
    limit,
    utilizationPercent: ((currentSpend / limit) * 100).toFixed(2),
    userId,
    householdId,
  });
}

/**
 * Track cache performance metrics
 */
export function trackCachePerformance(params: {
  cacheType: 'normalization' | 'prediction';
  operation: 'hit' | 'miss';
  key?: string;
}): void {
  if (!telemetryClient) return;

  const { cacheType, operation, key } = params;

  // Track custom metric: Cache performance
  telemetryClient.trackMetric({
    name: 'cache_operation',
    value: operation === 'hit' ? 1 : 0,
    properties: {
      cacheType,
      operation,
    },
  });

  // Track event (sampled to reduce volume - only 10% of hits)
  if (operation === 'hit' && Math.random() < 0.1) {
    telemetryClient.trackEvent({
      name: 'CacheOperation',
      properties: {
        cacheType,
        operation,
        key,
      },
    });
  } else if (operation === 'miss') {
    // Always track misses (more important for diagnostics)
    telemetryClient.trackEvent({
      name: 'CacheOperation',
      properties: {
        cacheType,
        operation,
        key,
      },
    });
  }
}

/**
 * Flush telemetry buffer (call before process exit)
 */
export function flushTelemetry(): void {
  if (telemetryClient) {
    telemetryClient.flush();
  }
}
