# Deployment Quick Start

## 🚀 First-Time Setup (15 minutes)

### 1. Run Infrastructure Setup
```bash
cd /Users/ved/Apps/kirana
chmod +x scripts/setup-infrastructure.sh
./scripts/setup-infrastructure.sh
```

**Save the output!** You'll need the deployment tokens.

### 2. Add GitHub Secrets

Go to: https://github.com/vedprakash-m/kirana/settings/secrets/actions

Add these two secrets:

**AZURE_STATIC_WEB_APPS_API_TOKEN**
```
# Copy from infrastructure setup output
```

**AZURE_FUNCTIONAPP_PUBLISH_PROFILE**
```bash
# Run this command and copy ALL output:
az functionapp deployment list-publishing-profiles \
  --name func-kirana \
  --resource-group rg-kirana \
  --xml
```

### 3. Add Gemini API Key (Optional)
```bash
source infrastructure-config.sh

az keyvault secret set \
  --vault-name $KEY_VAULT \
  --name GeminiApiKey \
  --value "YOUR_KEY_HERE"

az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings "GEMINI_API_KEY=@Microsoft.KeyVault(SecretUri=https://$KEY_VAULT.vault.azure.net/secrets/GeminiApiKey/)"
```

### 4. Deploy!
```bash
git push origin main
```

That's it! ✅

---

## 🔧 Common Tasks

### Deploy Changes
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### View Live App
```bash
source infrastructure-config.sh
echo "Frontend: https://$SWA_HOSTNAME"
echo "API: https://$FUNCTION_APP.azurewebsites.net"
```

### Check Logs
```bash
source infrastructure-config.sh
az functionapp log tail --name $FUNCTION_APP --resource-group $RESOURCE_GROUP
```

### View Costs
```bash
# In Azure Portal
# Go to: Cost Management + Billing
# Or use CLI:
az consumption usage list --start-date $(date -u -d '7 days ago' '+%Y-%m-%d')
```

### Restart Function App
```bash
source infrastructure-config.sh
az functionapp restart --name $FUNCTION_APP --resource-group $RESOURCE_GROUP
```

---

## 💰 Cost Estimates

| Service | Plan | Estimated Cost |
|---------|------|----------------|
| Cosmos DB | Serverless | $5-15/month |
| Functions | Flex Consumption | $0-5/month |
| Static Web App | Free | $0 |
| Storage | Standard LRS | $1-3/month |
| App Insights | Pay-as-you-go | $0-5/month |
| Key Vault | Standard | $0-1/month |
| **Total** | | **$6-30/month** |

---

## 🆘 Troubleshooting

### Deployment Failed?
```bash
# Check GitHub Actions
# https://github.com/vedprakash-m/kirana/actions

# Check Function logs
az functionapp log tail --name func-kirana --resource-group rg-kirana

# Verify secrets are set
gh secret list
```

### App Not Working?
```bash
# Check Function App status
az functionapp show --name func-kirana --resource-group rg-kirana --query state

# Test API directly
curl https://func-kirana.azurewebsites.net/api/health

# Check CORS
az functionapp cors show --name func-kirana --resource-group rg-kirana
```

### Need to Reset?
```bash
# Delete everything and start over
az group delete --name rg-kirana --yes

# Then re-run setup-infrastructure.sh
```

---

## 📚 Full Docs

See `docs/deployment/deployment-guide.md` for detailed documentation.

---

## ✅ Setup Checklist

- [ ] Run `setup-infrastructure.sh`
- [ ] Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to GitHub secrets
- [ ] Add `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` to GitHub secrets  
- [ ] Add Gemini API key to Key Vault (optional)
- [ ] Push to main branch
- [ ] Verify deployment in GitHub Actions
- [ ] Test the live app
- [ ] Set up budget alerts in Azure Portal

**Done!** 🎉
