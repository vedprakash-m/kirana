#!/bin/bash

# Kirana Azure Infrastructure Setup Script
# This script provisions all required Azure resources for Kirana

set -e

# Configuration
RESOURCE_GROUP="rg-kirana-dev"
LOCATION="westus2"
COSMOS_ACCOUNT="cosmos-kirana-dev"
STORAGE_ACCOUNT="stkiranadev"
FUNCTION_APP="func-kirana-dev"
APP_INSIGHTS="appi-kirana-dev"
KEY_VAULT="kv-kirana-dev"

echo "🚀 Starting Kirana Azure Infrastructure Setup..."
echo "================================================"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Login check
echo "📋 Checking Azure login status..."
az account show &> /dev/null || az login

# Create Resource Group
echo ""
echo "📦 Creating Resource Group: $RESOURCE_GROUP in $LOCATION..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output table

# Create Cosmos DB Account
echo ""
echo "🌍 Creating Cosmos DB Account: $COSMOS_ACCOUNT..."
echo "⏳ This may take 5-10 minutes..."
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --default-consistency-level Session \
  --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False \
  --enable-automatic-failover false \
  --output table

# Create Cosmos DB Database
echo ""
echo "💾 Creating Cosmos DB Database: kirana-dev..."
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --name kirana-dev \
  --throughput 400 \
  --output table

# Get Cosmos DB connection strings
echo ""
echo "🔑 Retrieving Cosmos DB connection info..."
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query documentEndpoint \
  --output tsv)

COSMOS_KEY=$(az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query primaryMasterKey \
  --output tsv)

echo "✅ Cosmos DB Endpoint: $COSMOS_ENDPOINT"

# Create Storage Account
echo ""
echo "📦 Creating Storage Account: $STORAGE_ACCOUNT..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --access-tier Hot \
  --output table

# Get Storage Connection String
echo ""
echo "🔑 Retrieving Storage connection string..."
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv)

# Create Blob Containers
echo ""
echo "📁 Creating Blob Containers..."
az storage container create \
  --name receipts \
  --connection-string "$STORAGE_CONNECTION" \
  --output table

az storage container create \
  --name csv-imports \
  --connection-string "$STORAGE_CONNECTION" \
  --output table

az storage container create \
  --name email-attachments \
  --connection-string "$STORAGE_CONNECTION" \
  --output table

# Create Application Insights
echo ""
echo "📊 Creating Application Insights: $APP_INSIGHTS..."
az monitor app-insights component create \
  --app $APP_INSIGHTS \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --application-type web \
  --output table

# Get Application Insights Instrumentation Key
echo ""
echo "🔑 Retrieving Application Insights key..."
APPINSIGHTS_KEY=$(az monitor app-insights component show \
  --app $APP_INSIGHTS \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv)

# Create Function App
echo ""
echo "⚡ Creating Function App: $FUNCTION_APP..."
az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --storage-account $STORAGE_ACCOUNT \
  --os-type Linux \
  --output table

# Configure Function App Settings
echo ""
echo "⚙️  Configuring Function App settings..."
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
    COSMOS_DATABASE_ID="kirana-dev" \
    BLOB_CONNECTION_STRING="$STORAGE_CONNECTION" \
    APPINSIGHTS_INSTRUMENTATIONKEY="$APPINSIGHTS_KEY" \
  --output table

# Create Key Vault
echo ""
echo "🔐 Creating Key Vault: $KEY_VAULT..."
az keyvault create \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --output table

# Store secrets in Key Vault
echo ""
echo "🔒 Storing secrets in Key Vault..."
az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name CosmosKey \
  --value "$COSMOS_KEY" \
  --output table

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name BlobConnectionString \
  --value "$STORAGE_CONNECTION" \
  --output table

# Grant Function App access to Key Vault
echo ""
echo "🔓 Granting Function App access to Key Vault..."
FUNCTION_APP_ID=$(az functionapp identity assign \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query principalId \
  --output tsv)

az keyvault set-policy \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --object-id $FUNCTION_APP_ID \
  --secret-permissions get list \
  --output table

echo ""
echo "================================================"
echo "✅ Infrastructure setup complete!"
echo "================================================"
echo ""
echo "📝 Next steps:"
echo "1. Run 'node scripts/setup-cosmos-containers.js' to create Cosmos DB containers"
echo "2. Set up Microsoft Entra ID app registration at https://portal.azure.com"
echo "3. Create Google Gemini API key at https://aistudio.google.com"
echo "4. Store GEMINI_API_KEY and ENTRA secrets in Key Vault"
echo "5. Update backend/local.settings.json with connection strings"
echo "6. Update frontend/.env.local with Entra client ID"
echo ""
echo "🔑 Connection Strings (save these securely):"
echo "COSMOS_ENDPOINT=$COSMOS_ENDPOINT"
echo "COSMOS_KEY=$COSMOS_KEY"
echo "BLOB_CONNECTION_STRING=$STORAGE_CONNECTION"
echo "APPINSIGHTS_INSTRUMENTATIONKEY=$APPINSIGHTS_KEY"
echo ""
