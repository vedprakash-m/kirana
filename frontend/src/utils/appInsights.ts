/**
 * Application Insights Service (Frontend)
 * 
 * Centralized observability for frontend operations.
 * Tracks page loads, user sessions, activation metrics, and custom events.
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

// Application Insights connection string from environment
const CONNECTION_STRING = import.meta.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;

let appInsights: ApplicationInsights | null = null;
let reactPlugin: ReactPlugin | null = null;

/**
 * Initialize Application Insights
 */
export function initializeAppInsights(): void {
  if (!CONNECTION_STRING) {
    console.warn('Application Insights connection string not configured. Telemetry disabled.');
    return;
  }

  try {
    // Create React plugin for automatic component tracking
    reactPlugin = new ReactPlugin();

    // Initialize Application Insights
    appInsights = new ApplicationInsights({
      config: {
        connectionString: CONNECTION_STRING,
        enableAutoRouteTracking: true, // Track route changes automatically
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        enableCorsCorrelation: true,
        enableUnhandledPromiseRejectionTracking: true,
        disableFetchTracking: false,
        disableAjaxTracking: false,
        maxAjaxCallsPerView: 500,
        disableExceptionTracking: false,
        enableDebug: import.meta.env.DEV,
        extensions: [reactPlugin],
      },
    });

    appInsights.loadAppInsights();

    // Set cloud role name
    appInsights.addTelemetryInitializer((envelope: { tags?: Record<string, string> }) => {
      if (envelope.tags) {
        envelope.tags['ai.cloud.role'] = 'kirana-frontend';
      }
    });

    console.log('Application Insights initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Application Insights:', error);
  }
}

/**
 * Get the Application Insights instance
 */
export function getAppInsights(): ApplicationInsights | null {
  return appInsights;
}

/**
 * Get the React plugin instance (for use with AppInsightsContext)
 */
export function getReactPlugin(): ReactPlugin | null {
  return reactPlugin;
}

/**
 * Track page view (called automatically by router integration)
 */
export function trackPageView(name?: string, uri?: string): void {
  if (!appInsights) return;

  appInsights.trackPageView({
    name,
    uri,
  });
}

/**
 * Track custom event
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
  if (!appInsights) return;

  appInsights.trackEvent({
    name,
    properties,
  });
}

/**
 * Track custom metric
 */
export function trackMetric(name: string, value: number, properties?: Record<string, string>): void {
  if (!appInsights) return;

  appInsights.trackMetric({
    name,
    average: value,
  }, properties);
}

/**
 * Track exception
 */
export function trackException(error: Error, severityLevel?: number): void {
  if (!appInsights) return;

  appInsights.trackException({
    exception: error,
    severityLevel,
  });
}

/**
 * Track time to first prediction (activation metric)
 */
export function trackTimeToFirstPrediction(durationMs: number, userId: string, source: string): void {
  if (!appInsights) return;

  appInsights.trackMetric({
    name: 'time_to_first_prediction',
    average: durationMs,
  }, {
    userId,
    source, // 'teach_mode' | 'csv_import' | 'manual_entry'
    durationSeconds: (durationMs / 1000).toFixed(2),
  });

  appInsights.trackEvent({
    name: 'FirstPredictionGenerated',
    properties: {
      userId,
      source,
      durationMs: durationMs.toString(),
      durationSeconds: (durationMs / 1000).toFixed(2),
      metTarget: (durationMs < 300000).toString(), // <5 minutes
    },
  });
}

/**
 * Track Teach Mode completion
 */
export function trackTeachModeCompletion(params: {
  userId: string;
  itemCount: number;
  durationMs: number;
  completed: boolean;
  abandonedAt?: string;
}): void {
  if (!appInsights) return;

  const { userId, itemCount, durationMs, completed, abandonedAt } = params;

  appInsights.trackEvent({
    name: 'TeachModeCompletion',
    properties: {
      userId,
      itemCount: itemCount.toString(),
      durationMs: durationMs.toString(),
      completed: completed.toString(),
      abandonedAt,
    },
  });

  if (completed) {
    appInsights.trackMetric({
      name: 'teach_mode_completion_rate',
      average: 1,
    }, {
      userId,
      itemCount: itemCount.toString(),
    });
  }
}

/**
 * Track CSV upload success/failure
 */
export function trackCSVUpload(params: {
  userId: string;
  success: boolean;
  rowCount?: number;
  itemCount?: number;
  parseSuccessRate?: number;
  errorMessage?: string;
}): void {
  if (!appInsights) return;

  const { userId, success, rowCount, itemCount, parseSuccessRate, errorMessage } = params;

  appInsights.trackEvent({
    name: 'CSVUpload',
    properties: {
      userId,
      success: success.toString(),
      rowCount: rowCount?.toString(),
      itemCount: itemCount?.toString(),
      parseSuccessRate: parseSuccessRate?.toString(),
      errorMessage,
    },
  });

  appInsights.trackMetric({
    name: 'csv_upload_success_rate',
    average: success ? 1 : 0,
  }, {
    userId,
  });
}

/**
 * Track micro-review interaction
 */
export function trackMicroReview(params: {
  userId: string;
  action: 'accept' | 'edit' | 'abandon';
  itemCount: number;
  changesCount?: number;
}): void {
  if (!appInsights) return;

  const { userId, action, itemCount, changesCount } = params;

  appInsights.trackEvent({
    name: 'MicroReview',
    properties: {
      userId,
      action,
      itemCount: itemCount.toString(),
      changesCount: changesCount?.toString(),
    },
  });

  if (action === 'abandon') {
    appInsights.trackMetric({
      name: 'micro_review_abandon_rate',
      average: 1,
    }, {
      userId,
      itemCount: itemCount.toString(),
    });
  }
}

/**
 * Track prediction confidence distribution
 */
export function trackPredictionConfidence(params: {
  userId: string;
  confidence: 'high' | 'medium' | 'low' | 'teach_mode';
  itemId: string;
}): void {
  if (!appInsights) return;

  const { userId, confidence, itemId } = params;

  appInsights.trackMetric({
    name: 'prediction_confidence_distribution',
    average: confidence === 'high' ? 3 : confidence === 'medium' ? 2 : confidence === 'low' ? 1 : 0,
  }, {
    userId,
    confidence,
    itemId,
  });
}

/**
 * Track user session start
 */
export function trackSessionStart(userId: string, householdId: string): void {
  if (!appInsights) return;

  appInsights.trackEvent({
    name: 'SessionStart',
    properties: {
      userId,
      householdId,
    },
  });

  // Set user context
  appInsights.setAuthenticatedUserContext(userId, householdId);
}

/**
 * Track user session end
 */
export function trackSessionEnd(userId: string, durationMs: number): void {
  if (!appInsights) return;

  appInsights.trackEvent({
    name: 'SessionEnd',
    properties: {
      userId,
      durationMs: durationMs.toString(),
      durationMinutes: (durationMs / 60000).toFixed(2),
    },
  });

  appInsights.trackMetric({
    name: 'session_duration_ms',
    average: durationMs,
  }, {
    userId,
  });
}

/**
 * Flush telemetry buffer (call before unload)
 */
export function flushTelemetry(): void {
  if (appInsights) {
    appInsights.flush();
  }
}
