# ADR-001: Exponential Smoothing for Consumption Prediction

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** prediction, algorithm, ml

## Context

Kirana needs to predict when grocery items will run out based on historical consumption patterns. The system must handle:
- Variable consumption rates (daily, weekly, irregular patterns)
- Seasonal trends and special occasions
- Limited historical data during onboarding
- Real-time updates as users restock items
- Low computational cost (must run on Azure Functions serverless)

We evaluated three approaches:
1. **Simple Moving Average (SMA)**: Average of last N transactions
2. **Exponential Smoothing**: Weighted average with recent data prioritized
3. **ARIMA/Prophet**: Advanced time series forecasting

## Decision

We will use **Exponential Smoothing** with α (alpha) between 0.1-0.5 for consumption rate prediction.

### Algorithm Details

```
consumptionRate[t] = α × actualRate[t] + (1 - α) × consumptionRate[t-1]
```

- **Alpha = 0.3 (default)**: Balances stability and responsiveness
- **Alpha = 0.5**: Used for items with erratic patterns (stdDev > 30% of mean)
- **Alpha = 0.1**: Used for stable items (teach mode, consistent intervals)

### Prediction Confidence Factors

Confidence is calculated based on 5 factors:
1. **min_transactions**: ≥3 restock events (met = true if count ≥3)
2. **consistent_intervals**: stdDev ≤30% of mean (met = true if consistent)
3. **recent_data**: Last restock within 2× average interval (met = true if recent)
4. **no_outliers**: No intervals >3× mean (met = true if no outliers)
5. **teach_mode**: User provided frequency explicitly (met = true if teach mode used)

### Dynamic Urgency Levels

- **Critical** (≤3 days): Red badge, top of list, push notification eligible
- **Warning** (4-7 days): Amber badge, middle of list
- **Normal** (>7 days): Green badge, bottom of list

## Consequences

### Positive

✅ **Low computational cost**: O(1) per prediction update, no model training  
✅ **Real-time updates**: Recalculate instantly when user restocks  
✅ **Handles sparse data**: Works with 1-2 data points (degrades confidence gracefully)  
✅ **Interpretable**: Users can understand "you use 2 lbs of rice per week"  
✅ **Self-correcting**: Adapts to changing consumption patterns automatically  
✅ **Teach Mode friendly**: Can seed with user-provided frequency (daily/weekly/monthly)  

### Negative

❌ **No seasonality modeling**: Can't predict Thanksgiving turkey spike (mitigated by α=0.5 for erratic items)  
❌ **Cold start problem**: New items have low confidence until 3+ restocks (mitigated by teach mode)  
❌ **Manual α tuning**: No automatic α optimization (acceptable tradeoff for simplicity)  

### Alternatives Considered

**Simple Moving Average (SMA)**:
- ❌ Rejected: Treats all data points equally, slow to adapt to changes
- ❌ Requires storing full history (more memory)
- ❌ Less responsive to recent behavior changes

**ARIMA/Prophet**:
- ❌ Rejected: Too complex for serverless environment
- ❌ Requires training phase (cold start latency)
- ❌ Overkill for household grocery data (not millions of data points)
- ❌ Black box model harder to explain to users

## Implementation Notes

- **File**: `backend/services/PredictionService.ts`
- **Function**: `calculateExponentialSmoothing(transactions, alpha)`
- **Factors tracking**: `PredictionMetadata.factors[]` array stores which factors are met
- **Alpha selection logic**:
  ```typescript
  const stdDev = calculateStdDev(intervals);
  const mean = intervals.reduce((a, b) => a + b) / intervals.length;
  const cv = stdDev / mean; // coefficient of variation
  const alpha = cv > 0.3 ? 0.5 : 0.3; // High variance → higher alpha
  ```

## References

- [Exponential Smoothing (Wikipedia)](https://en.wikipedia.org/wiki/Exponential_smoothing)
- [Time Series Forecasting with Exponential Smoothing](https://otexts.com/fpp2/ses.html)
- PRD Section 5.1: "Prediction Algorithm"
- Tech Spec Section 3.2: "Prediction Engine Logic"

## Review History

- 2025-11-03: Initial version (Accepted)
