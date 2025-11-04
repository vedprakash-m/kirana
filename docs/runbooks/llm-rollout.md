# LLM Rollout Runbook

## Overview

This runbook documents the **safe, gradual rollout procedure** for enabling Gemini LLM in production for CSV/photo parsing.

**🔴 CRITICAL**: LLM is disabled by default (`FEATURE_LLM_ENABLED=false`). This is a **safety gate** to prevent cost overruns.

---

## Rollout Phases

### Phase 1: Deterministic Parsers Only (Week 4-5)

**Status**: LLM DISABLED

**What works**:
- Regex parsers for Amazon/Costco CSV formats
- Normalization cache (30-40% hit rate)
- Teach Mode (manual entry)
- Micro-review UI

**What doesn't work**:
- LLM fallback for unknown formats
- Photo OCR parsing

**User experience**:
- High-confidence items (Amazon/Costco): Auto-accepted
- Unknown formats: Flagged for micro-review or manual entry
- Photos: Queued for overnight batch processing

**Goals**:
1. ✅ Validate deterministic parsers work correctly
2. ✅ Measure cache hit rate (target: ≥30%)
3. ✅ Test cost tracking dashboard
4. ✅ Verify budget circuit breaker

---

### Phase 2: Enable LLM for 10% of Users (Week 5-6)

**Status**: LLM ENABLED for 10% (early adopters)

**Prerequisites (ALL must be ✅)**:
- [ ] Cost tracking dashboard live with alerts configured
- [ ] Budget circuit breaker tested (503 response on budget exceeded)
- [ ] Normalization cache preloaded with top 1000 SKUs
- [ ] Cache hit rate measured at ≥30% on test dataset (100 sample CSVs)
- [ ] Per-operation cost budgets verified: CSV ≤$0.0002/line, Photo ≤$0.001/receipt
- [ ] Deterministic parsers tested and working

**Enablement Steps**:
1. Run rollout criteria validation:
   ```bash
   # Check unmet criteria
   node -e "import('./dist/config/featureFlags.js').then(m => m.validateRolloutCriteria()).then(console.log)"
   ```

2. Set environment variables:
   ```bash
   export FEATURE_LLM_ENABLED=true
   export FEATURE_LLM_ROLLOUT_PERCENTAGE=10
   ```

3. Deploy to production

4. Monitor for 48 hours:
   - Daily LLM spend (should be <$5/day)
   - Cache hit rate (should be ≥30%)
   - Parse success rate (should be >95%)
   - User budget consumption (should be <$0.20/month)

**Monitoring Queries (Cosmos DB)**:
```sql
-- Daily LLM spend
SELECT SUM(c.llmCostUSD) as totalCost
FROM c
WHERE c.period = '2025-11-02'
  AND c.periodType = 'daily'

-- Cache hit rate (from application logs)
-- Look for "Cache HIT" vs "Cache MISS" ratio

-- User budget consumption
SELECT c.userId, c.llmCostUSD
FROM c
WHERE c.periodType = 'monthly'
  AND c.period = '2025-11'
ORDER BY c.llmCostUSD DESC
```

**Success Criteria**:
- [ ] Daily spend <$5
- [ ] No budget exceeded errors (503)
- [ ] Parse success rate >95%
- [ ] User satisfaction: No complaints about accuracy

**Rollback Plan**:
If any issues occur:
```bash
export FEATURE_LLM_ENABLED=false
# Redeploy immediately
```

---

### Phase 3: Ramp to 50% → 100% (Week 6-7)

**Status**: Gradual increase based on metrics

**Ramp Schedule**:
- Week 6 Day 1-2: 10% → 25%
- Week 6 Day 3-4: 25% → 50%
- Week 6 Day 5-7: Monitor at 50%
- Week 7 Day 1-3: 50% → 75%
- Week 7 Day 4-7: 75% → 100%

**Ramp Steps** (repeat for each increase):
1. Update environment variable:
   ```bash
   export FEATURE_LLM_ROLLOUT_PERCENTAGE=25  # or 50, 75, 100
   ```

2. Deploy to production

3. Monitor for 24-48 hours

4. Validate:
   - Daily spend within budget (<$50/day)
   - User monthly spend within budget (<$0.20/user)
   - Cache hit rate stable (≥30%)
   - Parse accuracy stable (>95%)

5. If all metrics good → proceed to next ramp

**Pause/Rollback Triggers**:
- Daily spend >$40 (80% of $50 cap)
- User complaints about accuracy
- Budget exceeded errors (503)
- Cache hit rate drops <20%

---

## Emergency Rollback

### When to Roll Back

**Immediate rollback if**:
- Daily spend exceeds $50
- User monthly spend exceeds $0.20
- Budget circuit breaker not working
- LLM errors affecting >5% of requests

### Rollback Steps

1. Disable LLM immediately:
   ```bash
   export FEATURE_LLM_ENABLED=false
   ```

2. Deploy to production (use CI/CD or manual deploy)

3. Notify users:
   - "Parsing temporarily using cached results only"
   - "Accuracy may be lower for unknown items"
   - "ETA to restore: [timeframe]"

4. Enable batch processing queue:
   ```bash
   export FEATURE_BATCH_PROCESSING_ENABLED=true
   ```
   - Queued requests will be processed overnight at 2 AM UTC

5. Investigate root cause:
   - Check cost tracking dashboard
   - Review budget settings
   - Analyze failed LLM requests
   - Check cache hit rate

6. Fix issue and re-test in staging

7. Follow Phase 2 procedure to re-enable

---

## Monitoring & Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Daily LLM spend | <$50 | >$40 (80%) |
| User monthly spend | <$0.20 | >$0.16 (80%) |
| Cache hit rate | ≥30% | <20% |
| Parse success rate | >95% | <90% |
| LLM error rate | <1% | >5% |

### Alert Configuration

**Azure Monitor Alerts**:
1. **Budget Alert** (CRITICAL):
   - Condition: `dailyLLMSpend > 40`
   - Action: Email/SMS to on-call engineer
   - Severity: Critical

2. **Cache Hit Rate Alert** (WARNING):
   - Condition: `cacheHitRate < 20%`
   - Action: Email to engineering team
   - Severity: Warning

3. **Parse Error Alert** (CRITICAL):
   - Condition: `parseErrorRate > 5%`
   - Action: Email/SMS to on-call engineer
   - Severity: Critical

### Dashboard Links

- **Cost Tracking**: [Link to cost dashboard]
- **Cache Stats**: [Link to cache dashboard]
- **Parse Metrics**: [Link to parse metrics]

---

## Testing Checklist

### Pre-Rollout Testing (Phase 1)

- [ ] Test deterministic parsers on 100 sample CSVs
  - [ ] Amazon format: 100% accuracy
  - [ ] Costco format: 100% accuracy
  - [ ] Unknown format: Flagged for review

- [ ] Test cost tracking
  - [ ] Budget check blocks LLM when over budget
  - [ ] Cost logged to Cosmos DB
  - [ ] Alerts fire at 80% threshold

- [ ] Test normalization cache
  - [ ] Memory cache works (<10ms lookups)
  - [ ] Cosmos DB fallback works
  - [ ] Hit rate ≥30% on test dataset

- [ ] Test micro-review UI
  - [ ] Accept/edit/reject actions work
  - [ ] Smart Merge prevents duplicates
  - [ ] Analytics logged

### Phase 2 Testing (10% Rollout)

- [ ] Test LLM parsing on 100 sample CSVs
  - [ ] Parse success rate >95%
  - [ ] Cost per CSV ≤$0.0002/line
  - [ ] Confidence scoring works

- [ ] Test budget enforcement
  - [ ] User monthly cap enforced
  - [ ] System daily cap enforced
  - [ ] 503 response when exceeded

- [ ] Test quota handling
  - [ ] 429 errors queued for batch
  - [ ] Batch job processes queued items
  - [ ] Users notified of delay

### Phase 3 Testing (Ramp to 100%)

- [ ] Load test at each ramp percentage
  - [ ] 25%: 250 CSVs/day
  - [ ] 50%: 500 CSVs/day
  - [ ] 100%: 1000 CSVs/day

- [ ] Monitor metrics at each stage
  - [ ] Daily spend within budget
  - [ ] Cache hit rate stable
  - [ ] Parse accuracy stable

---

## Troubleshooting

### Issue: Daily spend exceeds budget

**Symptoms**: Daily spend >$50, budget alerts firing

**Diagnosis**:
1. Check cost tracking dashboard
2. Identify high-cost operations
3. Review LLM call frequency

**Resolution**:
1. Reduce rollout percentage: `export FEATURE_LLM_ROLLOUT_PERCENTAGE=5`
2. Enable batch processing: `export FEATURE_BATCH_PROCESSING_ENABLED=true`
3. Optimize prompts to reduce token usage
4. Increase cache preload size

---

### Issue: Cache hit rate drops

**Symptoms**: Cache hit rate <20%, LLM costs increase

**Diagnosis**:
1. Check cache stats: `await getNormalizationCache().getStats()`
2. Review memory cache size
3. Check Cosmos DB query performance

**Resolution**:
1. Preload more items: Increase `MEMORY_CACHE_SIZE` to 2000
2. Add more common items to cache
3. Optimize cache key generation

---

### Issue: Parse accuracy drops

**Symptoms**: Parse success rate <90%, user complaints

**Diagnosis**:
1. Review failed parse logs
2. Check LLM response quality
3. Test prompts with problematic inputs

**Resolution**:
1. Improve LLM prompts (add examples)
2. Adjust confidence thresholds
3. Add more deterministic regex patterns
4. Update normalization cache

---

## Contact

**On-Call Engineer**: [Phone/Email]  
**Engineering Team**: [Slack channel]  
**Escalation**: [Manager contact]

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-02 | Initial rollout runbook | System |
