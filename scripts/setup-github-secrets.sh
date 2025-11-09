#!/bin/bash

# GitHub Secrets Setup Helper
# This script helps you set up GitHub secrets for CI/CD

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🔐 GitHub Secrets Setup for Kirana CI/CD                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if infrastructure-config.sh exists
if [ ! -f "infrastructure-config.sh" ]; then
    echo -e "${RED}❌ infrastructure-config.sh not found!${NC}"
    echo -e "${YELLOW}Please run scripts/setup-infrastructure.sh first.${NC}"
    exit 1
fi

# Source the config
source infrastructure-config.sh

echo -e "${GREEN}✅ Infrastructure config loaded${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI not installed. Install it from: https://cli.github.com/${NC}"
    echo ""
    echo -e "${YELLOW}Manual setup required:${NC}"
    echo "Go to: https://github.com/vedprakash-m/kirana/settings/secrets/actions"
    echo ""
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Secret 1: AZURE_STATIC_WEB_APPS_API_TOKEN${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get SWA token
    echo "Retrieving Static Web Apps deployment token..."
    SWA_TOKEN=$(az staticwebapp secrets list \
      --name $STATIC_WEB_APP \
      --resource-group $RESOURCE_GROUP \
      --query properties.apiKey -o tsv 2>/dev/null)
    
    if [ -n "$SWA_TOKEN" ]; then
        echo -e "${GREEN}Token retrieved. Copy this:${NC}"
        echo ""
        echo "$SWA_TOKEN"
        echo ""
    else
        echo -e "${RED}Failed to retrieve token. Run manually:${NC}"
        echo "az staticwebapp secrets list --name $STATIC_WEB_APP --resource-group $RESOURCE_GROUP --query properties.apiKey -o tsv"
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Secret 2: AZURE_FUNCTIONAPP_PUBLISH_PROFILE${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo "Run this command and copy ALL the XML output:"
    echo ""
    echo "az functionapp deployment list-publishing-profiles \\"
    echo "  --name $FUNCTION_APP \\"
    echo "  --resource-group $RESOURCE_GROUP \\"
    echo "  --xml"
    echo ""
    
    exit 0
fi

# Check if user is logged into gh
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Please login to GitHub CLI:${NC}"
    gh auth login
fi

echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "vedprakash-m/kirana")
echo -e "${BLUE}Setting secrets for repository: $REPO${NC}"
echo ""

# Set AZURE_STATIC_WEB_APPS_API_TOKEN
echo -e "${YELLOW}📝 Setting AZURE_STATIC_WEB_APPS_API_TOKEN...${NC}"
SWA_TOKEN=$(az staticwebapp secrets list \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.apiKey -o tsv)

if [ -n "$SWA_TOKEN" ]; then
    echo "$SWA_TOKEN" | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
    echo -e "${GREEN}✅ AZURE_STATIC_WEB_APPS_API_TOKEN set${NC}"
else
    echo -e "${RED}❌ Failed to get Static Web Apps token${NC}"
    exit 1
fi

# Set AZURE_FUNCTIONAPP_PUBLISH_PROFILE
echo ""
echo -e "${YELLOW}📝 Setting AZURE_FUNCTIONAPP_PUBLISH_PROFILE...${NC}"
PUBLISH_PROFILE=$(az functionapp deployment list-publishing-profiles \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --xml)

if [ -n "$PUBLISH_PROFILE" ]; then
    echo "$PUBLISH_PROFILE" | gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE
    echo -e "${GREEN}✅ AZURE_FUNCTIONAPP_PUBLISH_PROFILE set${NC}"
else
    echo -e "${RED}❌ Failed to get Function App publish profile${NC}"
    exit 1
fi

# Verify secrets
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Verifying secrets...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

gh secret list

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✅ SECRETS CONFIGURED!                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. (Optional) Add Gemini API key:"
echo "   source infrastructure-config.sh"
echo "   az keyvault secret set --vault-name \$KEY_VAULT --name GeminiApiKey --value 'YOUR_KEY'"
echo ""
echo "2. Deploy your app:"
echo "   git push origin main"
echo ""
echo "3. Monitor deployment:"
echo "   https://github.com/$REPO/actions"
echo ""
echo -e "${GREEN}🎉 You're all set!${NC}"
