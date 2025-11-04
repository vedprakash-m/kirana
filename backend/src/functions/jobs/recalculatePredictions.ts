import { app, InvocationContext, Timer } from '@azure/functions';
import { getPredictionEngine } from '../../services/predictionEngine';
import { getItemRepository } from '../../repositories/itemRepository';

/**
 * Daily Prediction Recalculation Job
 * 
 * Purpose:
 * - Runs daily at 2 AM UTC (6-9 PM local time for US users)
 * - Recalculates predictions for all households
 * - Logs metrics to Application Insights
 * 
 * Execution Flow:
 * 1. Query all distinct householdIds
 * 2. For each household: batch recalculate predictions
 * 3. Log comprehensive metrics
 * 
 * Error Handling:
 * - Per-household try/catch for isolation
 * - Failed households logged but don't block others
 * 
 * Performance:
 * - SLO: 95% processed by 6 AM local (4-hour window)
 * - Target: 1000 households in <5 minutes
 * - Monitoring: Alert if backlog ≥500 items
 */

interface RecalculationMetrics {
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  totalHouseholds: number;
  householdsProcessed: number;
  householdsFailed: number;
  totalItems: number;
  totalPredictionsUpdated: number;
  highConfidencePredictions: number;
  mediumConfidencePredictions: number;
  lowConfidencePredictions: number;
  noPredictions: number;
  totalErrors: number;
  itemsRunningOutSoon: number;
}

/**
 * Get all distinct household IDs from the database
 */
async function getAllHouseholdIds(context: InvocationContext): Promise<string[]> {
  try {
    const itemRepo = await getItemRepository();
    const householdIds = await itemRepo.getDistinctHouseholdIds();
    context.log(`Found ${householdIds.length} distinct households`);
    return householdIds;
  } catch (error) {
    context.error('Error fetching household IDs:', error);
    return [];
  }
}

/**
 * Recalculate predictions for a single household
 */
async function recalculateHouseholdPredictions(
  householdId: string,
  context: InvocationContext
): Promise<{
  success: boolean;
  stats: {
    totalItems: number;
    predictionsUpdated: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    noPrediction: number;
    errors: number;
  };
}> {
  try {
    const predictionEngine = getPredictionEngine();
    const stats = await predictionEngine.batchRecalculateAllPredictions(householdId);
    
    context.log(`Household ${householdId}: ${stats.predictionsUpdated}/${stats.totalItems} predictions updated`);
    
    return { success: true, stats };
  } catch (error) {
    context.error(`Error recalculating predictions for household ${householdId}:`, error);
    
    return {
      success: false,
      stats: {
        totalItems: 0,
        predictionsUpdated: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        noPrediction: 0,
        errors: 1
      }
    };
  }
}

/**
 * Count items running out soon across all households
 */
async function countItemsRunningOutSoon(householdIds: string[], context: InvocationContext): Promise<number> {
  try {
    const predictionEngine = getPredictionEngine();
    let totalCount = 0;

    for (const householdId of householdIds) {
      const items = await predictionEngine.getItemsRunningOutSoon(householdId, 7);
      totalCount += items.length;
    }

    return totalCount;
  } catch (error) {
    context.error('Error counting items running out soon:', error);
    return 0;
  }
}

/**
 * Main timer-triggered function
 * Schedule: Daily at 2 AM UTC (0 2 * * *)
 */
async function recalculatePredictionsTimer(timer: Timer, context: InvocationContext): Promise<void> {
  const metrics: RecalculationMetrics = {
    startTime: new Date(),
    totalHouseholds: 0,
    householdsProcessed: 0,
    householdsFailed: 0,
    totalItems: 0,
    totalPredictionsUpdated: 0,
    highConfidencePredictions: 0,
    mediumConfidencePredictions: 0,
    lowConfidencePredictions: 0,
    noPredictions: 0,
    totalErrors: 0,
    itemsRunningOutSoon: 0
  };

  context.log('===== Daily Prediction Recalculation Job Started =====');
  context.log(`Execution time: ${metrics.startTime.toISOString()}`);
  
  if (timer.isPastDue) {
    context.warn('Timer is past due - job may be running behind schedule');
  }

  try {
    // Step 1: Get all household IDs
    context.log('Step 1: Fetching all household IDs...');
    const householdIds = await getAllHouseholdIds(context);
    metrics.totalHouseholds = householdIds.length;

    if (householdIds.length === 0) {
      context.warn('No households found - nothing to process');
      return;
    }

    // Step 2: Recalculate predictions for each household
    context.log(`Step 2: Recalculating predictions for ${householdIds.length} households...`);
    
    for (const householdId of householdIds) {
      const result = await recalculateHouseholdPredictions(householdId, context);
      
      if (result.success) {
        metrics.householdsProcessed++;
        metrics.totalItems += result.stats.totalItems;
        metrics.totalPredictionsUpdated += result.stats.predictionsUpdated;
        metrics.highConfidencePredictions += result.stats.highConfidence;
        metrics.mediumConfidencePredictions += result.stats.mediumConfidence;
        metrics.lowConfidencePredictions += result.stats.lowConfidence;
        metrics.noPredictions += result.stats.noPrediction;
        metrics.totalErrors += result.stats.errors;
      } else {
        metrics.householdsFailed++;
        metrics.totalErrors++;
      }
    }

    // Step 3: Count items running out soon
    context.log('Step 3: Counting items running out soon...');
    metrics.itemsRunningOutSoon = await countItemsRunningOutSoon(householdIds, context);

    // Calculate final metrics
    metrics.endTime = new Date();
    metrics.durationMs = metrics.endTime.getTime() - metrics.startTime.getTime();

    // Log comprehensive summary
    context.log('===== Daily Prediction Recalculation Job Completed =====');
    context.log('Summary:');
    context.log(`  Duration: ${(metrics.durationMs / 1000).toFixed(2)}s`);
    context.log(`  Households: ${metrics.householdsProcessed}/${metrics.totalHouseholds} processed (${metrics.householdsFailed} failed)`);
    context.log(`  Items: ${metrics.totalItems} total`);
    context.log(`  Predictions: ${metrics.totalPredictionsUpdated} updated`);
    context.log(`    - High confidence: ${metrics.highConfidencePredictions}`);
    context.log(`    - Medium confidence: ${metrics.mediumConfidencePredictions}`);
    context.log(`    - Low confidence: ${metrics.lowConfidencePredictions}`);
    context.log(`    - No prediction: ${metrics.noPredictions}`);
    context.log(`  Items running out soon (7 days): ${metrics.itemsRunningOutSoon}`);
    context.log(`  Errors: ${metrics.totalErrors}`);

    // Check SLO compliance (4-hour window = 14400000ms)
    const SLO_THRESHOLD_MS = 4 * 60 * 60 * 1000;
    if (metrics.durationMs && metrics.durationMs > SLO_THRESHOLD_MS) {
      context.warn(`⚠️  SLO VIOLATION: Job took ${(metrics.durationMs / 1000 / 60).toFixed(2)} minutes (>4 hours)`);
    }

    // Check backlog alert threshold
    if (metrics.itemsRunningOutSoon >= 500) {
      context.warn(`⚠️  HIGH BACKLOG: ${metrics.itemsRunningOutSoon} items running out soon (≥500 threshold)`);
    }

    // Log metrics to Application Insights (custom dimensions)
    context.log('Metrics:', {
      ...metrics,
      householdSuccessRate: ((metrics.householdsProcessed / metrics.totalHouseholds) * 100).toFixed(2) + '%',
      avgPredictionsPerHousehold: metrics.householdsProcessed > 0
        ? (metrics.totalPredictionsUpdated / metrics.householdsProcessed).toFixed(2)
        : '0',
      sloCompliant: metrics.durationMs ? metrics.durationMs <= SLO_THRESHOLD_MS : true,
      backlogAlert: metrics.itemsRunningOutSoon >= 500
    });

  } catch (error) {
    context.error('Fatal error in recalculation job:', error);
    
    metrics.endTime = new Date();
    metrics.durationMs = metrics.endTime.getTime() - metrics.startTime.getTime();
    
    // Log failure metrics
    context.log('Job failed:', {
      ...metrics,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error; // Re-throw to mark function execution as failed
  }
}

// Register timer trigger
// Schedule: Daily at 2 AM UTC (6-9 PM local time for US users)
// NCRONTAB format: {second} {minute} {hour} {day} {month} {day-of-week}
app.timer('recalculatePredictionsTimer', {
  schedule: '0 0 2 * * *', // 2:00 AM UTC every day
  handler: recalculatePredictionsTimer
});
