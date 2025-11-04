# Production Deployment Runbook

**Project:** Kirana - Smart Grocery Inventory Tracker  
**Phase:** Production Launch  
**Date Created:** November 3, 2025  
**Last Updated:** November 3, 2025

---

## 1. Overview

### Purpose
Step-by-step guide for deploying Kirana to production with zero downtime, comprehensive pre-checks, and rollback procedures.

### Deployment Strategy
- **Blue-Green Deployment:** Use Azure Functions deployment slots (staging → production swap)
- **Canary Release:** Route 10% of traffic to new version first, then 100% if healthy
- **Zero Downtime:** Leverage slot swapping (DNS cutover in <1 second)
- **Rollback Time:** <5 minutes (swap back to previous slot)

### Environments

| Environment | Purpose | URL | Azure Resources |
|-------------|---------|-----|-----------------|
| **Development** | Local dev | http://localhost:7071 | Cosmos DB Emulator |
| **Staging** | Pre-prod testing | https://kirana-api-staging.azurewebsites.net | Shared dev Cosmos DB |
| **Production** | Live users | https://api.kirana.io | Production Cosmos DB |

---

## 2. Pre-Deployment Checklist

### 2.1 Code Quality

- [ ] **All Tests Passing**
  ```bash
  # Backend
  cd backend && npm test
  # Expected: 0 failures, >80% coverage
  
  # Frontend
  cd frontend && npm test
  # Expected: 0 failures, >80% coverage
  ```

- [ ] **No TypeScript Errors**
  ```bash
  cd backend && npm run type-check
  cd frontend && npm run type-check
  ```

- [ ] **Linting Clean**
  ```bash
  cd backend && npm run lint
  cd frontend && npm run lint
  ```

- [ ] **Build Successful**
  ```bash
  cd backend && npm run build
  cd frontend && npm run build
  ```

### 2.2 Security & Compliance

- [ ] **Security Audit Completed**
  - OWASP ZAP scan passed (0 high/critical vulnerabilities)
  - Azure Secure Score ≥80/100
  - Secrets moved to Key Vault (no hardcoded keys)
  - Dependabot PRs reviewed and merged

- [ ] **Load Testing Passed**
  - Normal load: p95 <500ms, error rate <0.1%
  - Peak load: 500 concurrent users, <1% errors
  - Spike test: No 500 errors
  - See: `docs/testing/load-test-results.md`

- [ ] **UAT Success Criteria Met**
  - Activation rate ≥60%
  - Day 7 retention ≥40%
  - Prediction accuracy ≥70% (survey)
  - SUS score ≥70
  - Critical bugs <5
  - See: `docs/testing/uat-retrospective.md`

### 2.3 Infrastructure

- [ ] **Production Cosmos DB Ready**
  ```bash
  # Verify containers exist
  az cosmosdb sql container list \
    --account-name kirana-cosmosdb-prod \
    --database-name kirana-db \
    --resource-group kirana-prod-rg
  
  # Expected containers: users, items, transactions, predictions
  ```

- [ ] **Indexes Created**
  ```bash
  # Apply indexing policy
  az cosmosdb sql container update \
    --account-name kirana-cosmosdb-prod \
    --database-name kirana-db \
    --name items \
    --resource-group kirana-prod-rg \
    --idx @indexing-policy.json
  ```

- [ ] **Key Vault Secrets Configured**
  ```bash
  # Verify secrets exist
  az keyvault secret list \
    --vault-name kirana-keyvault-prod \
    --output table
  
  # Expected secrets:
  # - cosmos-connection-string
  # - gemini-api-key
  # - storage-connection-string
  # - application-insights-key
  ```

- [ ] **Application Insights Configured**
  ```bash
  # Verify instrumentation key
  az monitor app-insights component show \
    --app kirana-app-insights-prod \
    --resource-group kirana-prod-rg \
    --query instrumentationKey
  ```

- [ ] **Custom Domain & SSL**
  ```bash
  # Verify SSL certificate
  curl -I https://api.kirana.io
  # Expected: HTTP/2 200, Valid SSL cert
  
  # Verify DNS records
  dig api.kirana.io
  # Expected: CNAME to kirana-functions.azurewebsites.net
  ```

- [ ] **Backup Strategy Tested**
  ```bash
  # Verify point-in-time restore enabled
  az cosmosdb show \
    --name kirana-cosmosdb-prod \
    --resource-group kirana-prod-rg \
    --query backupPolicy
  
  # Expected: continuousMode enabled, retentionHours: 720 (30 days)
  ```

### 2.4 Monitoring & Alerts

- [ ] **Azure Monitor Alerts Configured**
  ```bash
  # List alerts
  az monitor metrics alert list \
    --resource-group kirana-prod-rg \
    --output table
  
  # Expected alerts:
  # - High error rate (>10 errors in 5 min)
  # - LLM budget warning (>$45/day)
  # - Cosmos DB RU throttling (>400 RU/s)
  # - Functions App high CPU (>80%)
  ```

- [ ] **Slack Webhooks Configured**
  ```bash
  # Test Slack alert
  curl -X POST $SLACK_WEBHOOK_PROD \
    -H "Content-Type: application/json" \
    -d '{"text": "🚀 Deployment test from runbook"}'
  ```

- [ ] **PagerDuty On-Call Rotation**
  - Verify current on-call engineer
  - Test PagerDuty integration (trigger test alert)

### 2.5 Deployment Readiness

- [ ] **Deployment Window Scheduled**
  - Preferred: Tuesday-Thursday, 10 AM - 2 PM PT (low traffic)
  - Avoid: Friday, weekends, holidays

- [ ] **Stakeholders Notified**
  - Product Manager: Informed of deployment timeline
  - Customer Support: Ready to handle potential user issues
  - Marketing: Aware of launch date (if public announcement)

- [ ] **Rollback Plan Reviewed**
  - Team familiar with rollback procedure
  - Backup engineer available for support

---

## 3. Deployment Steps

### 3.1 Pre-Deployment (1 hour before)

**1. Verify Staging Environment**
```bash
# Run smoke tests on staging
curl -X GET https://kirana-api-staging.azurewebsites.net/api/health
# Expected: { "status": "healthy" }

curl -X GET https://kirana-api-staging.azurewebsites.net/api/items \
  -H "Authorization: Bearer $TEST_TOKEN"
# Expected: 200 OK
```

**2. Tag Release**
```bash
# Tag current commit as production release
git tag -a v1.0.0 -m "Production Release v1.0.0 - November 3, 2025"
git push origin v1.0.0
```

**3. Create GitHub Release**
```bash
# Generate release notes
gh release create v1.0.0 \
  --title "Kirana v1.0.0 - Production Launch" \
  --notes "$(git log $(git describe --tags --abbrev=0 v0.9.0)..HEAD --pretty=format:'- %s')"
```

---

### 3.2 Backend Deployment (15 minutes)

**Step 1: Deploy to Staging Slot**
```bash
# Navigate to backend
cd backend

# Install dependencies (clean install)
npm ci

# Build production bundle
npm run build

# Deploy to staging slot
func azure functionapp publish kirana-functions --slot staging

# Wait for deployment to complete (~2-3 minutes)
echo "Waiting for staging deployment..."
sleep 180
```

**Step 2: Run Smoke Tests on Staging**
```bash
# Health check
curl https://kirana-functions-staging.azurewebsites.net/api/health

# Test GET /items
curl -X GET https://kirana-functions-staging.azurewebsites.net/api/items \
  -H "Authorization: Bearer $PROD_TEST_TOKEN"

# Test POST /items
curl -X POST https://kirana-functions-staging.azurewebsites.net/api/items \
  -H "Authorization: Bearer $PROD_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deployment Smoke Test Item",
    "quantity": 1,
    "category": "PANTRY"
  }'

# Test predictions
curl -X POST https://kirana-functions-staging.azurewebsites.net/api/predictions/calculate \
  -H "Authorization: Bearer $PROD_TEST_TOKEN"

# All tests should return 200/201 with valid JSON
```

**Step 3: Swap Staging → Production**
```bash
# Perform slot swap (zero-downtime)
az functionapp deployment slot swap \
  --name kirana-functions \
  --resource-group kirana-prod-rg \
  --slot staging

# Swap completes in ~30 seconds
echo "Waiting for swap to complete..."
sleep 30
```

**Step 4: Verify Production Deployment**
```bash
# Health check on production
curl https://api.kirana.io/health
# Expected: { "status": "healthy", "version": "1.0.0" }

# Check Functions App logs
az functionapp log tail \
  --name kirana-functions \
  --resource-group kirana-prod-rg
```

---

### 3.3 Frontend Deployment (10 minutes)

**Step 1: Build Production Bundle**
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm ci

# Set production environment variables
export VITE_API_URL=https://api.kirana.io
export VITE_AZURE_AD_CLIENT_ID=$PROD_CLIENT_ID
export VITE_AZURE_AD_TENANT_ID=$PROD_TENANT_ID

# Build
npm run build
# Output: frontend/dist/
```

**Step 2: Deploy to Azure Static Web App**
```bash
# Using Azure CLI
az staticwebapp update \
  --name kirana-webapp \
  --resource-group kirana-prod-rg \
  --source ./dist

# Or using GitHub Actions (automatic on main push)
# git push origin main
```

**Step 3: Verify Frontend Deployment**
```bash
# Check deployment status
az staticwebapp show \
  --name kirana-webapp \
  --resource-group kirana-prod-rg \
  --query "defaultHostname"

# Test in browser
open https://app.kirana.io

# Manual checks:
# - ✅ Page loads without errors
# - ✅ Login redirects to Azure AD B2C
# - ✅ Dashboard loads items
# - ✅ Can add new item
# - ✅ Predictions display correctly
```

---

### 3.4 DNS & CDN (5 minutes)

**Step 1: Update DNS Records**
```bash
# Verify CNAME records point to production
dig app.kirana.io
# Expected: CNAME to kirana-webapp.azurestaticapps.net

dig api.kirana.io
# Expected: CNAME to kirana-functions.azurewebsites.net
```

**Step 2: Purge CDN Cache (if using Azure CDN)**
```bash
az cdn endpoint purge \
  --resource-group kirana-prod-rg \
  --profile-name kirana-cdn \
  --name kirana-cdn-endpoint \
  --content-paths "/*"
```

---

### 3.5 Post-Deployment Monitoring (1 hour)

**Step 1: Monitor Application Insights**
```bash
# Open Azure Portal
open "https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/ApplicationInsightsInsightsV2/componentId/%2Fsubscriptions%2F{subscriptionId}%2FresourceGroups%2Fkirana-prod-rg%2Fproviders%2Fmicrosoft.insights%2Fcomponents%2Fkirana-app-insights-prod"

# Watch for:
# - Error rate spike (should be <0.1%)
# - Response time increase (p95 should be <500ms)
# - Failed requests (investigate any 500 errors)
```

**Step 2: Check Real-Time Metrics**
```kusto
// Query in Application Insights Logs
requests
| where timestamp > ago(15m)
| summarize
    count(),
    avg(duration),
    percentile(duration, 95),
    countif(success == false)
  by name
| order by count_ desc
```

**Step 3: Verify Cosmos DB Health**
```bash
# Check RU/s consumption
az monitor metrics list \
  --resource /subscriptions/{subscriptionId}/resourceGroups/kirana-prod-rg/providers/Microsoft.DocumentDB/databaseAccounts/kirana-cosmosdb-prod \
  --metric "TotalRequestUnits" \
  --interval PT1M \
  --start-time $(date -u -v-15M +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Should be <400 RU/s
```

**Step 4: Manual User Flow Test**
```
1. Open https://app.kirana.io in incognito window
2. Click "Sign Up" → Complete Azure AD B2C registration
3. Upload test CSV (10 items)
4. Review micro-review screen
5. Accept all items
6. View dashboard → Verify predictions displayed
7. Click item → Update restock date
8. Verify prediction updated
9. Log out → Log back in → Data persists
```

**Step 5: Check Slack Alerts**
- No critical alerts in #kirana-prod channel
- Cost monitoring running normally
- Performance gates show green

---

## 4. Rollback Procedure

**When to Rollback:**
- ❌ Error rate >1% for >5 minutes
- ❌ Critical feature broken (login, dashboard, predictions)
- ❌ Database corruption detected
- ❌ Severe performance degradation (p95 >2 seconds)

**Rollback Steps (5 minutes):**

### 4.1 Backend Rollback

```bash
# Swap production slot back to previous version
az functionapp deployment slot swap \
  --name kirana-functions \
  --resource-group kirana-prod-rg \
  --slot staging \
  --target-slot production

# Verify rollback
curl https://api.kirana.io/health
# Should return previous version number
```

### 4.2 Frontend Rollback

```bash
# Rollback to previous commit
git revert HEAD --no-edit
git push origin main

# Or restore previous deployment
az staticwebapp deployment show \
  --name kirana-webapp \
  --resource-group kirana-prod-rg

az staticwebapp deployment activate \
  --name kirana-webapp \
  --resource-group kirana-prod-rg \
  --deployment-id $PREVIOUS_DEPLOYMENT_ID
```

### 4.3 Database Rollback (If Data Corruption)

```bash
# Restore Cosmos DB from backup (point-in-time)
# WARNING: This will revert ALL data to a previous state

az cosmosdb sql database restore \
  --account-name kirana-cosmosdb-prod \
  --name kirana-db \
  --resource-group kirana-prod-rg \
  --restore-timestamp "2025-11-03T10:00:00Z" # 1 hour before deployment

# Verify data integrity
# Manual check: Log into app, verify items and predictions
```

### 4.4 Notify Stakeholders

```bash
# Send Slack alert
curl -X POST $SLACK_WEBHOOK_PROD \
  -H "Content-Type: application/json" \
  -d '{
    "text": "🚨 ROLLBACK EXECUTED: Production deployment v1.0.0 rolled back due to [reason]",
    "attachments": [{
      "color": "danger",
      "text": "Current version: v0.9.5\nAction: Investigate and create hotfix"
    }]
  }'

# Update status page (if public)
# https://status.kirana.io
```

---

## 5. Post-Deployment Tasks

### 5.1 Immediate (Within 1 hour)

- [ ] **Monitor for 1 hour post-deployment**
  - Watch Application Insights for errors
  - Check user feedback channels (email, Slack, social media)

- [ ] **Update Documentation**
  - Mark deployment as complete in project tracker
  - Update `CHANGELOG.md` with release notes

- [ ] **Notify Team**
  ```bash
  # Slack announcement
  curl -X POST $SLACK_WEBHOOK_TEAM \
    -H "Content-Type: application/json" \
    -d '{
      "text": "🚀 Kirana v1.0.0 is LIVE!",
      "attachments": [{
        "color": "good",
        "text": "Production URL: https://app.kirana.io\nAPI: https://api.kirana.io\nStatus: All systems operational"
      }]
    }'
  ```

### 5.2 Within 24 Hours

- [ ] **Review Metrics**
  - Compare production metrics to staging (response time, error rate)
  - Verify cost monitoring (LLM budget not exceeded)
  - Check user signup rate and activation rate

- [ ] **User Communication**
  - Send email to beta testers: "We're live! Thanks for your feedback"
  - Post on social media (Twitter, ProductHunt)
  - Update website homepage with "Live Now" banner

### 5.3 Within 1 Week

- [ ] **Post-Deployment Retrospective**
  - **What went well:** Smooth deployment, no downtime, metrics stable
  - **What went wrong:** [Any issues encountered]
  - **Action items:** [Improvements for next deployment]
  - Document in: `docs/retrospectives/v1.0.0-deployment.md`

- [ ] **Performance Review**
  - Compare actual production load to load test estimates
  - Identify optimization opportunities
  - Plan capacity scaling if needed

- [ ] **User Feedback Collection**
  - Send post-launch survey to first 100 users
  - Monitor support tickets (categorize by type)
  - Track feature requests (add to product backlog)

---

## 6. Troubleshooting

### Issue 1: Functions App Not Responding (502 Bad Gateway)

**Symptoms:** API returns 502 or 503 errors

**Diagnosis:**
```bash
# Check Functions App status
az functionapp show \
  --name kirana-functions \
  --resource-group kirana-prod-rg \
  --query state

# Check logs
az functionapp log tail \
  --name kirana-functions \
  --resource-group kirana-prod-rg
```

**Fix:**
```bash
# Restart Functions App
az functionapp restart \
  --name kirana-functions \
  --resource-group kirana-prod-rg

# If persists, rollback (see Section 4)
```

---

### Issue 2: Cosmos DB Throttling (429 Errors)

**Symptoms:** High latency, 429 errors in logs

**Diagnosis:**
```bash
# Check RU/s consumption
az monitor metrics list \
  --resource /subscriptions/{subscriptionId}/resourceGroups/kirana-prod-rg/providers/Microsoft.DocumentDB/databaseAccounts/kirana-cosmosdb-prod \
  --metric "TotalRequestUnits" \
  --interval PT1M
```

**Fix:**
```bash
# Temporarily increase throughput
az cosmosdb sql database throughput update \
  --account-name kirana-cosmosdb-prod \
  --name kirana-db \
  --resource-group kirana-prod-rg \
  --throughput 800 # Double from 400

# Enable autoscale (long-term fix)
az cosmosdb sql database throughput update \
  --account-name kirana-cosmosdb-prod \
  --name kirana-db \
  --resource-group kirana-prod-rg \
  --max-throughput 4000 # Autoscale 400-4000 RU/s
```

---

### Issue 3: High Error Rate (>1%)

**Symptoms:** Application Insights shows spike in failed requests

**Diagnosis:**
```kusto
// Query in Application Insights
exceptions
| where timestamp > ago(15m)
| summarize count() by type, outerMessage
| order by count_ desc
```

**Fix:**
- If errors are from specific endpoint: Disable feature flag (if available)
- If errors are widespread: Rollback immediately (Section 4)
- If errors are transient: Monitor for 5 minutes, rollback if persists

---

### Issue 4: LLM Budget Exceeded

**Symptoms:** CSV imports failing with "Budget exceeded" error

**Diagnosis:**
```kusto
// Check LLM cost today
customMetrics
| where name == "llm_cost"
| where timestamp > startofday(now())
| summarize sum(value)
```

**Fix:**
```bash
# Temporarily increase budget cap (emergency only)
az functionapp config appsettings set \
  --name kirana-functions \
  --resource-group kirana-prod-rg \
  --settings DAILY_BUDGET_CAP=100

# Long-term: Optimize LLM usage, add caching
```

---

### Issue 5: Frontend Not Loading

**Symptoms:** Blank page, console errors

**Diagnosis:**
```bash
# Check Static Web App status
az staticwebapp show \
  --name kirana-webapp \
  --resource-group kirana-prod-rg \
  --query "status"

# Check browser console for errors
# Open https://app.kirana.io → F12 Developer Tools → Console
```

**Fix:**
```bash
# Rollback frontend (Section 4.2)
# Or purge CDN cache
az cdn endpoint purge \
  --resource-group kirana-prod-rg \
  --profile-name kirana-cdn \
  --name kirana-cdn-endpoint \
  --content-paths "/*"
```

---

## 7. Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|------------|
| **On-Call Engineer** | [Current on-call] | [Phone] | 24/7 via PagerDuty |
| **Lead Engineer** | [Your Name] | [Phone] | Mon-Fri 9 AM - 6 PM PT |
| **DevOps Lead** | [Name] | [Phone] | Mon-Fri 9 AM - 6 PM PT |
| **Product Manager** | [Name] | [Email] | Mon-Fri 9 AM - 6 PM PT |
| **CTO** | [Name] | [Phone] | Escalation only |

**Escalation Path:**
1. On-Call Engineer (immediate)
2. Lead Engineer (if on-call unavailable)
3. DevOps Lead (infrastructure issues)
4. CTO (critical outage >1 hour)

---

## 8. Deployment History

| Version | Date | Deployed By | Status | Rollback? | Notes |
|---------|------|-------------|--------|-----------|-------|
| v1.0.0 | Nov 3, 2025 | [Your Name] | ✅ Success | No | Initial production launch |
| v1.0.1 | Nov 10, 2025 | [Name] | ✅ Success | No | Hotfix: CSV parsing bug |
| v1.1.0 | Nov 17, 2025 | [Name] | ⚠️ Partial | Yes | Rolled back due to high error rate |

---

## 9. Deployment Metrics

**Target:** <15 minutes total deployment time (backend + frontend)

**Actual Deployment Times:**

| Deployment | Backend | Frontend | Total | Rollback Time |
|------------|---------|----------|-------|---------------|
| v1.0.0 | 8 min | 5 min | 13 min | N/A |
| v1.0.1 | 7 min | 4 min | 11 min | N/A |
| v1.1.0 | 9 min | 6 min | 15 min | 3 min (rollback) |

---

## Appendix A: Smoke Test Checklist

**Manual Tests (5 minutes):**

- [ ] **Health Endpoint**
  ```bash
  curl https://api.kirana.io/health
  # Expected: { "status": "healthy" }
  ```

- [ ] **Authentication**
  - [ ] Sign up new user → Redirects to Azure AD B2C → Success
  - [ ] Log in existing user → Redirects to dashboard → Success

- [ ] **Dashboard**
  - [ ] Dashboard loads items → Shows ≥1 item
  - [ ] Predictions displayed → Shows "Runs out in X days"
  - [ ] Urgency colors correct → Red (≤3d), Yellow (4-7d), Green (>7d)

- [ ] **Add Item**
  - [ ] Click "Add Item" → Form opens
  - [ ] Fill form → Submit → Item appears in dashboard

- [ ] **CSV Import**
  - [ ] Upload test CSV (10 items) → Parsing starts
  - [ ] Micro-review screen → Shows parsed items with confidence
  - [ ] Accept all → Items added to dashboard

- [ ] **Teach Mode**
  - [ ] Click "Teach" on item → Form opens
  - [ ] Update consumption rate → Submit → Prediction updates

- [ ] **Restock**
  - [ ] Click item → "Log Restock" → Submit
  - [ ] Prediction updates → "Runs out" date extends

---

## Appendix B: Rollback Decision Matrix

| Severity | Error Rate | Response Time | User Impact | Action |
|----------|------------|---------------|-------------|--------|
| **P0 - Critical** | >10% | >5s | Login broken | **Immediate rollback** |
| **P1 - High** | 1-10% | 2-5s | Major feature broken | Rollback within 15 min |
| **P2 - Medium** | 0.1-1% | 1-2s | Minor feature broken | Monitor for 30 min, then rollback |
| **P3 - Low** | <0.1% | <1s | Cosmetic issues | No rollback, fix in next release |

---

**Last Updated:** November 3, 2025  
**Owner:** DevOps + Engineering Team  
**Status:** Ready for Production Deployment
