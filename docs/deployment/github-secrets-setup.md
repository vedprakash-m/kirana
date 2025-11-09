# GitHub Secrets Setup Instructions

## Required GitHub Secrets

Your Kirana application needs the following secrets configured in GitHub:

**Go to**: https://github.com/vedprakash-m/kirana/settings/secrets/actions

Click "New repository secret" for each of the following:

### 1. AZURE_STATIC_WEB_APPS_API_TOKEN

**Purpose**: Deploys frontend to Azure Static Web Apps

**How to get it**:
```bash
source infrastructure-config.sh
az staticwebapp secrets list \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.apiKey -o tsv
```

**Note**: This token was shown during infrastructure setup. Run the command above to retrieve it again.

---

### 2. AZURE_CREDENTIALS

**Purpose**: Allows GitHub Actions to authenticate with Azure for backend deployment

**How to get it**:
```bash
az ad sp create-for-rbac \
  --name "kirana-github-deploy" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/kirana-rg \
  --sdk-auth
```

**Format**: Copy the entire JSON output (including the curly braces)

**Note**: This was created during setup. If you need to create it again, run the command above.

---

### 3. AZURE_SUBSCRIPTION_ID

**Purpose**: Identifies your Azure subscription for deployments

**How to get it**:
```bash
az account show --query id -o tsv
```

**Format**: Just the subscription ID (GUID format)

---

## Quick Setup Commands

```bash
# 1. Get your subscription ID
echo "AZURE_SUBSCRIPTION_ID:"
az account show --query id -o tsv

# 2. Get Static Web App token
source infrastructure-config.sh
echo "AZURE_STATIC_WEB_APPS_API_TOKEN:"
az staticwebapp secrets list \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.apiKey -o tsv

# 3. Service principal credentials (if needed)
echo "AZURE_CREDENTIALS:"
echo "Run: az ad sp create-for-rbac --name kirana-github-deploy --role contributor --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/kirana-rg --sdk-auth"
```

---

## Adding Secrets to GitHub

### Option 1: GitHub Web Interface

1. Go to: https://github.com/vedprakash-m/kirana/settings/secrets/actions
2. Click "New repository secret"
3. Enter the name (e.g., `AZURE_CREDENTIALS`)
4. Paste the value
5. Click "Add secret"
6. Repeat for each secret

### Option 2: GitHub CLI (if installed)

```bash
# Install GitHub CLI first: brew install gh
gh auth login

# Add secrets
gh secret set AZURE_SUBSCRIPTION_ID
# Paste value when prompted

gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
# Paste value when prompted

gh secret set AZURE_CREDENTIALS
# Paste JSON when prompted
```

---

## Verify Secrets Are Set

```bash
gh secret list
```

Should show:
- AZURE_CREDENTIALS
- AZURE_STATIC_WEB_APPS_API_TOKEN  
- AZURE_SUBSCRIPTION_ID

---

## Security Notes

⚠️ **NEVER** commit secrets to your repository!

✅ **DO**:
- Store secrets in GitHub Secrets (encrypted)
- Store secrets in Azure Key Vault (for runtime)
- Rotate service principal credentials periodically
- Use managed identities where possible

❌ **DON'T**:
- Put secrets in code files
- Put secrets in config files
- Put secrets in documentation
- Share secrets in chat/email
- Commit `.env` files with real values

---

## Next Steps

After adding all three secrets to GitHub:

1. **Test the deployment**:
   ```bash
   git add .
   git commit -m "Configure CI/CD deployment"
   git push origin main
   ```

2. **Monitor the deployment**:
   - Go to: https://github.com/vedprakash-m/kirana/actions
   - Watch the workflow run
   - Check for any errors

3. **Verify deployment**:
   - Frontend: https://ambitious-ground-085f3fb1e.3.azurestaticapps.net
   - Backend: https://kirana-backend.azurewebsites.net

---

**Last Updated**: November 8, 2025
