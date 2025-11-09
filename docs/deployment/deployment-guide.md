# Kirana Deployment Guide

## Architecture

**Simple, Single-Slot, Cost-Effective Deployment**

- **Frontend**: Azure Static Web Apps (Free tier)
- **Backend**: Azure Functions Flex Consumption (Pay-per-use)
- **Database**: Cosmos DB Serverless (Pay-per-use)
- **Storage**: Azure Storage (Standard LRS)
- **Monitoring**: Application Insights
- **Secrets**: Azure Key Vault

**Estimated Cost**: $6-30/month (depending on usage)

---

## Prerequisites

- Azure CLI installed: https://docs.microsoft.com/cli/azure/install-azure-cli
- Azure subscription with Owner/Contributor access
- GitHub account with repository access
- Google Gemini API key (optional, for AI features)

---

## Step 1: Set Up Azure Infrastructure (One-Time)

Run the infrastructure setup script **once**:

```bash
cd /Users/ved/Apps/kirana
chmod +x scripts/setup-infrastructure.sh
./scripts/setup-infrastructure.sh
```

This script will:
- ✅ Create all Azure resources
- ✅ Configure Key Vault with secrets
- ✅ Set up Cosmos DB containers
- ✅ Enable managed identities
- ✅ Configure CORS and security settings

**Expected Duration**: 10-15 minutes

**Important**: Save the output! You'll need:
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Function App publish profile command

---

## Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Required Secrets

1. **AZURE_STATIC_WEB_APPS_API_TOKEN**
   - Copy from infrastructure setup output
   - Used for frontend deployment

2. **AZURE_FUNCTIONAPP_PUBLISH_PROFILE**
   - Get the publish profile:
   ```bash
   az functionapp deployment list-publishing-profiles \
     --name func-kirana \
     --resource-group rg-kirana \
     --xml
   ```
   - Copy the entire XML output
   - Used for backend deployment

### How to Add Secrets

```bash
# GitHub CLI method (recommended)
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
# Paste the token when prompted

gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE
# Paste the XML when prompted
```

Or manually via GitHub web interface:
1. Go to: https://github.com/vedprakash-m/kirana/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret

---

## Step 3: Add Gemini API Key (Optional)

If you're using AI features:

```bash
# Source the infrastructure config
source infrastructure-config.sh

# Add Gemini API key to Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name GeminiApiKey \
  --value "YOUR_GEMINI_API_KEY_HERE"

# Update Function App to use it
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings "GEMINI_API_KEY=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/GeminiApiKey/)"
```

Get your Gemini API key from: https://aistudio.google.com/app/apikey

---

## Step 4: Deploy Your Application

### Automatic Deployment (Recommended)

Simply push to the main branch:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions will automatically:
1. Build frontend and backend
2. Run tests and linting
3. Deploy to Azure Functions
4. Deploy to Static Web Apps

### Manual Deployment

#### Deploy Backend
```bash
cd backend
npm ci
npm run build

# Deploy using Azure Functions Core Tools
func azure functionapp publish func-kirana
```

#### Deploy Frontend
```bash
cd frontend
npm ci --legacy-peer-deps
npm run build

# Deploy using SWA CLI
npx @azure/static-web-apps-cli deploy \
  --deployment-token $AZURE_STATIC_WEB_APPS_API_TOKEN \
  --app-location dist
```

---

## Step 5: Verify Deployment

### Check Backend
```bash
# Health check (if implemented)
curl https://func-kirana.azurewebsites.net/api/health

# Check function logs
az functionapp log tail --name func-kirana --resource-group rg-kirana
```

### Check Frontend
```bash
# Get Static Web App URL
az staticwebapp show \
  --name swa-kirana \
  --resource-group rg-kirana \
  --query defaultHostname -o tsv

# Visit in browser
open "https://$(az staticwebapp show --name swa-kirana --resource-group rg-kirana --query defaultHostname -o tsv)"
```

### Check Application Insights
```bash
# View recent logs
az monitor app-insights query \
  --app appi-kirana \
  --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc | limit 50"
```

---

## Configuration

### Environment Variables (Already Set by Infrastructure Script)

**Backend (Function App)**:
- `COSMOS_ENDPOINT` - from Key Vault
- `COSMOS_KEY` - from Key Vault  
- `COSMOS_DATABASE_ID` - "kirana"
- `BLOB_CONNECTION_STRING` - from Key Vault
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - from Key Vault
- `GEMINI_API_KEY` - from Key Vault (optional)

**Frontend (SWA)**:
- API calls automatically proxied to `/api/*`
- No environment variables needed (uses relative URLs)

### CORS Configuration

CORS is automatically configured during setup to allow:
- Static Web App hostname
- Localhost (for development)

To add additional origins:
```bash
az functionapp cors add \
  --name func-kirana \
  --resource-group rg-kirana \
  --allowed-origins "https://yourdomain.com"
```

---

## Monitoring & Debugging

### View Application Logs

```bash
# Function App logs (real-time)
az functionapp log tail \
  --name func-kirana \
  --resource-group rg-kirana

# Application Insights logs (query)
az monitor app-insights query \
  --app appi-kirana \
  --analytics-query "
    traces 
    | where timestamp > ago(24h) 
    | where severityLevel >= 2
    | project timestamp, message, severityLevel
    | order by timestamp desc
  "
```

### Monitor Costs

```bash
# View resource group costs
az consumption usage list \
  --start-date $(date -u -d '7 days ago' '+%Y-%m-%d') \
  --end-date $(date -u '+%Y-%m-%d') \
  | jq '[.[] | {date: .usageStart, cost: .pretaxCost, service: .meterDetails.meterName}]'
```

### Check Function App Health

```bash
# Get Function App status
az functionapp show \
  --name func-kirana \
  --resource-group rg-kirana \
  --query state -o tsv

# Restart if needed
az functionapp restart \
  --name func-kirana \
  --resource-group rg-kirana
```

---

## Troubleshooting

### Deployment Fails

**Backend deployment fails:**
```bash
# Check Function App logs
az functionapp log tail --name func-kirana --resource-group rg-kirana

# Verify publish profile is correct
az functionapp deployment list-publishing-profiles \
  --name func-kirana \
  --resource-group rg-kirana \
  --xml
```

**Frontend deployment fails:**
```bash
# Verify SWA token
az staticwebapp secrets list \
  --name swa-kirana \
  --resource-group rg-kirana

# Check SWA deployment history
az staticwebapp show \
  --name swa-kirana \
  --resource-group rg-kirana
```

### Application Errors

**Cosmos DB connection issues:**
```bash
# Verify Key Vault access
az functionapp identity show \
  --name func-kirana \
  --resource-group rg-kirana

# Test Key Vault secret access
az keyvault secret show \
  --vault-name $KEY_VAULT \
  --name CosmosKey \
  --query value -o tsv
```

**CORS errors:**
```bash
# Check current CORS settings
az functionapp cors show \
  --name func-kirana \
  --resource-group rg-kirana

# Update if needed
az functionapp cors add \
  --name func-kirana \
  --resource-group rg-kirana \
  --allowed-origins "https://your-swa-hostname.azurestaticapps.net"
```

### Performance Issues

**Function cold starts:**
- Flex Consumption plan has minimal cold start times
- Consider enabling "Always On" for frequently accessed functions:
```bash
az functionapp config set \
  --name func-kirana \
  --resource-group rg-kirana \
  --always-on true
```

**Cosmos DB throttling:**
- Check RU consumption in Azure Portal
- Serverless mode auto-scales but has limits
- Consider optimizing queries or adding caching

---

## Cost Optimization Tips

1. **Cosmos DB Serverless**: Only pay for operations (RU/s) you use
   - Ideal for low-to-moderate traffic
   - No minimum cost
   
2. **Function Flex Consumption**: Pay only for execution time
   - No idle charges
   - Auto-scales to zero
   
3. **Static Web Apps Free Tier**: 
   - 100 GB bandwidth/month free
   - Custom domains free
   - Built-in SSL free

4. **Storage LRS**: Local redundancy (cheapest option)
   - Sufficient for most use cases
   - Can upgrade to ZRS/GRS if needed

5. **Monitor Costs**:
   ```bash
   # Set up budget alerts in Azure Portal
   # Navigate to: Cost Management + Billing > Budgets
   # Set monthly budget: $50 with 80% alert
   ```

---

## Cleanup (Delete Everything)

To delete all resources:

```bash
# ⚠️ WARNING: This will delete everything!
az group delete \
  --name rg-kirana \
  --yes \
  --no-wait

# Verify deletion
az group show --name rg-kirana
```

---

## CI/CD Workflow

The deployment workflow (`.github/workflows/deploy.yml`) runs on every push to `main`:

1. **Build Stage**
   - Lint code
   - Run tests
   - Build frontend and backend
   - Upload artifacts

2. **Deploy Backend**
   - Download artifacts
   - Deploy to Function App
   - Run health check

3. **Deploy Frontend**
   - Download artifacts
   - Deploy to Static Web App

4. **Status Check**
   - Verify both deployments
   - Report success/failure

### Workflow Variables

Update these in `.github/workflows/deploy.yml` if you used different names:

```yaml
# In the deploy-backend job
app-name: func-kirana  # Change if different

# In infrastructure setup
RESOURCE_GROUP: rg-kirana  # Change if different
```

---

## Best Practices

### Security
- ✅ Secrets in Key Vault (not environment variables)
- ✅ Managed identities (no connection strings in code)
- ✅ HTTPS only
- ✅ TLS 1.2 minimum
- ✅ CORS properly configured
- ✅ Content Security Policy headers

### Reliability
- ✅ Health checks in deployment
- ✅ Application Insights monitoring
- ✅ Continuous backups (Cosmos DB)
- ✅ Retry policies in code

### Performance
- ✅ Serverless architecture (auto-scale)
- ✅ CDN for static assets (SWA)
- ✅ Efficient Cosmos DB partition keys
- ✅ Caching where appropriate

### Cost Management
- ✅ Serverless/consumption pricing
- ✅ Budget alerts
- ✅ Cost monitoring in CI/CD
- ✅ Right-sized resources

---

## Support & Resources

- **Azure Portal**: https://portal.azure.com
- **Azure Functions Docs**: https://docs.microsoft.com/azure/azure-functions/
- **Static Web Apps Docs**: https://docs.microsoft.com/azure/static-web-apps/
- **Cosmos DB Docs**: https://docs.microsoft.com/azure/cosmos-db/

---

## Quick Reference Commands

```bash
# Source infrastructure config
source infrastructure-config.sh

# View all resources
az resource list --resource-group $RESOURCE_GROUP --output table

# Check Function App logs
az functionapp log tail --name $FUNCTION_APP --resource-group $RESOURCE_GROUP

# Get SWA URL
echo "https://$(az staticwebapp show --name $STATIC_WEB_APP --resource-group $RESOURCE_GROUP --query defaultHostname -o tsv)"

# Get Function App URL
echo "https://$FUNCTION_APP.azurewebsites.net"

# View recent costs
az consumption usage list --start-date $(date -u -d '7 days ago' '+%Y-%m-%d') | jq

# Restart Function App
az functionapp restart --name $FUNCTION_APP --resource-group $RESOURCE_GROUP
```

---

**Last Updated**: November 8, 2025
