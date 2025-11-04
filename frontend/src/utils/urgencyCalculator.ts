/**
 * Dynamic Urgency Calculator
 * 
 * Implements UX Spec Section 6.1: Dynamic, frequency-relative urgency system.
 * 
 * **Problem with Fixed Thresholds:**
 * - Fixed "7 days = urgent" doesn't work for all items
 * - Example: Milk (weekly) with 4 days left = 57% remaining = GREEN ✅
 * - Example: Contact lenses (90-day cycle) with 8 days left = 8.9% remaining = RED 🔴
 * 
 * **Solution: Relative Urgency**
 * - Calculate % of purchase cycle remaining
 * - RED ≤25%, YELLOW ≤50%, GREEN >50%
 * - Works for ANY purchase frequency (daily to yearly)
 * 
 * **Formula:**
 * ```
 * percentRemaining = (daysRemaining / purchaseCycle) * 100
 * 
 * Examples:
 * - Milk: 7-day cycle, 4 days left → 4/7 = 57% → GREEN 🟢
 * - Contact lenses: 90-day cycle, 8 days left → 8/90 = 8.9% → RED 🔴
 * - Bread: 3-day cycle, 1 day left → 1/3 = 33% → YELLOW 🟡
 * ```
 * 
 * **Edge Cases:**
 * - No prediction: NORMAL (gray)
 * - Already ran out (negative days): CRITICAL (red, shows "ran out X days ago")
 * - No frequency data: Fallback to fixed thresholds (7 days = urgent)
 */

import type { Item } from '@/types/shared';

export enum UrgencyLevel {
  CRITICAL = 'critical',  // Already ran out
  HIGH = 'high',          // RED: ≤25% remaining
  MEDIUM = 'medium',      // YELLOW: ≤50% remaining
  LOW = 'low',            // GREEN: >50% remaining
  NORMAL = 'normal'       // Gray: No prediction or unknown
}

export interface UrgencyInfo {
  level: UrgencyLevel;
  color: string;          // Hex color for UI
  emoji: string;          // Visual indicator
  message: string;        // Display text
  daysRemaining: number;  // Days until run-out (negative if already ran out)
  percentRemaining: number; // % of cycle remaining (0-100+)
  purchaseCycle: number;  // Days between purchases
}

/**
 * Urgency color palette (aligned with UX Spec)
 */
const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  [UrgencyLevel.CRITICAL]: '#DC2626',  // red-600
  [UrgencyLevel.HIGH]: '#DC2626',      // red-600
  [UrgencyLevel.MEDIUM]: '#F59E0B',    // amber-500
  [UrgencyLevel.LOW]: '#10B981',       // emerald-500
  [UrgencyLevel.NORMAL]: '#9CA3AF'     // gray-400
};

/**
 * Urgency emoji indicators
 */
const URGENCY_EMOJIS: Record<UrgencyLevel, string> = {
  [UrgencyLevel.CRITICAL]: '🚨',
  [UrgencyLevel.HIGH]: '🔴',
  [UrgencyLevel.MEDIUM]: '🟡',
  [UrgencyLevel.LOW]: '🟢',
  [UrgencyLevel.NORMAL]: '⚪'
};

/**
 * Relative urgency thresholds (% of cycle remaining)
 */
const URGENCY_THRESHOLDS = {
  HIGH: 25,    // RED if ≤25% remaining
  MEDIUM: 50   // YELLOW if ≤50% remaining
  // GREEN if >50% remaining
};

/**
 * Fallback thresholds when no frequency data (fixed days)
 */
const FALLBACK_THRESHOLDS = {
  HIGH: 3,      // RED if ≤3 days
  MEDIUM: 7     // YELLOW if ≤7 days
  // GREEN if >7 days
};

/**
 * Calculate days remaining until predicted run-out
 */
function calculateDaysRemaining(predictedRunOutDate: string | undefined): number | null {
  if (!predictedRunOutDate) {
    return null;
  }

  const now = new Date();
  const runOutDate = new Date(predictedRunOutDate);
  
  // Reset to start of day for consistent calculation
  now.setHours(0, 0, 0, 0);
  runOutDate.setHours(0, 0, 0, 0);
  
  const diffMs = runOutDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calculate percent of purchase cycle remaining
 */
function calculatePercentRemaining(daysRemaining: number, purchaseCycle: number): number {
  if (purchaseCycle <= 0) {
    return 0;
  }
  
  const percent = (daysRemaining / purchaseCycle) * 100;
  return Math.max(0, percent); // Don't return negative percentages
}

/**
 * Determine urgency level from percent remaining (relative to cycle)
 */
function determineUrgencyLevel(
  daysRemaining: number | null,
  percentRemaining: number,
  purchaseCycle: number | undefined
): UrgencyLevel {
  // No prediction data
  if (daysRemaining === null) {
    return UrgencyLevel.NORMAL;
  }

  // Already ran out
  if (daysRemaining < 0) {
    return UrgencyLevel.CRITICAL;
  }

  // Use relative thresholds if we have cycle data
  if (purchaseCycle && purchaseCycle > 0) {
    if (percentRemaining <= URGENCY_THRESHOLDS.HIGH) {
      return UrgencyLevel.HIGH;
    }
    if (percentRemaining <= URGENCY_THRESHOLDS.MEDIUM) {
      return UrgencyLevel.MEDIUM;
    }
    return UrgencyLevel.LOW;
  }

  // Fallback to fixed thresholds
  if (daysRemaining <= FALLBACK_THRESHOLDS.HIGH) {
    return UrgencyLevel.HIGH;
  }
  if (daysRemaining <= FALLBACK_THRESHOLDS.MEDIUM) {
    return UrgencyLevel.MEDIUM;
  }
  return UrgencyLevel.LOW;
}

/**
 * Generate human-readable urgency message
 */
function generateUrgencyMessage(
  level: UrgencyLevel,
  daysRemaining: number | null,
  percentRemaining: number
): string {
  if (daysRemaining === null) {
    return 'No prediction';
  }

  // Already ran out
  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return `Ran out ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`;
  }

  // Today
  if (daysRemaining === 0) {
    return 'Runs out today';
  }

  // Future
  const daysText = daysRemaining === 1 ? 'day' : 'days';
  const percentText = Math.round(percentRemaining);

  switch (level) {
    case UrgencyLevel.HIGH:
      return `${daysRemaining} ${daysText} left (${percentText}% of cycle)`;
    case UrgencyLevel.MEDIUM:
      return `${daysRemaining} ${daysText} left (${percentText}% of cycle)`;
    case UrgencyLevel.LOW:
      return `${daysRemaining} ${daysText} left`;
    default:
      return `${daysRemaining} ${daysText} left`;
  }
}

/**
 * Calculate comprehensive urgency information for an item
 * 
 * @param item - The item to calculate urgency for
 * @returns UrgencyInfo with level, color, emoji, message, and metrics
 */
export function calculateUrgency(item: Item): UrgencyInfo {
  const daysRemaining = calculateDaysRemaining(item.predictedRunOutDate);
  const purchaseCycle = item.avgFrequencyDays || 0;
  const percentRemaining = daysRemaining !== null 
    ? calculatePercentRemaining(daysRemaining, purchaseCycle)
    : 0;

  const level = determineUrgencyLevel(daysRemaining, percentRemaining, purchaseCycle);
  const color = URGENCY_COLORS[level];
  const emoji = URGENCY_EMOJIS[level];
  const message = generateUrgencyMessage(
    level,
    daysRemaining,
    percentRemaining
  );

  return {
    level,
    color,
    emoji,
    message,
    daysRemaining: daysRemaining ?? 0,
    percentRemaining,
    purchaseCycle
  };
}

/**
 * Sort items by urgency (most urgent first)
 * 
 * Priority order:
 * 1. CRITICAL (already ran out) - sorted by days overdue (most overdue first)
 * 2. HIGH (≤25% remaining) - sorted by days remaining (soonest first)
 * 3. MEDIUM (≤50% remaining) - sorted by days remaining (soonest first)
 * 4. LOW (>50% remaining) - sorted by days remaining (soonest first)
 * 5. NORMAL (no prediction) - sorted by name
 * 
 * @param items - Array of items to sort
 * @returns Sorted array (most urgent first)
 */
export function sortByUrgency(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const urgencyA = calculateUrgency(a);
    const urgencyB = calculateUrgency(b);

    // Define urgency level priority (lower number = higher priority)
    const levelPriority: Record<UrgencyLevel, number> = {
      [UrgencyLevel.CRITICAL]: 0,
      [UrgencyLevel.HIGH]: 1,
      [UrgencyLevel.MEDIUM]: 2,
      [UrgencyLevel.LOW]: 3,
      [UrgencyLevel.NORMAL]: 4
    };

    const priorityA = levelPriority[urgencyA.level];
    const priorityB = levelPriority[urgencyB.level];

    // Sort by priority level first
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Within same level, sort by days remaining (soonest first)
    // For NORMAL items, sort alphabetically
    if (urgencyA.level === UrgencyLevel.NORMAL && urgencyB.level === UrgencyLevel.NORMAL) {
      return a.canonicalName.localeCompare(b.canonicalName);
    }

    return urgencyA.daysRemaining - urgencyB.daysRemaining;
  });
}

/**
 * Filter items by urgency level
 * 
 * @param items - Array of items to filter
 * @param levels - Urgency levels to include
 * @returns Filtered array
 */
export function filterByUrgencyLevel(items: Item[], levels: UrgencyLevel[]): Item[] {
  return items.filter((item) => {
    const urgency = calculateUrgency(item);
    return levels.includes(urgency.level);
  });
}

/**
 * Get items that are running out soon (CRITICAL or HIGH urgency)
 * 
 * @param items - Array of items to check
 * @returns Items that need immediate attention
 */
export function getItemsRunningOutSoon(items: Item[]): Item[] {
  return filterByUrgencyLevel(items, [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH]);
}

/**
 * Get urgency statistics for a list of items
 * 
 * @param items - Array of items to analyze
 * @returns Count of items at each urgency level
 */
export function getUrgencyStats(items: Item[]): Record<UrgencyLevel, number> {
  const stats: Record<UrgencyLevel, number> = {
    [UrgencyLevel.CRITICAL]: 0,
    [UrgencyLevel.HIGH]: 0,
    [UrgencyLevel.MEDIUM]: 0,
    [UrgencyLevel.LOW]: 0,
    [UrgencyLevel.NORMAL]: 0
  };

  items.forEach((item) => {
    const urgency = calculateUrgency(item);
    stats[urgency.level]++;
  });

  return stats;
}
