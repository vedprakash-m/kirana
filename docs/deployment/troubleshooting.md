# Deployment Troubleshooting Guide

## Quick Diagnostics

Run this to check your setup:

```bash
# Check if infrastructure is configured
source infrastructure-config.sh 2>/dev/null && echo "✅ Config loaded" || echo "❌ Run setup-infrastructure.sh first"

# Check if Azure CLI is logged in
az account show &>/dev/null && echo "✅ Azure CLI logged in" || echo "❌ Run: az login"

# Check if GitHub secrets are set
gh secret list 2>/dev/null || echo "❌ Run: setup-github-secrets.sh"

# Check resource group
az group show --name rg-kirana &>/dev/null && echo "✅ Resource group exists" || echo "❌ Infrastructure not created"

# Check Function App
az functionapp show --name func-kirana --resource-group rg-kirana &>/dev/null && echo "✅ Function App exists" || echo "❌ Function App missing"

# Check Static Web App  
az staticwebapp show --name swa-kirana --resource-group rg-kirana &>/dev/null && echo "✅ Static Web App exists" || echo "❌ Static Web App missing"
```

---

## Common Issues

### 1. Infrastructure Setup Fails

#### Problem: "Azure CLI not installed"
```
❌ Azure CLI is not installed.
```

**Solution**:
```bash
# macOS
brew install azure-cli

# Or download from:
# https://docs.microsoft.com/cli/azure/install-azure-cli
```

#### Problem: "Login failed"
```
ERROR: Please run 'az login' to setup account.
```

**Solution**:
```bash
az login
# Follow browser prompt to authenticate
```

#### Problem: "Resource name already exists"
```
ERROR: The resource name 'cosmos-kirana-xyz' is already in use.
```

**Solution**:
The script generates random suffixes, but you might have orphaned resources.

```bash
# List existing resources
az resource list --resource-group rg-kirana --output table

# Option 1: Delete old resources
az group delete --name rg-kirana --yes

# Option 2: Use different names in script
# Edit scripts/setup-infrastructure.sh:
COSMOS_ACCOUNT="cosmos-kirana-new-$(openssl rand -hex 3)"
```

#### Problem: "Insufficient permissions"
```
ERROR: The client does not have authorization to perform action...
```

**Solution**:
You need Contributor or Owner role on the subscription.

```bash
# Check your role
az role assignment list --assignee $(az account show --query user.name -o tsv) --output table

# If you don't have permissions, ask subscription owner to grant:
az role assignment create \
  --role "Contributor" \
  --assignee "your-email@example.com" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

---

### 2. GitHub Secrets Setup Fails

#### Problem: "GitHub CLI not authenticated"
```
To get started with GitHub CLI, please run: gh auth login
```

**Solution**:
```bash
gh auth login
# Choose: GitHub.com → HTTPS → Login with browser
```

#### Problem: "Repository not found"
```
ERROR: Could not resolve to a Repository
```

**Solution**:
Make sure you're in the repository directory:
```bash
cd /Users/ved/Apps/kirana
git remote -v  # Verify repository
gh repo view   # Should show vedprakash-m/kirana
```

#### Problem: "Permission denied to set secrets"
```
HTTP 403: Resource not accessible by integration
```

**Solution**:
You need write access to the repository.

```bash
# Check your permissions
gh api repos/vedprakash-m/kirana --jq '.permissions'

# If you're not the owner, ask for permission or fork the repo
```

#### Problem: "Failed to get Static Web Apps token"
```
❌ Failed to get Static Web Apps token
```

**Solution**:
```bash
# Manually retrieve token
source infrastructure-config.sh

az staticwebapp secrets list \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP

# If command fails, check if SWA exists
az staticwebapp show \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP
```

---

### 3. Deployment Workflow Fails

#### Problem: "Secret not found"
```
Error: Secret AZURE_STATIC_WEB_APPS_API_TOKEN not found
```

**Solution**:
```bash
# Verify secrets are set
gh secret list

# Re-run setup if missing
./scripts/setup-github-secrets.sh

# Or add manually
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
# Paste token when prompted
```

#### Problem: "Backend deployment failed"
```
Error: Failed to deploy to Azure Functions
```

**Solution**:
```bash
# Check Function App status
az functionapp show \
  --name func-kirana \
  --resource-group rg-kirana \
  --query state -o tsv

# Check logs
az functionapp log tail \
  --name func-kirana \
  --resource-group rg-kirana

# Try manual deployment
cd backend
npm ci && npm run build
func azure functionapp publish func-kirana

# If that works, check publish profile secret
az functionapp deployment list-publishing-profiles \
  --name func-kirana \
  --resource-group rg-kirana \
  --xml
# Update GitHub secret with output
```

#### Problem: "Frontend deployment failed"
```
Error: Failed to upload to Azure Static Web Apps
```

**Solution**:
```bash
# Verify SWA token
az staticwebapp secrets list \
  --name swa-kirana \
  --resource-group rg-kirana

# Check SWA status
az staticwebapp show \
  --name swa-kirana \
  --resource-group rg-kirana \
  --query 'state' -o tsv

# Try manual deployment
cd frontend
npm ci --legacy-peer-deps
npm run build
npx @azure/static-web-apps-cli deploy \
  --deployment-token "YOUR_TOKEN" \
  --app-location dist
```

#### Problem: "Health check failed"
```
⚠️ Health check failed
```

**Solution**:
This might be expected if you haven't implemented the `/api/health` endpoint.

```bash
# Check if backend is actually running
curl https://func-kirana.azurewebsites.net/api/items

# If working, update workflow to skip health check or implement endpoint:
# backend/src/functions/health.ts
```

---

### 4. Application Runtime Issues

#### Problem: "CORS error in browser"
```
Access to fetch at 'https://func-kirana.azurewebsites.net/api/items' 
from origin 'https://...' has been blocked by CORS policy
```

**Solution**:
```bash
source infrastructure-config.sh

# Check current CORS settings
az functionapp cors show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP

# Add your SWA hostname
az functionapp cors add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://$SWA_HOSTNAME"

# For development, add localhost
az functionapp cors add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "http://localhost:5173"
```

#### Problem: "Function returns 500 error"
```
{"error": "Internal Server Error"}
```

**Solution**:
```bash
# Check logs
az functionapp log tail \
  --name func-kirana \
  --resource-group rg-kirana

# Check Application Insights
az monitor app-insights query \
  --app appi-kirana \
  --analytics-query "
    traces 
    | where timestamp > ago(1h) 
    | where severityLevel >= 3
    | order by timestamp desc
  "

# Common issues:
# 1. Missing environment variables
az functionapp config appsettings list \
  --name func-kirana \
  --resource-group rg-kirana

# 2. Cosmos DB connection
# Verify Key Vault reference is working
az functionapp config appsettings show \
  --name func-kirana \
  --resource-group rg-kirana \
  --setting-names COSMOS_ENDPOINT COSMOS_KEY
```

#### Problem: "Cosmos DB 'unauthorized' error"
```
{"code":401,"body":"Unauthorized: The input authorization token can't serve the request"}
```

**Solution**:
```bash
source infrastructure-config.sh

# Check if managed identity has Key Vault access
az keyvault show \
  --name $KEY_VAULT \
  --query properties.accessPolicies

# Re-grant access
FUNCTION_IDENTITY=$(az functionapp identity show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

az keyvault set-policy \
  --name $KEY_VAULT \
  --object-id $FUNCTION_IDENTITY \
  --secret-permissions get list

# Restart Function App
az functionapp restart \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP
```

#### Problem: "API returns empty data"
```
GET /api/items → []
```

**Solution**:
```bash
# Check Cosmos DB containers exist
az cosmosdb sql container list \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --database-name kirana

# If missing, recreate them
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --database-name kirana \
  --name items \
  --partition-key-path "/userId"

# Check if database has data
az cosmosdb sql database show \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --name kirana
```

---

### 5. Cost Issues

#### Problem: "Unexpected charges"
```
Azure bill higher than expected
```

**Solution**:
```bash
# Check cost breakdown
az consumption usage list \
  --start-date $(date -u -d '30 days ago' '+%Y-%m-%d') \
  --end-date $(date -u '+%Y-%m-%d') \
  | jq '[.[] | {date: .usageStart, cost: .pretaxCost, service: .meterDetails.meterName}]' \
  | jq 'group_by(.service) | map({service: .[0].service, total: map(.cost | tonumber) | add})'

# Check for:
# 1. Cosmos DB over-usage
az monitor metrics list \
  --resource $(az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query id -o tsv) \
  --metric "TotalRequests" \
  --start-time $(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%S') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%S') \
  --interval PT1H

# 2. Function execution count
az monitor metrics list \
  --resource $(az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --query id -o tsv) \
  --metric "FunctionExecutionCount" \
  --start-time $(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%S') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%S') \
  --interval PT1H

# Set budget alert if not already done
# Go to: Azure Portal → Cost Management + Billing → Budgets
```

---

### 6. Development Issues

#### Problem: "Local development not working"
```
Cannot connect to Cosmos DB from localhost
```

**Solution**:
```bash
# Option 1: Use Cosmos DB Emulator
# Download from: https://aka.ms/cosmosdb-emulator

# Option 2: Allow firewall access
az cosmosdb update \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --enable-public-network true

# Get your IP
MY_IP=$(curl -s ifconfig.me)

# Add firewall rule
az cosmosdb update \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --ip-range-filter "$MY_IP"

# Update local.settings.json with real connection strings
source infrastructure-config.sh
az keyvault secret show --vault-name $KEY_VAULT --name CosmosKey --query value -o tsv
```

#### Problem: "npm install fails"
```
npm ERR! peer dependency issues
```

**Solution**:
```bash
# Frontend (uses --legacy-peer-deps)
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Backend
cd backend  
rm -rf node_modules package-lock.json
npm install
```

---

## Emergency Procedures

### Complete Reset
```bash
# Delete everything and start over
az group delete --name rg-kirana --yes --no-wait

# Wait for deletion to complete (check in portal or):
az group show --name rg-kirana
# Should return: ResourceGroupNotFound

# Re-run setup
./scripts/setup-infrastructure.sh
./scripts/setup-github-secrets.sh
```

### Rollback Deployment
```bash
# Find previous deployment
az functionapp deployment list \
  --name func-kirana \
  --resource-group rg-kirana

# There's no built-in rollback for publish profiles
# Instead, redeploy previous commit:
git checkout HEAD~1
git push origin main --force
```

### Emergency Contact
```bash
# Get resource IDs for support ticket
az resource list \
  --resource-group rg-kirana \
  --query '[].{Name:name, Type:type, ID:id}' \
  --output table

# Export all configuration
az group export \
  --name rg-kirana \
  --output json > infrastructure-backup.json
```

---

## Debugging Checklist

When something doesn't work:

- [ ] Run quick diagnostics (top of this file)
- [ ] Check Azure Portal for resource status
- [ ] Check GitHub Actions logs
- [ ] Check Function App logs: `az functionapp log tail`
- [ ] Check Application Insights for errors
- [ ] Verify secrets are set: `gh secret list`
- [ ] Verify CORS configuration
- [ ] Test endpoints manually with `curl`
- [ ] Check Cosmos DB containers exist
- [ ] Verify managed identity permissions
- [ ] Check for cost limits/quotas

---

## Getting Help

### Collect Diagnostic Info
```bash
# Save this output when asking for help:
{
  echo "=== Azure Resources ==="
  az resource list --resource-group rg-kirana --output table
  
  echo "=== Function App Status ==="
  az functionapp show --name func-kirana --resource-group rg-kirana --query '{state:state, enabledHostNames:enabledHostNames}'
  
  echo "=== Static Web App Status ==="
  az staticwebapp show --name swa-kirana --resource-group rg-kirana --query '{defaultHostname:defaultHostname}'
  
  echo "=== GitHub Secrets ==="
  gh secret list
  
  echo "=== Recent Function Logs ==="
  az functionapp log tail --name func-kirana --resource-group rg-kirana | head -50
} > diagnostic-info.txt
```

### Resources
- **Azure Support**: https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- **GitHub Discussions**: https://github.com/vedprakash-m/kirana/discussions
- **Stack Overflow**: Tag with `azure-functions`, `azure-static-web-apps`

---

**Last Updated**: November 8, 2025
