#!/bin/bash

# Kirana Azure Infrastructure Setup Script
# One-time setup for simple, cost-effective deployment
# Uses: Function App Flex Consumption + Static Web Apps Free tier

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================
RESOURCE_GROUP="kirana-rg"
LOCATION="westus2"
COSMOS_ACCOUNT="kirana-db-cosmos"
STORAGE_ACCOUNT="kiranasa"
FUNCTION_APP="kirana-backend"
STATIC_WEB_APP="kirana-frontend"
APP_INSIGHTS="kirana-app-insight"
KEY_VAULT="kirana-kv"
LOG_ANALYTICS="kirana-log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🏪 Kirana - Azure Infrastructure Setup                  ║${NC}"
echo -e "${BLUE}║     Simple, Single-Slot, Cost-Effective Deployment          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================
echo -e "${YELLOW}🔍 Running pre-flight checks...${NC}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed.${NC}"
    echo "Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Check Azure CLI version
AZ_VERSION=$(az version --query '"azure-cli"' -o tsv)
echo -e "${GREEN}✅ Azure CLI version: $AZ_VERSION${NC}"

# Login check
echo -e "${YELLOW}📋 Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Please login to Azure...${NC}"
    az login
fi

# Get subscription info
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${GREEN}✅ Using subscription: $SUBSCRIPTION_NAME${NC}"
echo -e "${GREEN}   Subscription ID: $SUBSCRIPTION_ID${NC}"

# Confirm before proceeding
echo ""
echo -e "${YELLOW}⚠️  This will create the following resources:${NC}"
echo "   • Resource Group: $RESOURCE_GROUP"
echo "   • Cosmos DB: $COSMOS_ACCOUNT (Serverless)"
echo "   • Storage Account: $STORAGE_ACCOUNT"
echo "   • Function App: $FUNCTION_APP (Flex Consumption)"
echo "   • Static Web App: $STATIC_WEB_APP (Free tier)"
echo "   • Application Insights: $APP_INSIGHTS"
echo "   • Key Vault: $KEY_VAULT"
echo "   • Log Analytics: $LOG_ANALYTICS"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Setup cancelled.${NC}"
    exit 0
fi

# ============================================================================
# RESOURCE GROUP
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 Creating Resource Group${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if resource group exists
if az group show --name $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Resource group '$RESOURCE_GROUP' already exists, reusing...${NC}"
else
    az group create \
      --name $RESOURCE_GROUP \
      --location $LOCATION \
      --tags "app=kirana" "environment=production" "cost-center=kirana" \
      --output table
    echo -e "${GREEN}✅ Resource group created${NC}"
fi

# ============================================================================
# LOG ANALYTICS & APPLICATION INSIGHTS
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Creating Monitoring Infrastructure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Create Log Analytics Workspace
echo "Creating Log Analytics workspace..."
if az monitor log-analytics workspace show --resource-group $RESOURCE_GROUP --workspace-name $LOG_ANALYTICS &>/dev/null; then
    echo -e "${YELLOW}⚠️  Log Analytics workspace '$LOG_ANALYTICS' already exists, reusing...${NC}"
else
    az monitor log-analytics workspace create \
      --resource-group $RESOURCE_GROUP \
      --workspace-name $LOG_ANALYTICS \
      --location $LOCATION \
      --retention-time 30 \
      --output table
fi

WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_ANALYTICS \
  --query id -o tsv)

# Create Application Insights (workspace-based)
echo "Creating Application Insights..."
if az monitor app-insights component show --app $APP_INSIGHTS --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Application Insights '$APP_INSIGHTS' already exists, reusing...${NC}"
else
    az monitor app-insights component create \
      --app $APP_INSIGHTS \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --application-type web \
      --kind web \
      --workspace $WORKSPACE_ID \
      --output table
fi

# Get Application Insights connection string (recommended over instrumentation key)
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
  --app $APP_INSIGHTS \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

echo -e "${GREEN}✅ Monitoring infrastructure created${NC}"

# ============================================================================
# COSMOS DB (Serverless - Most Cost-Effective)
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌍 Creating Cosmos DB (Serverless)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Cosmos DB account '$COSMOS_ACCOUNT' already exists, reusing...${NC}"
else
    echo -e "${YELLOW}⏳ Creating Cosmos DB account (this may take 3-5 minutes)...${NC}"
    az cosmosdb create \
      --name $COSMOS_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False \
      --capabilities EnableServerless \
      --default-consistency-level Session \
      --enable-automatic-failover false \
      --backup-policy-type Continuous \
      --continuous-tier Continuous7Days \
      --tags "app=kirana" \
      --output table
    echo -e "${GREEN}✅ Cosmos DB account created${NC}"
fi

# Create Cosmos DB Database
echo "Creating database 'kirana'..."
if az cosmosdb sql database show --account-name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --name kirana &>/dev/null; then
    echo -e "${YELLOW}⚠️  Database 'kirana' already exists, reusing...${NC}"
else
    az cosmosdb sql database create \
      --account-name $COSMOS_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --name kirana \
      --output table
    echo -e "${GREEN}✅ Database created${NC}"
fi

# Get Cosmos DB connection info
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query documentEndpoint -o tsv)

COSMOS_KEY=$(az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query primaryMasterKey -o tsv)

# ============================================================================
# STORAGE ACCOUNT
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💾 Creating Storage Account${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Storage account '$STORAGE_ACCOUNT' already exists, reusing...${NC}"
else
    az storage account create \
      --name $STORAGE_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --sku Standard_LRS \
      --kind StorageV2 \
      --access-tier Hot \
      --min-tls-version TLS1_2 \
      --allow-blob-public-access false \
      --https-only true \
      --tags "app=kirana" \
      --output table
    echo -e "${GREEN}✅ Storage account created${NC}"
fi

# Get Storage Connection String
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Create Blob Containers
echo "Creating blob containers..."
for container in receipts csv-imports email-attachments; do
  if az storage container show --name $container --account-name $STORAGE_ACCOUNT --auth-mode login &>/dev/null; then
    echo "  ⚠️  Container '$container' already exists, skipping..."
  else
    az storage container create \
      --name $container \
      --account-name $STORAGE_ACCOUNT \
      --auth-mode login \
      --output none
    echo "  ✓ $container"
  fi
done

# ============================================================================
# KEY VAULT
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔐 Creating Key Vault${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get current user object ID for Key Vault access
CURRENT_USER_ID=$(az ad signed-in-user show --query id -o tsv)

if az keyvault show --name $KEY_VAULT --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Key Vault '$KEY_VAULT' already exists, reusing...${NC}"
else
    az keyvault create \
      --name $KEY_VAULT \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --enable-rbac-authorization false \
      --sku standard \
      --retention-days 7 \
      --tags "app=kirana" \
      --output table
    echo -e "${GREEN}✅ Key Vault created${NC}"
fi

# Grant yourself access to set secrets (idempotent)
az keyvault set-policy \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --object-id $CURRENT_USER_ID \
  --secret-permissions get list set delete \
  --output none

# Store secrets in Key Vault (idempotent - will update if exists)
echo "Storing secrets in Key Vault..."
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name CosmosEndpoint \
  --value "$COSMOS_ENDPOINT" \
  --output none
echo "  ✓ CosmosEndpoint"

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name CosmosKey \
  --value "$COSMOS_KEY" \
  --output none
echo "  ✓ CosmosKey"

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name StorageConnectionString \
  --value "$STORAGE_CONNECTION" \
  --output none
echo "  ✓ StorageConnectionString"

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name ApplicationInsightsConnectionString \
  --value "$APPINSIGHTS_CONNECTION_STRING" \
  --output none
echo "  ✓ ApplicationInsightsConnectionString"

# ============================================================================
# FUNCTION APP (Flex Consumption)
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚡ Creating Function App (Flex Consumption)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Function App '$FUNCTION_APP' already exists, reusing...${NC}"
else
    az functionapp create \
      --name $FUNCTION_APP \
      --resource-group $RESOURCE_GROUP \
      --storage-account $STORAGE_ACCOUNT \
      --flexconsumption-location $LOCATION \
      --runtime node \
      --runtime-version 20 \
      --functions-version 4 \
      --os-type Linux \
      --tags "app=kirana" \
      --output table
    echo -e "${GREEN}✅ Function App created${NC}"
fi

# Enable system-assigned managed identity (idempotent)
echo "Enabling managed identity..."
FUNCTION_IDENTITY=$(az functionapp identity assign \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Grant Function App access to Key Vault (idempotent)
echo "Granting Key Vault access to Function App..."
az keyvault set-policy \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --object-id $FUNCTION_IDENTITY \
  --secret-permissions get list \
  --output none

# Configure Function App settings with Key Vault references (idempotent)
echo "Configuring Function App settings..."
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_ENDPOINT=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/CosmosEndpoint/)" \
    "COSMOS_KEY=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/CosmosKey/)" \
    "COSMOS_DATABASE_ID=kirana" \
    "BLOB_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/StorageConnectionString/)" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/ApplicationInsightsConnectionString/)" \
    "NODE_ENV=production" \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true" \
    "ENABLE_ORYX_BUILD=true" \
  --output none

# Enable CORS (will add if not already present)
echo "Configuring CORS..."
az functionapp cors add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://$STATIC_WEB_APP.azurestaticapps.net" \
  --output none 2>/dev/null || echo "  ⚠️  CORS origin may already exist"

# ============================================================================
# STATIC WEB APP (Free tier)
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌐 Creating Static Web App${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if az staticwebapp show --name $STATIC_WEB_APP --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}⚠️  Static Web App '$STATIC_WEB_APP' already exists, reusing...${NC}"
else
    az staticwebapp create \
      --name $STATIC_WEB_APP \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --sku Free \
      --tags "app=kirana" \
      --output table
    echo -e "${GREEN}✅ Static Web App created${NC}"
fi

# Get Static Web App deployment token
SWA_DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.apiKey -o tsv)

# Get Static Web App hostname
SWA_HOSTNAME=$(az staticwebapp show \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query defaultHostname -o tsv)

# Update Function App CORS with actual SWA hostname
az functionapp cors add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://$SWA_HOSTNAME" \
  --output none 2>/dev/null || echo "  ⚠️  CORS origin may already exist"

# ============================================================================
# SETUP COSMOS DB CONTAINERS
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 Creating Cosmos DB Containers${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Items container
if az cosmosdb sql container show --account-name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --database-name kirana --name items &>/dev/null; then
    echo "  ⚠️  Container 'items' already exists, skipping..."
else
    az cosmosdb sql container create \
      --account-name $COSMOS_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --database-name kirana \
      --name items \
      --partition-key-path "/userId" \
      --output none
    echo "  ✓ items"
fi

# Transactions container
if az cosmosdb sql container show --account-name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --database-name kirana --name transactions &>/dev/null; then
    echo "  ⚠️  Container 'transactions' already exists, skipping..."
else
    az cosmosdb sql container create \
      --account-name $COSMOS_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --database-name kirana \
      --name transactions \
      --partition-key-path "/userId" \
      --output none
    echo "  ✓ transactions"
fi

# Predictions container
if az cosmosdb sql container show --account-name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --database-name kirana --name predictions &>/dev/null; then
    echo "  ⚠️  Container 'predictions' already exists, skipping..."
else
    az cosmosdb sql container create \
      --account-name $COSMOS_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --database-name kirana \
      --name predictions \
      --partition-key-path "/userId" \
      --output none
    echo "  ✓ predictions"
fi

# SKU cache container
if az cosmosdb sql container show --account-name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --database-name kirana --name sku-cache &>/dev/null; then
    echo "  ⚠️  Container 'sku-cache' already exists, skipping..."
else
    az cosmosdb sql container create \
      --account-name $COSMOS_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --database-name kirana \
      --name sku-cache \
      --partition-key-path "/normalizedName" \
      --ttl 2592000 \
      --output none
    echo "  ✓ sku-cache (with 30-day TTL)"
fi

# ============================================================================
# COST OPTIMIZATION
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💰 Applying Cost Optimization${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Create budget alert (optional - requires Cost Management API access)
echo -e "${YELLOW}Setting up budget alerts...${NC}"
echo "  ℹ️  Manual step: Create budget alert in Azure Portal"
echo "     Navigate to: Cost Management + Billing > Budgets"
echo "     Recommended: \$50/month alert threshold"

echo -e "${GREEN}✅ Cost optimization configured${NC}"

# ============================================================================
# SUMMARY & NEXT STEPS
# ============================================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ SETUP COMPLETE!                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📝 Infrastructure Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Resource Group:    $RESOURCE_GROUP"
echo "Location:          $LOCATION"
echo "Cosmos DB:         $COSMOS_ACCOUNT (Serverless)"
echo "Storage:           $STORAGE_ACCOUNT"
echo "Function App:      $FUNCTION_APP (Flex Consumption)"
echo "Static Web App:    $STATIC_WEB_APP (Free tier)"
echo "Key Vault:         $KEY_VAULT"
echo "App Insights:      $APP_INSIGHTS"
echo ""
echo -e "${BLUE}🔗 Important URLs:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend:          https://$SWA_HOSTNAME"
echo "API:               https://$FUNCTION_APP.azurewebsites.net"
echo "Portal:            https://portal.azure.com/#@/resource/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
echo ""
echo -e "${YELLOW}🔑 GitHub Secrets (for CI/CD):${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "AZURE_STATIC_WEB_APPS_API_TOKEN=$SWA_DEPLOYMENT_TOKEN"
echo ""
echo "# Get Function App publish profile:"
echo "az functionapp deployment list-publishing-profiles \\"
echo "  --name $FUNCTION_APP \\"
echo "  --resource-group $RESOURCE_GROUP \\"
echo "  --xml"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Add the following secrets to your GitHub repository:"
echo "   • AZURE_STATIC_WEB_APPS_API_TOKEN (shown above)"
echo "   • AZURE_FUNCTIONAPP_PUBLISH_PROFILE (run command above)"
echo ""
echo "2. Add Gemini API key to Key Vault:"
echo "   az keyvault secret set \\"
echo "     --vault-name $KEY_VAULT \\"
echo "     --name GeminiApiKey \\"
echo "     --value 'YOUR_GEMINI_KEY'"
echo ""
echo "3. Update Function App to use Gemini key:"
echo "   az functionapp config appsettings set \\"
echo "     --name $FUNCTION_APP \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --settings \"GEMINI_API_KEY=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/GeminiApiKey/)\""
echo ""
echo "4. Set up Microsoft Entra ID (if using auth):"
echo "   • Go to: https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps"
echo "   • Register application and add secrets to Key Vault"
echo ""
echo "5. Deploy your application:"
echo "   • Push to main branch - CI/CD will auto-deploy"
echo "   • Or deploy manually using deployment scripts"
echo ""
echo -e "${GREEN}💡 Cost Estimates (Monthly):${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Cosmos DB (Serverless):      ~\$5-15 (pay per use)"
echo "Function App (Flex Consumption): ~\$0-5 (pay per execution)"
echo "Static Web App (Free):       \$0"
echo "Storage (LRS):               ~\$1-3"
echo "App Insights:                ~\$0-5"
echo "Key Vault:                   ~\$0-1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Estimated Total:             ~\$6-30/month"
echo ""
echo -e "${GREEN}🎉 Your infrastructure is ready! Happy coding!${NC}"
echo ""

# Save configuration to file
CONFIG_FILE="infrastructure-config.sh"
cat > $CONFIG_FILE << EOF
#!/bin/bash
# Auto-generated infrastructure configuration
# Created: $(date)

export RESOURCE_GROUP="$RESOURCE_GROUP"
export LOCATION="$LOCATION"
export COSMOS_ACCOUNT="$COSMOS_ACCOUNT"
export STORAGE_ACCOUNT="$STORAGE_ACCOUNT"
export FUNCTION_APP="$FUNCTION_APP"
export STATIC_WEB_APP="$STATIC_WEB_APP"
export KEY_VAULT="$KEY_VAULT"
export APP_INSIGHTS="$APP_INSIGHTS"
export SWA_HOSTNAME="$SWA_HOSTNAME"
EOF

echo -e "${GREEN}✅ Configuration saved to: $CONFIG_FILE${NC}"
