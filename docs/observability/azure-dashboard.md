# Kirana Operational Dashboard

This document specifies the Azure Portal dashboard configuration for monitoring Kirana's production environment.

## Dashboard Overview

**Name:** `Kirana Production Monitoring`  
**Resource Group:** `kirana-rg`  
**Application Insights:** `kirana-appinsights`

## Widgets Configuration

### 1. LLM Cost Gauge

**Widget Type:** Metrics Chart (Gauge)  
**Metric:** `customMetrics/llm_cost`  
**Time Range:** Last 24 hours  
**Aggregation:** Sum  
**Display:**
- Daily spend vs $50 cap
- Green: 0-35% ($0-$17.50)
- Yellow: 35-70% ($17.50-$35)
- Red: 70-100% ($35-$50)

**KQL Query:**
```kusto
customMetrics
| where name == "llm_cost"
| where timestamp >= ago(24h)
| summarize TotalCost = sum(value)
| extend BudgetUtilization = (TotalCost / 50.0) * 100
| project TotalCost, BudgetUtilization, BudgetCap = 50.0
```

---

### 2. Parse Job Success Rate

**Widget Type:** Metrics Chart (Line)  
**Metric:** `customEvents/ParseJob`  
**Time Range:** Last 24 hours  
**Aggregation:** Success rate percentage

**KQL Query:**
```kusto
customEvents
| where name == "ParseJob"
| where timestamp >= ago(24h)
| extend Success = tobool(customDimensions.success)
| summarize SuccessCount = countif(Success == true), TotalCount = count() by bin(timestamp, 1h)
| extend SuccessRate = (SuccessCount * 100.0) / TotalCount
| project timestamp, SuccessRate, SuccessCount, TotalCount
| order by timestamp asc
```

---

### 3. Activation Rate (Time-to-Value)

**Widget Type:** Metrics Chart (Line)  
**Metric:** `customMetrics/time_to_first_prediction`  
**Time Range:** Last 7 days  
**Target:** 60% of users within 5 minutes (300 seconds)

**KQL Query:**
```kusto
customMetrics
| where name == "time_to_first_prediction"
| where timestamp >= ago(7d)
| extend MetTarget = value < 300000  // <5 minutes in milliseconds
| summarize TotalUsers = dcount(tostring(customDimensions.userId)), 
            UsersMetTarget = dcountif(tostring(customDimensions.userId), MetTarget) by bin(timestamp, 1d)
| extend ActivationRate = (UsersMetTarget * 100.0) / TotalUsers
| project timestamp, ActivationRate, TotalUsers, UsersMetTarget
| order by timestamp asc
```

---

### 4. Prediction Confidence Distribution

**Widget Type:** Pie Chart  
**Metric:** `customMetrics/prediction_confidence_distribution`  
**Time Range:** Last 24 hours

**KQL Query:**
```kusto
customMetrics
| where name == "prediction_confidence_distribution"
| where timestamp >= ago(24h)
| extend Confidence = tostring(customDimensions.confidence)
| summarize Count = count() by Confidence
| extend Percentage = (Count * 100.0) / toscalar(customMetrics 
    | where name == "prediction_confidence_distribution" 
    | where timestamp >= ago(24h) 
    | count)
| project Confidence, Count, Percentage
| order by Confidence asc
```

---

### 5. Cache Hit Rate

**Widget Type:** Metrics Chart (Gauge)  
**Metric:** `customMetrics/cache_operation`  
**Time Range:** Last 24 hours  
**Target:** ≥25% hit rate (cost control threshold)

**KQL Query:**
```kusto
customMetrics
| where name == "cache_operation"
| where timestamp >= ago(24h)
| extend Operation = tostring(customDimensions.operation)
| summarize HitCount = countif(value == 1), TotalCount = count() by tostring(customDimensions.cacheType)
| extend HitRate = (HitCount * 100.0) / TotalCount
| project CacheType = cacheType, HitRate, HitCount, TotalCount
```

---

### 6. Error Rate (Failed API Calls)

**Widget Type:** Metrics Chart (Area)  
**Metric:** `requests`  
**Time Range:** Last 24 hours  
**Aggregation:** Failed requests per hour

**KQL Query:**
```kusto
requests
| where timestamp >= ago(24h)
| where success == false
| summarize FailedRequests = count() by bin(timestamp, 1h)
| project timestamp, FailedRequests
| order by timestamp asc
```

---

## Alerts Configuration

### Alert 1: LLM Cost Threshold (70%)

**Alert Name:** `High LLM Cost - 70% of Daily Cap`  
**Severity:** Warning (Sev 2)  
**Condition:** Daily LLM cost exceeds $35 (70% of $50 cap)  
**Evaluation Frequency:** Every 5 minutes  
**Look-back Period:** 24 hours  
**Action Group:** `kirana-ops-alerts`

**KQL Query:**
```kusto
customMetrics
| where name == "llm_cost"
| where timestamp >= ago(24h)
| summarize TotalCost = sum(value)
| where TotalCost > 35.0
```

**Alert Actions:**
- Send email to: ops-team@kirana.com
- Post to Slack: #kirana-alerts
- Send SMS to on-call engineer

**Alert Message:**
```
⚠️ High LLM Cost Alert

Daily LLM spend has reached 70% of the budget cap.

Current Spend: ${{TotalCost}}
Budget Cap: $50.00
Utilization: {{(TotalCost / 50.0 * 100)}}%

Action Required:
1. Review recent parse jobs in Application Insights
2. Check for anomalous usage patterns
3. Consider temporarily disabling CSV/photo uploads if needed

Dashboard: https://portal.azure.com/#view/AppInsights/...
Runbook: docs/runbooks/incident-response.md#llm-cost-spike
```

---

### Alert 2: Low Activation Rate

**Alert Name:** `Low Activation Rate - Below 50%`  
**Severity:** Warning (Sev 2)  
**Condition:** Activation rate (time-to-first-prediction <5 min) drops below 50%  
**Evaluation Frequency:** Every 30 minutes  
**Look-back Period:** Last 24 hours  
**Action Group:** `kirana-ops-alerts`

**KQL Query:**
```kusto
customMetrics
| where name == "time_to_first_prediction"
| where timestamp >= ago(24h)
| extend MetTarget = value < 300000
| summarize TotalUsers = dcount(tostring(customDimensions.userId)), 
            UsersMetTarget = dcountif(tostring(customDimensions.userId), MetTarget)
| extend ActivationRate = (UsersMetTarget * 100.0) / TotalUsers
| where ActivationRate < 50.0
```

---

### Alert 3: High Parse Job Failure Rate

**Alert Name:** `Parse Job Failures - Above 10%`  
**Severity:** Error (Sev 1)  
**Condition:** Parse job failure rate exceeds 10% in the last hour  
**Evaluation Frequency:** Every 5 minutes  
**Look-back Period:** 1 hour  
**Action Group:** `kirana-ops-alerts`

**KQL Query:**
```kusto
customEvents
| where name == "ParseJob"
| where timestamp >= ago(1h)
| extend Success = tobool(customDimensions.success)
| summarize SuccessCount = countif(Success == true), TotalCount = count()
| extend FailureRate = ((TotalCount - SuccessCount) * 100.0) / TotalCount
| where FailureRate > 10.0
```

---

### Alert 4: Low Cache Hit Rate

**Alert Name:** `Cache Hit Rate Below Target - <25%`  
**Severity:** Warning (Sev 2)  
**Condition:** Normalization cache hit rate drops below 25%  
**Evaluation Frequency:** Every 15 minutes  
**Look-back Period:** 1 hour  
**Action Group:** `kirana-ops-alerts`

**KQL Query:**
```kusto
customMetrics
| where name == "cache_operation"
| where timestamp >= ago(1h)
| where tostring(customDimensions.cacheType) == "normalization"
| extend Operation = tostring(customDimensions.operation)
| summarize HitCount = countif(value == 1), TotalCount = count()
| extend HitRate = (HitCount * 100.0) / TotalCount
| where HitRate < 25.0
```

---

## Dashboard JSON Export

To create this dashboard programmatically, use the following ARM template:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "dashboardName": {
      "type": "string",
      "defaultValue": "kirana-production-monitoring"
    }
  },
  "resources": [
    {
      "type": "Microsoft.Portal/dashboards",
      "apiVersion": "2020-09-01-preview",
      "name": "[parameters('dashboardName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "lenses": [
          {
            "order": 0,
            "parts": [
              {
                "position": { "x": 0, "y": 0, "colSpan": 4, "rowSpan": 4 },
                "metadata": {
                  "type": "Extension/AppInsightsExtension/PartType/MetricsChartPart",
                  "settings": {
                    "title": "LLM Cost (24h)",
                    "chartType": "Gauge",
                    "metrics": [
                      {
                        "resourceId": "/subscriptions/{subscription-id}/resourceGroups/kirana-rg/providers/microsoft.insights/components/kirana-appinsights",
                        "name": "llm_cost",
                        "aggregationType": "Sum",
                        "namespace": "customMetrics"
                      }
                    ]
                  }
                }
              },
              {
                "position": { "x": 4, "y": 0, "colSpan": 8, "rowSpan": 4 },
                "metadata": {
                  "type": "Extension/AppInsightsExtension/PartType/MetricsChartPart",
                  "settings": {
                    "title": "Parse Job Success Rate (24h)",
                    "chartType": "Line"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## Data Retention

- **Application Insights Data:** 90 days (standard retention)
- **Custom Metrics:** 90 days
- **Logs:** 90 days
- **Dashboard History:** Unlimited (configuration only)

---

## Access Control

**Role Assignments:**
- **Kirana Engineers:** Reader (view dashboard + metrics)
- **DevOps Team:** Contributor (edit dashboard + alerts)
- **On-Call Engineers:** Reader + Alert responder

---

## Deployment Instructions

1. **Create Application Insights resource:**
   ```bash
   az monitor app-insights component create \
     --app kirana-appinsights \
     --location eastus \
     --resource-group kirana-rg \
     --application-type web
   ```

2. **Create dashboard from ARM template:**
   ```bash
   az deployment group create \
     --resource-group kirana-rg \
     --template-file dashboard-template.json
   ```

3. **Configure alert action group:**
   ```bash
   az monitor action-group create \
     --name kirana-ops-alerts \
     --resource-group kirana-rg \
     --short-name kiranaops \
     --email-receiver ops ops-team@kirana.com \
     --sms-receiver oncall +1-555-0100
   ```

4. **Create alerts:**
   ```bash
   # Create each alert using the KQL queries above
   az monitor scheduled-query create \
     --name "High LLM Cost" \
     --resource-group kirana-rg \
     --scopes /subscriptions/{sub-id}/resourceGroups/kirana-rg/providers/microsoft.insights/components/kirana-appinsights \
     --condition "count 'TotalCost' > 35" \
     --condition-query "customMetrics | where name == 'llm_cost' | where timestamp >= ago(24h) | summarize TotalCost = sum(value)" \
     --description "Alert when daily LLM cost exceeds 70% of cap" \
     --evaluation-frequency 5m \
     --window-size 24h \
     --severity 2 \
     --action-groups /subscriptions/{sub-id}/resourceGroups/kirana-rg/providers/microsoft.insights/actionGroups/kirana-ops-alerts
   ```

---

## Dashboard URL

Once deployed, the dashboard will be accessible at:

```
https://portal.azure.com/#@{tenant-id}/dashboard/arm/subscriptions/{subscription-id}/resourceGroups/kirana-rg/providers/Microsoft.Portal/dashboards/kirana-production-monitoring
```

---

## Maintenance

- **Review dashboard weekly:** Adjust thresholds based on production metrics
- **Update alerts quarterly:** Refine alert conditions to reduce noise
- **Archive old dashboards:** Keep historical snapshots for postmortems
- **Test alerts monthly:** Trigger test alerts to verify action groups work

---

## Related Documentation

- [Application Insights Integration](../backend/src/utils/appInsights.ts)
- [Incident Response Runbooks](../runbooks/incident-response.md)
- [Cost Control Strategy](../specs/Tech_Spec_Kirana.md#cost-control)
