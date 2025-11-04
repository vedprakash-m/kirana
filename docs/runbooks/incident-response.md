# Incident Response Runbooks

This document contains operational runbooks for responding to common incidents in the Kirana production environment.

## Table of Contents

1. [LLM Cost Spike](#1-llm-cost-spike)
2. [Prediction Accuracy Degradation](#2-prediction-accuracy-degradation)
3. [Gmail OAuth Failure](#3-gmail-oauth-failure)
4. [Cosmos DB Throttling](#4-cosmos-db-throttling)
5. [General Incident Response Process](#general-incident-response-process)
6. [Escalation Contacts](#escalation-contacts)

---

## 1. LLM Cost Spike

### Trigger Condition
Daily LLM spend exceeds $40 (80% of $50 cap)

### Symptoms
- Alert: "High LLM Cost - 70% of Daily Cap" (Sev 2)
- Dashboard shows red gauge on LLM Cost widget
- Rapid increase in `customMetrics/llm_cost` metric

### Immediate Actions (< 5 minutes)

#### Step 1: Assess Current Spend
```bash
# Query Application Insights for current day's spend
az monitor app-insights query \
  --app kirana-appinsights \
  --resource-group kirana-rg \
  --analytics-query "customMetrics | where name == 'llm_cost' | where timestamp >= startofday(now()) | summarize TotalCost = sum(value)"
```

**Expected Output:** Current daily spend in dollars

#### Step 2: Identify High-Cost Operations
```bash
# Query for LLM calls by operation type
az monitor app-insights query \
  --app kirana-appinsights \
  --resource-group kirana-rg \
  --analytics-query "customEvents | where name == 'LLMCall' | where timestamp >= ago(1h) | summarize Count = count(), TotalCost = sum(todouble(customDimensions.cost)) by tostring(customDimensions.operation) | order by TotalCost desc"
```

**Look For:**
- Abnormally high counts of `parse_csv` or `parse_photo` operations
- Single users making excessive requests
- Failed operations that are retrying excessively

#### Step 3: Check System-Wide Budget Enforcement
```bash
# Verify budget service is running
curl -X GET "https://kirana-api.azurewebsites.net/api/budget/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response:** `{"budgetEnforcement": "active", "dailySpend": XX, "cap": 50}`

### Mitigation Actions (5-15 minutes)

#### Option A: Throttle CSV/Photo Uploads (Temporary)

If cost spike is due to excessive parse jobs:

```bash
# Update feature flags in Azure App Configuration
az appconfig kv set \
  --name kirana-config \
  --key "FeatureFlags:CSVUpload" \
  --value false \
  --label production

az appconfig kv set \
  --name kirana-config \
  --key "FeatureFlags:PhotoUpload" \
  --value false \
  --label production
```

**Impact:** Users cannot upload CSV/photo files until re-enabled  
**Communication:** Post banner: "CSV/photo upload temporarily unavailable. Manual entry still works."

#### Option B: Increase Cache Hit Rate

If cost spike is due to low normalization cache hits:

```bash
# Preload top 2000 items into cache
curl -X POST "https://kirana-api.azurewebsites.net/api/admin/cache/preload" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemCount": 2000, "refreshExisting": true}'
```

**Expected Result:** Cache hit rate should increase from 25% → 60-70%

#### Option C: Implement Per-User Rate Limits

If cost spike is due to single user abuse:

```bash
# Identify high-spend users
az monitor app-insights query \
  --app kirana-appinsights \
  --resource-group kirana-rg \
  --analytics-query "customMetrics | where name == 'llm_cost' | where timestamp >= ago(1h) | summarize TotalCost = sum(value) by tostring(customDimensions.userId) | order by TotalCost desc | take 10"

# Apply rate limit to specific user
curl -X POST "https://kirana-api.azurewebsites.net/api/admin/rate-limit" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<user-id>", "maxRequestsPerHour": 10, "duration": "24h"}'
```

### Root Cause Analysis (Post-Incident)

1. **Review Parse Job Patterns:**
   - Check for large CSV files (>500 rows) being uploaded repeatedly
   - Look for failed parse jobs that are retrying excessively
   - Identify users uploading duplicate data

2. **Audit Cache Performance:**
   - Verify normalization cache TTL (should be 7 days)
   - Check Redis cache memory usage
   - Review cache eviction rate

3. **Optimize LLM Prompts:**
   - Reduce prompt token count (currently ~200 tokens per item)
   - Batch items in parse requests (currently 10 items per batch)
   - Use lower-cost model tier for simple classifications

### Resolution Checklist

- [ ] Daily spend is below $40
- [ ] Budget enforcement is active
- [ ] Cache hit rate is above 25%
- [ ] CSV/photo uploads re-enabled (if throttled)
- [ ] Rate limits removed (if applied)
- [ ] Incident report written (include RCA)
- [ ] Postmortem scheduled (if Sev 1)

**Estimated Resolution Time:** 15-30 minutes

---

## 2. Prediction Accuracy Degradation

### Trigger Condition
Low confidence predictions exceed 40% of total predictions (target: <30%)

### Symptoms
- Alert: "High Low-Confidence Predictions" (Sev 2)
- Dashboard shows spike in red segment of Prediction Confidence pie chart
- Users reporting inaccurate restock dates

### Immediate Actions (< 10 minutes)

#### Step 1: Check Data Quality
```bash
# Query for transactions with missing/invalid data
az monitor app-insights query \
  --app kirana-appinsights \
  --resource-group kirana-rg \
  --analytics-query "customEvents | where name == 'PredictionCalculation' | where timestamp >= ago(1h) | where tostring(customDimensions.confidence) == 'low' | summarize Count = count() by tostring(customDimensions.itemId) | order by Count desc | take 20"
```

**Look For:**
- Same items repeatedly generating low-confidence predictions
- Recent bulk imports (CSV/photo) with data quality issues

#### Step 2: Review Outlier Detection
```bash
# Check Z-score threshold in configuration
curl -X GET "https://kirana-api.azurewebsites.net/api/admin/config/outlier-threshold" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response:** `{"zScoreThreshold": 2.5}` (default)

If threshold is too aggressive (e.g., 1.5), increase to 2.5:
```bash
curl -X PUT "https://kirana-api.azurewebsites.net/api/admin/config/outlier-threshold" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"zScoreThreshold": 2.5}'
```

#### Step 3: Audit User Override Patterns
```bash
# Check for systematic override bias
az cosmos db sql query \
  --account-name kirana-cosmos \
  --database-name kirana-db \
  --container-name transactions \
  --query-text "SELECT c.itemId, COUNT(1) as OverrideCount FROM c WHERE c.source = 'user_override' AND c.timestamp >= DateTimeAdd('day', -7, GetCurrentDateTime()) GROUP BY c.itemId ORDER BY COUNT(1) DESC OFFSET 0 LIMIT 20"
```

**Look For:**
- Items with >10 overrides in the last 7 days
- Patterns indicating users don't trust predictions

### Mitigation Actions (10-30 minutes)

#### Option A: Retrain Exponential Smoothing Models

If data quality is good but predictions are stale:

```bash
# Trigger batch recalculation for all items
curl -X POST "https://kirana-api.azurewebsites.net/api/admin/predictions/recalculate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope": "all", "algorithm": "exponential_smoothing", "alpha": 0.3}'
```

**Expected Result:** New predictions generated for all items within 5 minutes

#### Option B: Clean Up Invalid Transactions

If data quality issues are detected:

```bash
# Identify and mark outlier transactions
curl -X POST "https://kirana-api.azurewebsites.net/api/admin/data/mark-outliers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30, "zScoreThreshold": 3.0, "autoExclude": true}'
```

**Impact:** Transactions with Z-score > 3.0 are excluded from prediction calculations

#### Option C: Increase Minimum Transaction Requirement

If items have too few data points:

```bash
# Update minimum transaction count for high confidence
curl -X PUT "https://kirana-api.azurewebsites.net/api/admin/config/prediction-thresholds" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"minTransactionsHigh": 5, "minTransactionsMedium": 3}'
```

**Default:** 3 transactions for high, 2 for medium

### Root Cause Analysis (Post-Incident)

1. **Data Quality Audit:**
   - Run data validation checks on last 30 days of transactions
   - Identify users with recurring data entry errors
   - Review CSV import validation rules

2. **Algorithm Review:**
   - Compare exponential smoothing vs frequency-based accuracy
   - Test different alpha values (0.2, 0.3, 0.4) on historical data
   - Evaluate seasonal factors (holidays, bulk purchases)

3. **User Behavior Analysis:**
   - Interview users with high override rates
   - Identify feature requests or UX issues
   - Review micro-review acceptance rates

### Resolution Checklist

- [ ] Low-confidence prediction rate is below 30%
- [ ] Data quality issues identified and cleaned
- [ ] Outlier detection threshold optimized
- [ ] Prediction models retrained
- [ ] User communication sent (if predictions changed significantly)
- [ ] Incident report written

**Estimated Resolution Time:** 30-60 minutes

---

## 3. Gmail OAuth Failure

### Trigger Condition
Users unable to connect Gmail for Amazon order email parsing

### Symptoms
- Alert: "High Gmail OAuth Failure Rate" (Sev 1)
- Dashboard shows spike in authentication errors
- Users reporting "OAuth error" or "Connection failed" messages

### Immediate Actions (< 5 minutes)

#### Step 1: Verify OAuth Configuration
```bash
# Check OAuth callback URL registration
curl -X GET "https://kirana-api.azurewebsites.net/api/admin/oauth/config" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "clientId": "xxx.apps.googleusercontent.com",
  "redirectUri": "https://kirana.app/auth/gmail/callback",
  "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
  "registered": true
}
```

**Verify:**
- `redirectUri` matches exactly what's registered in Google Cloud Console
- No trailing slashes or protocol mismatches (http vs https)

#### Step 2: Check Google API Quota
```bash
# Query Gmail API usage from Google Cloud Console
gcloud services quotas describe \
  --service=gmail.googleapis.com \
  --consumer=projects/kirana-project \
  --page-size=100 | grep "quota_usage"
```

**Look For:**
- Daily request quota: 1,000,000,000 requests/day (generous)
- Per-user quota: 250 quota units per user per second
- If quota exceeded, requests will fail with 429 errors

#### Step 3: Test OAuth Flow Manually
```bash
# Initiate OAuth flow
curl -X GET "https://kirana-api.azurewebsites.net/api/auth/gmail/authorize?userId=test-user"
```

**Expected Response:** Redirect URL to Google OAuth consent screen

**Manually Test:**
1. Open redirect URL in browser
2. Complete OAuth flow
3. Verify callback redirects to `https://kirana.app/auth/gmail/callback?code=...`

### Mitigation Actions (5-30 minutes)

#### Option A: Update OAuth Callback URL

If callback URL mismatch detected:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Navigate to: APIs & Services → Credentials → OAuth 2.0 Client IDs → "Kirana Web App"
3. Add authorized redirect URI: `https://kirana.app/auth/gmail/callback`
4. Remove old/invalid URIs
5. Wait 5 minutes for propagation

**Verification:**
```bash
# Test OAuth flow again
curl -X GET "https://kirana-api.azurewebsites.net/api/auth/gmail/authorize?userId=test-user"
```

#### Option B: Refresh OAuth Client Secret

If client secret has been rotated or expired:

1. In Google Cloud Console: OAuth 2.0 Client IDs → "Kirana Web App" → Download JSON
2. Update Azure Key Vault secret:
   ```bash
   az keyvault secret set \
     --vault-name kirana-keyvault \
     --name gmail-oauth-client-secret \
     --file client_secret.json
   ```
3. Restart Azure Functions to pick up new secret:
   ```bash
   az functionapp restart \
     --name kirana-backend \
     --resource-group kirana-rg
   ```

**Impact:** 30-60 seconds downtime during restart

#### Option C: Check Token Refresh Logic

If existing connections are failing (token expired):

```bash
# Query for expired tokens
az cosmos db sql query \
  --account-name kirana-cosmos \
  --database-name kirana-db \
  --container-name users \
  --query-text "SELECT c.id, c.gmailConnection.tokenExpiry FROM c WHERE c.gmailConnection != null AND c.gmailConnection.tokenExpiry < GetCurrentTimestamp()"
```

**Manually Refresh:**
```bash
# Trigger token refresh for affected users
curl -X POST "https://kirana-api.azurewebsites.net/api/admin/oauth/refresh-tokens" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider": "gmail", "forceRefresh": true}'
```

### Root Cause Analysis (Post-Incident)

1. **OAuth Configuration Audit:**
   - Review all registered redirect URIs
   - Verify client ID and secret are correct
   - Check for certificate expiration (if using HTTPS)

2. **Token Management Review:**
   - Audit token refresh logic in `gmailService.ts`
   - Verify refresh tokens are stored securely
   - Check token expiry buffer (should refresh 5 minutes before expiry)

3. **Error Handling Review:**
   - Ensure OAuth errors are logged to Application Insights
   - Add user-friendly error messages
   - Implement retry logic for transient failures

### Resolution Checklist

- [ ] OAuth callback URL verified in Google Cloud Console
- [ ] Client secret is valid and up-to-date
- [ ] Token refresh logic is working
- [ ] Manual OAuth flow test passes
- [ ] All affected users notified to re-connect Gmail
- [ ] Incident report written

**Estimated Resolution Time:** 15-45 minutes

---

## 4. Cosmos DB Throttling

### Trigger Condition
HTTP 429 (Too Many Requests) errors from Cosmos DB

### Symptoms
- Alert: "High Cosmos DB Throttling Rate" (Sev 1)
- Dashboard shows spike in request failures
- Slow API response times
- Users experiencing timeouts

### Immediate Actions (< 5 minutes)

#### Step 1: Check Current RU/s Usage
```bash
# Query Cosmos DB metrics
az monitor metrics list \
  --resource /subscriptions/{sub-id}/resourceGroups/kirana-rg/providers/Microsoft.DocumentDB/databaseAccounts/kirana-cosmos \
  --metric TotalRequestUnits \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Total \
  --interval PT1M
```

**Look For:**
- Sustained RU/s usage near provisioned capacity (400 RU/s default)
- Spikes corresponding to throttling errors

#### Step 2: Identify Hot Partitions
```bash
# Query for partition key with highest request count
az monitor metrics list \
  --resource /subscriptions/{sub-id}/resourceGroups/kirana-rg/providers/Microsoft.DocumentDB/databaseAccounts/kirana-cosmos \
  --metric TotalRequests \
  --dimension PartitionKeyRangeId \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Count
```

**Look For:**
- Single partition receiving >80% of traffic (hot partition)
- Likely culprits: popular household or user with many items

#### Step 3: Review Query Patterns
```bash
# Check for expensive queries without indexes
az monitor app-insights query \
  --app kirana-appinsights \
  --resource-group kirana-rg \
  --analytics-query "dependencies | where name startswith 'Cosmos' | where timestamp >= ago(1h) | where resultCode == '429' | summarize Count = count() by operation_Name | order by Count desc"
```

**Look For:**
- Operations without proper indexes (cross-partition queries)
- Fan-out queries (querying multiple partitions)

### Mitigation Actions (5-30 minutes)

#### Option A: Scale Up RU/s (Immediate Relief)

```bash
# Increase throughput from 400 → 800 RU/s
az cosmosdb sql database throughput update \
  --account-name kirana-cosmos \
  --resource-group kirana-rg \
  --name kirana-db \
  --throughput 800
```

**Cost Impact:** $0.008/hour/RU → $0.192/day (400 RU/s) → $0.384/day (800 RU/s)  
**Resolution Time:** 5-10 minutes for scale-up to complete

**Remember to scale back down** after incident resolves:
```bash
# Scale back to 400 RU/s
az cosmosdb sql database throughput update \
  --account-name kirana-cosmos \
  --resource-group kirana-rg \
  --name kirana-db \
  --throughput 400
```

#### Option B: Add Missing Indexes

If throttling is due to inefficient queries:

```bash
# Update indexing policy for items container
az cosmosdb sql container update \
  --account-name kirana-cosmos \
  --resource-group kirana-rg \
  --database-name kirana-db \
  --name items \
  --idx '{
    "indexingMode": "consistent",
    "automatic": true,
    "includedPaths": [
      {"path": "/*"}
    ],
    "excludedPaths": [
      {"path": "/priceHistory/*"},
      {"path": "/transactions/*"}
    ],
    "compositeIndexes": [
      [
        {"path": "/householdId", "order": "ascending"},
        {"path": "/predictedRunOutDate", "order": "ascending"}
      ]
    ]
  }'
```

**Impact:** Indexing policy changes take 5-15 minutes to apply

#### Option C: Optimize Query Patterns

If hot partition identified:

```bash
# Add cache layer for frequently accessed household
curl -X POST "https://kirana-api.azurewebsites.net/api/admin/cache/household" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"householdId": "<hot-household-id>", "ttl": 3600}'
```

**Expected Result:** Subsequent requests for this household served from Redis cache (0 RU cost)

### Root Cause Analysis (Post-Incident)

1. **Query Optimization Audit:**
   - Review all Cosmos DB queries for proper partition key usage
   - Identify cross-partition queries (most expensive)
   - Add composite indexes for common query patterns

2. **Partition Strategy Review:**
   - Verify `householdId` is effective partition key (should distribute evenly)
   - Check for "mega households" (>100 items)
   - Consider splitting large households into sub-partitions

3. **Caching Strategy:**
   - Implement Redis cache for hot partitions
   - Add ETags for conditional requests (304 Not Modified responses)
   - Use change feed for real-time cache invalidation

### Resolution Checklist

- [ ] RU/s usage is below 80% of provisioned capacity
- [ ] No hot partitions detected
- [ ] Missing indexes identified and added
- [ ] Query patterns optimized
- [ ] RU/s scaled back to baseline (if temporarily increased)
- [ ] Cache layer implemented for hot data
- [ ] Incident report written

**Estimated Resolution Time:** 30-60 minutes

---

## General Incident Response Process

### 1. Detection & Acknowledgment (< 2 minutes)
- Alert fires (email, Slack, SMS)
- On-call engineer acknowledges alert
- Create incident in incident management system (e.g., PagerDuty)

### 2. Initial Assessment (< 5 minutes)
- Review alert details and dashboard
- Determine severity (Sev 1-4)
- Identify affected users/systems
- Post incident announcement in #kirana-incidents Slack channel

### 3. Mitigation (5-30 minutes)
- Follow appropriate runbook
- Apply immediate fixes (throttling, scaling, config changes)
- Provide status updates every 15 minutes

### 4. Resolution (30-60 minutes)
- Verify fix is working
- Monitor metrics for 15 minutes post-fix
- Mark incident as resolved
- Post resolution message in Slack

### 5. Post-Incident Review (24-48 hours)
- Write incident report (5 Whys, timeline, RCA)
- Schedule postmortem (Sev 1 only)
- Create action items to prevent recurrence
- Update runbooks with lessons learned

---

## Escalation Contacts

### On-Call Rotation

| Week | Primary | Secondary | Manager |
|------|---------|-----------|---------|
| 1    | Alice   | Bob       | Charlie |
| 2    | Bob     | Carol     | Charlie |
| 3    | Carol   | Alice     | Charlie |
| 4    | Alice   | Bob       | Charlie |

### Contact Information

**Primary On-Call:**
- Slack: @oncall-primary
- Phone: +1-555-0100
- Response SLA: 5 minutes

**Secondary On-Call:**
- Slack: @oncall-secondary
- Phone: +1-555-0101
- Response SLA: 10 minutes

**Engineering Manager:**
- Slack: @manager-charlie
- Phone: +1-555-0102
- Email: charlie@kirana.com

**VP Engineering:**
- Slack: @vp-eng
- Phone: +1-555-0103
- Email: vp-eng@kirana.com
- Escalate for: Sev 1 incidents lasting >2 hours, data breaches, security incidents

### Escalation Path

1. **Sev 3-4:** Primary on-call → Secondary on-call
2. **Sev 2:** Primary → Secondary → Manager
3. **Sev 1:** Primary → Secondary → Manager → VP Engineering
4. **Security/Data Breach:** Immediately escalate to VP Engineering + CISO

---

## Runbook Maintenance

- **Review Frequency:** Quarterly
- **Owner:** DevOps Team
- **Last Updated:** 2025-11-04
- **Next Review:** 2026-02-01

**Changelog:**
- 2025-11-04: Initial version created
- 2025-11-04: Added all 4 runbooks (LLM cost, prediction accuracy, Gmail OAuth, Cosmos DB)
- 2025-11-04: Added escalation contacts and general incident response process

---

## Related Documentation

- [Azure Dashboard Configuration](../observability/azure-dashboard.md)
- [Application Insights Setup](../../backend/src/utils/appInsights.ts)
- [Cost Control Strategy](../specs/Tech_Spec_Kirana.md#cost-control)
- [Architecture Decision Records](../decisions/)
