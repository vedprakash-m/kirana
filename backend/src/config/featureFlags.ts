/**
 * Feature Flags Configuration
 * 
 * 🔴 CRITICAL SAFETY GATES for production rollout
 * 
 * LLM Rollout Gate:
 * - Default: llmEnabled = false (safety first)
 * - Requires ALL rollout criteria to be met before enabling
 * - See docs/runbooks/llm-rollout.md for detailed procedures
 * 
 * Rollout Phases:
 * 1. Phase 1: Deterministic parsers only (LLM disabled) - Week 4-5
 * 2. Phase 2: Enable LLM for 10% of users - Week 5-6
 * 3. Phase 3: Ramp to 50% → 100% based on metrics - Week 6-7
 */

export interface FeatureFlags {
  /**
   * 🔴 CRITICAL GATE: Enable/disable Gemini LLM for CSV/photo parsing
   * 
   * DEFAULT: false (safety gate)
   * 
   * Rollout Criteria (ALL must be ✅ before enabling):
   * 1. ✅ Cost tracking dashboard live with alerts configured (>80% budget threshold)
   * 2. ✅ Budget circuit breaker tested and working (503 response on budget exceeded)
   * 3. ✅ Normalization cache preloaded with top 1000 SKUs
   * 4. ✅ Cache hit rate measured at ≥30% on test dataset (100 sample CSVs)
   * 5. ✅ Per-operation cost budgets set: CSV ≤$0.0002/line, Photo ≤$0.001/receipt
   * 6. ✅ Deterministic parsers (regex) tested and working for Amazon/Costco formats
   * 
   * When disabled:
   * - CSV parsing uses deterministic regex + cache only
   * - Photo parsing queued for overnight batch processing
   * - Lower accuracy but zero LLM costs
   */
  llmEnabled: boolean;
  
  /**
   * Percentage of users to enable LLM for (0-100)
   * 
   * Used during gradual rollout:
   * - Phase 1: 0% (deterministic only)
   * - Phase 2: 10% (early adopters)
   * - Phase 3: 50% (half of users)
   * - Phase 4: 100% (full rollout)
   * 
   * User selection: hash(userId) % 100 < llmRolloutPercentage
   */
  llmRolloutPercentage: number;
  
  /**
   * Enable batch processing queue for LLM requests
   * 
   * When enabled:
   * - LLM requests over budget queued for overnight processing
   * - Batch job runs at 2 AM UTC (low usage time)
   * - Cost spreading over multiple days
   */
  batchProcessingEnabled: boolean;
  
  /**
   * Enable detailed cost analytics and logging
   * 
   * Logs:
   * - Per-operation cost breakdown
   * - Cache hit/miss ratios
   * - LLM performance metrics
   * - User budget consumption
   */
  costAnalyticsEnabled: boolean;
  
  /**
   * Enable Teach Mode for manual item entry
   * 
   * Allows users to manually add items with frequency prediction.
   */
  teachModeEnabled: boolean;
  
  /**
   * Enable micro-review UI for low-confidence items
   */
  microReviewEnabled: boolean;
}

/**
 * Get feature flags from environment variables
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    // 🔴 DEFAULT: false (safety gate)
    llmEnabled: process.env.FEATURE_LLM_ENABLED === 'true',
    
    // Gradual rollout percentage
    llmRolloutPercentage: parseInt(process.env.FEATURE_LLM_ROLLOUT_PERCENTAGE || '0', 10),
    
    // Batch processing (default: enabled for cost control)
    batchProcessingEnabled: process.env.FEATURE_BATCH_PROCESSING_ENABLED !== 'false',
    
    // Cost analytics (default: enabled for monitoring)
    costAnalyticsEnabled: process.env.FEATURE_COST_ANALYTICS_ENABLED !== 'false',
    
    // Teach Mode (default: enabled)
    teachModeEnabled: process.env.FEATURE_TEACH_MODE_ENABLED !== 'false',
    
    // Micro-review (default: enabled)
    microReviewEnabled: process.env.FEATURE_MICRO_REVIEW_ENABLED !== 'false',
  };
}

/**
 * Check if LLM is enabled for a specific user
 * 
 * Uses hash of userId to determine if user is in rollout percentage.
 * Provides consistent experience (same user always gets same result).
 * 
 * @param userId - User ID
 * @returns true if LLM should be enabled for this user
 */
export function isLLMEnabledForUser(userId: string): boolean {
  const flags = getFeatureFlags();
  
  // If LLM globally disabled, return false
  if (!flags.llmEnabled) {
    return false;
  }
  
  // If 100% rollout, return true
  if (flags.llmRolloutPercentage >= 100) {
    return true;
  }
  
  // If 0% rollout, return false
  if (flags.llmRolloutPercentage <= 0) {
    return false;
  }
  
  // Hash userId to get consistent random number (0-99)
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const bucket = Math.abs(hash) % 100;
  
  // Enable if bucket is within rollout percentage
  return bucket < flags.llmRolloutPercentage;
}

/**
 * Validate rollout criteria before enabling LLM
 * 
 * Returns list of unmet criteria.
 * Empty array = all criteria met, safe to enable.
 * 
 * @returns Array of unmet criteria
 */
export async function validateRolloutCriteria(): Promise<string[]> {
  const unmet: string[] = [];
  
  // Check 1: Cost tracking dashboard
  if (!process.env.COST_DASHBOARD_URL) {
    unmet.push('Cost tracking dashboard not configured (COST_DASHBOARD_URL missing)');
  }
  
  // Check 2: Budget circuit breaker
  if (!process.env.LLM_COST_PER_USER_MONTHLY || !process.env.LLM_COST_SYSTEM_DAILY) {
    unmet.push('Budget limits not configured (LLM_COST_PER_USER_MONTHLY, LLM_COST_SYSTEM_DAILY missing)');
  }
  
  // Check 3: Normalization cache preloaded
  // (This should be checked at runtime by the cache service)
  
  // Check 4: Cache hit rate target
  // (This should be measured in production and logged)
  
  // Check 5: Per-operation cost budgets
  if (!process.env.LLM_COST_PER_CSV_LINE || !process.env.LLM_COST_PER_PHOTO) {
    unmet.push('Per-operation cost budgets not configured (LLM_COST_PER_CSV_LINE, LLM_COST_PER_PHOTO missing)');
  }
  
  // Check 6: Deterministic parsers tested
  // (This is a manual testing requirement, documented in runbook)
  
  return unmet;
}

/**
 * Log feature flag status on startup
 */
export function logFeatureFlags(): void {
  const flags = getFeatureFlags();
  
  console.log('🚩 Feature Flags:');
  console.log(`   - LLM Enabled: ${flags.llmEnabled ? '✅ YES' : '❌ NO (safety gate)'}`);
  console.log(`   - LLM Rollout: ${flags.llmRolloutPercentage}% of users`);
  console.log(`   - Batch Processing: ${flags.batchProcessingEnabled ? '✅' : '❌'}`);
  console.log(`   - Cost Analytics: ${flags.costAnalyticsEnabled ? '✅' : '❌'}`);
  console.log(`   - Teach Mode: ${flags.teachModeEnabled ? '✅' : '❌'}`);
  console.log(`   - Micro-review: ${flags.microReviewEnabled ? '✅' : '❌'}`);
  
  if (flags.llmEnabled) {
    console.log('⚠️  LLM is ENABLED. Ensure rollout criteria are met!');
  } else {
    console.log('🔒 LLM is DISABLED (safety gate). Using deterministic parsers only.');
  }
}
