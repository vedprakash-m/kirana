#!/bin/bash

# Remove incompatible Azure Functions app settings
# These settings are not supported with Consumption SKU

set -e

FUNCTION_APP_NAME="kirana-backend"
RESOURCE_GROUP="kirana-rg"

echo "🔧 Removing incompatible app settings from $FUNCTION_APP_NAME..."

# Remove SCM_DO_BUILD_DURING_DEPLOYMENT
echo "Removing SCM_DO_BUILD_DURING_DEPLOYMENT..."
az functionapp config appsettings delete \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names "SCM_DO_BUILD_DURING_DEPLOYMENT" \
  2>/dev/null || echo "  ℹ️  Setting not found (already removed)"

# Remove ENABLE_ORYX_BUILD
echo "Removing ENABLE_ORYX_BUILD..."
az functionapp config appsettings delete \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names "ENABLE_ORYX_BUILD" \
  2>/dev/null || echo "  ℹ️  Setting not found (already removed)"

echo "✅ Done! App settings cleaned up."
echo ""
echo "Current app settings:"
az functionapp config appsettings list \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].name" \
  --output table
