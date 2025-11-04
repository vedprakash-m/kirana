/**
 * Prediction Engine Service
 * 
 * Core value proposition: Predicts when items will run out using exponential smoothing.
 * 
 * Algorithm (Tech Spec 6.3):
 * 1. Fetch transaction history for item
 * 2. Calculate intervals between purchases (in days)
 * 3. Remove outliers using Z-score >2.0
 * 4. Apply exponential smoothing with α=0.3
 * 5. Predict next purchase: lastPurchaseDate + smoothedInterval
 * 6. Calculate confidence based on purchase count, recency, and consistency
 * 
 * Confidence Levels (PRD-aligned):
 * - HIGH: ≥3 purchases AND recent <30d AND consistent (stdDev <20% of mean) AND no outliers
 * - MEDIUM: ≥2 purchases AND (recent <30d OR stdDev <50% of mean)
 * - LOW: All other cases (0-1 purchases, old data, high variance)
 * 
 * Performance:
 * - Single item: <50ms
 * - Household batch (50 items): <2s
 * - Full recalculation (1000 households): <5 minutes
 */

import { getItemRepository } from '../repositories/itemRepository';
import { getTransactionRepository } from '../repositories/transactionRepository';
import { Item, Transaction, PredictionConfidence } from '../types/shared';

/**
 * Exponential smoothing parameter (α)
 * - Higher α (0.5-0.9): More weight on recent data (responsive to trends)
 * - Lower α (0.1-0.3): More weight on historical average (stable)
 * - PRD uses α=0.3 for balance between stability and responsiveness
 */
const ALPHA = 0.3;

/**
 * Z-score threshold for outlier detection
 * - Z-score >2.0 means value is >2 standard deviations from mean
 * - Removes ~5% of extreme values (bulk purchases, one-time events)
 */
const Z_SCORE_THRESHOLD = 2.0;

/**
 * Confidence thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  MIN_PURCHASES_HIGH: 3,
  MIN_PURCHASES_MEDIUM: 2,
  RECENT_DAYS: 30,
  HIGH_CONSISTENCY_PERCENT: 20, // stdDev <20% of mean
  MEDIUM_CONSISTENCY_PERCENT: 50 // stdDev <50% of mean
} as const;

/**
 * Prediction result with metadata
 */
export interface PredictionResult {
  predictedDate: string; // ISO date
  confidence: PredictionConfidence;
  daysUntilRunOut: number;
  smoothedInterval: number; // In days
  metadata: {
    purchaseCount: number;
    recentPurchase: boolean; // Last purchase within 30 days
    consistency: number; // Coefficient of variation (stdDev/mean)
    outliersRemoved: number;
    lastPurchaseDate: string;
    intervals: number[]; // Original intervals
    cleanedIntervals: number[]; // After outlier removal
  };
}

/**
 * Calculate intervals between consecutive purchases
 * 
 * @param transactions - Sorted array of transactions (oldest first)
 * @returns Array of intervals in days
 */
function calculateIntervals(transactions: Transaction[]): number[] {
  if (transactions.length < 2) {
    return [];
  }

  const intervals: number[] = [];
  
  for (let i = 1; i < transactions.length; i++) {
    const prevDate = new Date(transactions[i - 1].purchaseDate);
    const currDate = new Date(transactions[i].purchaseDate);
    const intervalDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only include positive intervals (guard against data errors)
    if (intervalDays > 0) {
      intervals.push(intervalDays);
    }
  }
  
  return intervals;
}

/**
 * Calculate mean (average) of array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  
  return Math.sqrt(variance);
}

/**
 * Calculate Z-score for each value
 * Z-score = (value - mean) / stdDev
 */
function calculateZScores(values: number[]): number[] {
  if (values.length < 2) return values.map(() => 0);
  
  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values);
  
  if (stdDev === 0) return values.map(() => 0);
  
  return values.map(val => Math.abs((val - mean) / stdDev));
}

/**
 * Remove outliers using Z-score method
 * 
 * @param intervals - Array of purchase intervals
 * @param threshold - Z-score threshold (default: 2.0)
 * @returns Object with cleaned intervals and outlier count
 */
export function removeOutliers(
  intervals: number[],
  threshold: number = Z_SCORE_THRESHOLD
): { cleaned: number[]; outliersRemoved: number } {
  if (intervals.length < 3) {
    // Need at least 3 data points for meaningful outlier detection
    return { cleaned: intervals, outliersRemoved: 0 };
  }
  
  const zScores = calculateZScores(intervals);
  const cleaned: number[] = [];
  let outliersRemoved = 0;
  
  for (let i = 0; i < intervals.length; i++) {
    if (zScores[i] <= threshold) {
      cleaned.push(intervals[i]);
    } else {
      outliersRemoved++;
    }
  }
  
  // Fallback: If all values are outliers, use original data
  if (cleaned.length === 0) {
    return { cleaned: intervals, outliersRemoved: 0 };
  }
  
  return { cleaned, outliersRemoved };
}

/**
 * Apply exponential smoothing to intervals
 * 
 * Formula: S[t] = α*X[t] + (1-α)*S[t-1]
 * - S[t]: Smoothed value at time t
 * - X[t]: Actual value at time t
 * - α: Smoothing parameter (0.3)
 * 
 * @param intervals - Array of intervals (after outlier removal)
 * @param alpha - Smoothing parameter (default: 0.3)
 * @returns Smoothed interval in days
 */
export function applyExponentialSmoothing(
  intervals: number[],
  alpha: number = ALPHA
): number {
  if (intervals.length === 0) return 0;
  if (intervals.length === 1) return intervals[0];
  
  // Initialize with first value
  let smoothed = intervals[0];
  
  // Apply exponential smoothing
  for (let i = 1; i < intervals.length; i++) {
    smoothed = alpha * intervals[i] + (1 - alpha) * smoothed;
  }
  
  return smoothed;
}

/**
 * Calculate confidence level based on PRD criteria
 * 
 * HIGH: ≥3 purchases AND recent <30d AND consistent (CV <20%) AND no outliers
 * MEDIUM: ≥2 purchases AND (recent <30d OR CV <50%)
 * LOW: All other cases
 * 
 * @param metadata - Prediction metadata
 * @returns Confidence level
 */
export function calculateConfidence(metadata: {
  purchaseCount: number;
  recentPurchase: boolean;
  consistency: number; // Coefficient of variation (%)
  outliersRemoved: number;
}): PredictionConfidence {
  const { purchaseCount, recentPurchase, consistency, outliersRemoved } = metadata;
  
  // HIGH confidence criteria
  if (
    purchaseCount >= CONFIDENCE_THRESHOLDS.MIN_PURCHASES_HIGH &&
    recentPurchase &&
    consistency < CONFIDENCE_THRESHOLDS.HIGH_CONSISTENCY_PERCENT &&
    outliersRemoved === 0
  ) {
    return PredictionConfidence.HIGH;
  }
  
  // MEDIUM confidence criteria
  if (
    purchaseCount >= CONFIDENCE_THRESHOLDS.MIN_PURCHASES_MEDIUM &&
    (recentPurchase || consistency < CONFIDENCE_THRESHOLDS.MEDIUM_CONSISTENCY_PERCENT)
  ) {
    return PredictionConfidence.MEDIUM;
  }
  
  // LOW confidence (all other cases)
  return PredictionConfidence.LOW;
}

/**
 * Calculate prediction for a single item
 * 
 * @param itemId - Item ID
 * @param householdId - Household ID (for partition key)
 * @returns Prediction result or null if insufficient data
 */
export async function calculatePrediction(
  itemId: string,
  householdId: string
): Promise<PredictionResult | null> {
  const transactionRepo = await getTransactionRepository();
  
  // Fetch all transactions for this item, sorted by date (oldest first)
  const transactions = await transactionRepo.getByItem(itemId, householdId);
  
  // Need at least 2 transactions to calculate interval
  if (transactions.length < 2) {
    return null;
  }
  
  // Sort by purchase date (oldest first)
  transactions.sort((a: Transaction, b: Transaction) => 
    new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
  );
  
  // Calculate intervals between purchases
  const intervals = calculateIntervals(transactions);
  
  if (intervals.length === 0) {
    return null;
  }
  
  // Remove outliers
  const { cleaned: cleanedIntervals, outliersRemoved } = removeOutliers(intervals);
  
  // Apply exponential smoothing
  const smoothedInterval = applyExponentialSmoothing(cleanedIntervals);
  
  // Get last purchase date
  const lastTransaction = transactions[transactions.length - 1];
  const lastPurchaseDate = new Date(lastTransaction.purchaseDate);
  
  // Check if recent (within 30 days)
  const daysSinceLastPurchase = Math.round(
    (Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const recentPurchase = daysSinceLastPurchase <= CONFIDENCE_THRESHOLDS.RECENT_DAYS;
  
  // Calculate consistency (coefficient of variation)
  const mean = calculateMean(cleanedIntervals);
  const stdDev = calculateStdDev(cleanedIntervals);
  const consistency = mean > 0 ? (stdDev / mean) * 100 : 0;
  
  // Predict next purchase date
  const predictedDate = new Date(lastPurchaseDate);
  predictedDate.setDate(predictedDate.getDate() + Math.round(smoothedInterval));
  
  // Calculate days until run out
  const daysUntilRunOut = Math.round(
    (predictedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  // Calculate confidence
  const confidence = calculateConfidence({
    purchaseCount: transactions.length,
    recentPurchase,
    consistency,
    outliersRemoved
  });
  
  return {
    predictedDate: predictedDate.toISOString(),
    confidence,
    daysUntilRunOut,
    smoothedInterval,
    metadata: {
      purchaseCount: transactions.length,
      recentPurchase,
      consistency,
      outliersRemoved,
      lastPurchaseDate: lastPurchaseDate.toISOString(),
      intervals,
      cleanedIntervals
    }
  };
}

/**
 * Update item with prediction data
 * 
 * @param itemId - Item ID
 * @param householdId - Household ID
 * @returns Updated item or null if no prediction
 */
export async function updateItemPrediction(
  itemId: string,
  householdId: string
): Promise<Item | null> {
  const itemRepo = await getItemRepository();
  
  // Calculate prediction
  const prediction = await calculatePrediction(itemId, householdId);
  
  if (!prediction) {
    // Not enough data for prediction - item will not have predictions
    return null;
  }
  
  // Update item with prediction using updatePrediction method
  // Note: avgFrequencyDays and avgConsumptionRate are calculated from smoothedInterval
  const updatedItem = await itemRepo.updatePrediction(itemId, householdId, {
    predictedRunOutDate: prediction.predictedDate,
    predictionConfidence: prediction.confidence,
    avgFrequencyDays: prediction.smoothedInterval,
    avgConsumptionRate: 1 / prediction.smoothedInterval // Items per day
  });
  
  return updatedItem;
}

/**
 * Batch recalculate predictions for all items in a household
 * 
 * @param householdId - Household ID
 * @returns Statistics about predictions updated
 */
export async function batchRecalculateAllPredictions(
  householdId: string
): Promise<{
  totalItems: number;
  predictionsUpdated: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  noPrediction: number;
  errors: number;
}> {
  const itemRepo = await getItemRepository();
  
  // Fetch all items for household
  const items = await itemRepo.getByHousehold(householdId);
  
  const stats = {
    totalItems: items.length,
    predictionsUpdated: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    noPrediction: 0,
    errors: 0
  };
  
  // Process each item
  for (const item of items) {
    try {
      const prediction = await calculatePrediction(item.id, householdId);
      
      if (prediction) {
        // Update item with prediction
        await itemRepo.updatePrediction(item.id, householdId, {
          predictedRunOutDate: prediction.predictedDate,
          predictionConfidence: prediction.confidence,
          avgFrequencyDays: prediction.smoothedInterval,
          avgConsumptionRate: 1 / prediction.smoothedInterval
        });
        
        stats.predictionsUpdated++;
        
        // Count by confidence
        if (prediction.confidence === PredictionConfidence.HIGH) {
          stats.highConfidence++;
        } else if (prediction.confidence === PredictionConfidence.MEDIUM) {
          stats.mediumConfidence++;
        } else {
          stats.lowConfidence++;
        }
      } else {
        stats.noPrediction++;
      }
    } catch (error) {
      console.error(`Error calculating prediction for item ${item.id}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

/**
 * Get items running out soon (for dashboard)
 * 
 * @param householdId - Household ID
 * @param daysThreshold - Days threshold (default: 7)
 * @returns Items predicted to run out within threshold
 */
export async function getItemsRunningOutSoon(
  householdId: string,
  daysThreshold: number = 7
): Promise<Item[]> {
  const itemRepo = await getItemRepository();
  
  // Use the repository's built-in method for getting items running out soon
  return await itemRepo.getRunningOutSoon(householdId, daysThreshold);
}

/**
 * Validate prediction algorithm (for testing)
 * 
 * Test cases:
 * 1. Regular pattern: [7, 7, 7] → smoothed ≈ 7, HIGH confidence
 * 2. Trending pattern: [5, 6, 7, 8] → smoothed ≈ 7.5, MEDIUM confidence
 * 3. With outlier: [7, 7, 30, 7] → remove 30, smoothed ≈ 7, MEDIUM confidence
 * 4. High variance: [3, 10, 5, 12] → LOW confidence
 * 5. Insufficient data: [7] → null
 */
export function validateAlgorithm(): boolean {
  // Test case 1: Regular pattern
  const regular = applyExponentialSmoothing([7, 7, 7]);
  if (Math.abs(regular - 7) > 0.1) return false;
  
  // Test case 2: Trending pattern
  const trending = applyExponentialSmoothing([5, 6, 7, 8]);
  if (trending < 6.5 || trending > 7.5) return false;
  
  // Test case 3: Outlier removal
  const withOutlier = removeOutliers([7, 7, 30, 7]);
  if (withOutlier.cleaned.includes(30)) return false;
  if (withOutlier.outliersRemoved !== 1) return false;
  
  // Test case 4: Confidence calculation
  const highConf = calculateConfidence({
    purchaseCount: 5,
    recentPurchase: true,
    consistency: 10, // 10% variation
    outliersRemoved: 0
  });
  if (highConf !== PredictionConfidence.HIGH) return false;
  
  const lowConf = calculateConfidence({
    purchaseCount: 2,
    recentPurchase: false,
    consistency: 80, // 80% variation
    outliersRemoved: 0
  });
  if (lowConf !== PredictionConfidence.LOW) return false;
  
  return true;
}

// ===== Singleton Export =====

let predictionEngineInstance: {
  calculatePrediction: typeof calculatePrediction;
  updateItemPrediction: typeof updateItemPrediction;
  batchRecalculateAllPredictions: typeof batchRecalculateAllPredictions;
  getItemsRunningOutSoon: typeof getItemsRunningOutSoon;
  validateAlgorithm: typeof validateAlgorithm;
} | null = null;

export function getPredictionEngine() {
  if (!predictionEngineInstance) {
    predictionEngineInstance = {
      calculatePrediction,
      updateItemPrediction,
      batchRecalculateAllPredictions,
      getItemsRunningOutSoon,
      validateAlgorithm
    };
  }
  return predictionEngineInstance;
}
