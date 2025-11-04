# Secrets Management Guide

## Overview

This guide explains how to manage secrets securely in the Kirana project using Azure Key Vault and git-secrets.

## Architecture

```
┌─────────────────┐
│  Azure Key      │
│  Vault          │◄────┐
│  (Production)   │     │
└─────────────────┘     │
                        │ Fetch secrets
┌─────────────────┐     │ at runtime
│  Environment    │     │
│  Variables      │◄────┼────┐
│  (Local Dev)    │     │    │
└─────────────────┘     │    │
                        │    │
                   ┌────┴────┴───┐
                   │  Azure       │
                   │  Functions   │
                   │  Backend     │
                   └──────────────┘
```

## Quick Start

### 1. Local Development Setup

```bash
# Set environment variables in local.settings.json
cd backend
cp local.settings.json.example local.settings.json

# Edit local.settings.json (NEVER commit this file!)
{
  "IsEncrypted": false,
  "Values": {
    "GEMINI_API_KEY": "your-api-key-here",
    "COSMOS_CONNECTION_STRING": "your-connection-string-here",
    "STORAGE_CONNECTION_STRING": "your-storage-connection-here"
  }
}

# Install git-secrets hook
chmod +x scripts/git-hooks/pre-commit
ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

### 2. Azure Key Vault Setup (Production)

```bash
# Create Key Vault
az keyvault create \
  --name kv-kirana-prod \
  --resource-group rg-kirana-prod \
  --location westus2

# Add secrets
az keyvault secret set \
  --vault-name kv-kirana-prod \
  --name gemini-api-key \
  --value "AIzaSyC..."

az keyvault secret set \
  --vault-name kv-kirana-prod \
  --name cosmos-connection-string \
  --value "AccountEndpoint=..."

az keyvault secret set \
  --vault-name kv-kirana-prod \
  --name storage-connection-string \
  --value "DefaultEndpointsProtocol=..."

# Grant Function App access (using Managed Identity)
FUNCTION_APP_ID=$(az functionapp identity assign \
  --name func-kirana-prod \
  --resource-group rg-kirana-prod \
  --query principalId -o tsv)

az keyvault set-policy \
  --name kv-kirana-prod \
  --object-id $FUNCTION_APP_ID \
  --secret-permissions get list
```

### 3. Configure Function App

```bash
# Set Key Vault URL in Function App settings
az functionapp config appsettings set \
  --name func-kirana-prod \
  --resource-group rg-kirana-prod \
  --settings KEY_VAULT_URL=https://kv-kirana-prod.vault.azure.net/
```

## Usage in Code

### Initialize Secrets at Startup

```typescript
// In your main Function App entry point
import { initializeSecrets, validateRequiredSecrets } from './config/secrets';

async function main() {
  try {
    // Initialize Key Vault client
    await initializeSecrets();
    
    // Validate all required secrets exist
    await validateRequiredSecrets();
    
    console.log('✅ Secrets initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize secrets:', error);
    process.exit(1); // Fail fast if secrets unavailable
  }
}

main();
```

### Get Secrets in Functions

```typescript
import { getSecret, SECRET_NAMES } from '../config/secrets';

export async function httpTrigger(req: HttpRequest, context: InvocationContext) {
  // Get secret (cached for 5 minutes)
  const apiKey = await getSecret(SECRET_NAMES.GEMINI_API_KEY);
  
  // Use the secret
  const client = new GeminiClient({ apiKey });
  // ...
}
```

### Rotate Secrets

```typescript
import { rotateSecret, SECRET_NAMES } from '../config/secrets';

// After uploading new version to Key Vault
await rotateSecret(SECRET_NAMES.GEMINI_API_KEY);
console.log('✅ Secret rotated successfully');
```

## Authentication Methods

The `DefaultAzureCredential` tries authentication methods in this order:

### 1. Managed Identity (Production)
- **Used in:** Azure Function Apps, Azure VMs
- **Setup:** Enable System-Assigned Managed Identity
- **No credentials needed:** Azure handles authentication automatically
- **Best for:** Production deployments

```bash
# Enable Managed Identity
az functionapp identity assign \
  --name func-kirana-prod \
  --resource-group rg-kirana-prod
```

### 2. Service Principal (CI/CD)
- **Used in:** GitHub Actions, Azure DevOps
- **Setup:** Create Service Principal and set environment variables
- **Credentials:** AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
- **Best for:** Automated deployments

```bash
# Create Service Principal
az ad sp create-for-rbac --name sp-kirana-cicd

# Output (set as GitHub Secrets):
# {
#   "clientId": "...",
#   "clientSecret": "...",
#   "tenantId": "..."
# }
```

### 3. Azure CLI (Local Development)
- **Used in:** Developer machines
- **Setup:** Run `az login`
- **No credentials needed:** Uses your Azure account
- **Best for:** Local development

```bash
# Login to Azure
az login

# Verify access to Key Vault
az keyvault secret list --vault-name kv-kirana-dev
```

## Secret Patterns

### What NOT to Commit

❌ **Never commit these patterns:**

```typescript
// API keys
const API_KEY = "AIzaSyC_abcd1234...";

// Connection strings
const COSMOS_CONN = "AccountEndpoint=https://...;AccountKey=...";

// Passwords
const DB_PASSWORD = "SuperSecret123!";

// JWTs
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// Private keys
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
```

✅ **Instead, do this:**

```typescript
// Use environment variables (local dev)
const API_KEY = process.env.GEMINI_API_KEY;

// Use Key Vault (production)
const API_KEY = await getSecret(SECRET_NAMES.GEMINI_API_KEY);
```

### Allowed Patterns

✅ **These are safe to commit:**

```typescript
// Environment variable references
KEY_VAULT_URL=https://kv-kirana-prod.vault.azure.net/

// Placeholder values
const API_KEY = process.env.GEMINI_API_KEY || 'your-api-key-here';

// Example/mock values in comments
// Example: GEMINI_API_KEY=AIzaSyC_example_not_real_key

// Documentation
// Get your API key from: https://aistudio.google.com/
```

## Git-Secrets Integration

### Setup

```bash
# Install git-secrets (macOS)
brew install git-secrets

# Or download from: https://github.com/awslabs/git-secrets

# Configure git-secrets for this repo
git secrets --install
git secrets --register-aws  # Optional: AWS patterns
```

### Pre-Commit Hook

Our custom pre-commit hook (`scripts/git-hooks/pre-commit`) scans for:

1. **API Keys:** 32-128 character alphanumeric strings
2. **Connection Strings:** Azure/AWS patterns
3. **Private Keys:** PEM format
4. **JWTs:** Three base64 parts separated by dots
5. **Passwords:** In connection strings
6. **Sensitive Files:** .env, *.key, *.pem

### Usage

```bash
# Normal commit (hook runs automatically)
git commit -m "Add feature"

# If secrets detected:
# ❌ COMMIT BLOCKED: Secrets detected!
# Remove secrets and try again

# Bypass hook (emergency only - requires justification)
git commit --no-verify -m "Emergency hotfix (approved by security team)"
```

### False Positives

If the hook blocks a legitimate commit:

1. **Check if it's truly a false positive** (most blocks are correct!)
2. **Add exception to hook** (in `scripts/git-hooks/pre-commit`)
3. **Use `--no-verify` flag** (document why in commit message)

## Secret Rotation

### Why Rotate Secrets?

- **Security:** Limit blast radius if secret is compromised
- **Compliance:** Many standards require periodic rotation (e.g., PCI-DSS)
- **Best Practice:** Defense in depth strategy

### Rotation Schedule

| Secret | Rotation Frequency | Owner |
|--------|-------------------|-------|
| Gemini API Key | 90 days | Security Team |
| Cosmos DB Key | 180 days | Database Admin |
| Storage Keys | 180 days | Infrastructure |
| Entra Client Secret | 365 days | Identity Admin |

### Rotation Process

1. **Generate new secret** in Azure Portal or CLI
2. **Upload to Key Vault** as new version
3. **Test with new secret** in staging environment
4. **Deploy updated Key Vault reference** (automatic - client fetches latest version)
5. **Verify production** works with new secret
6. **Delete old version** after 7-day grace period

```bash
# Example: Rotate Gemini API key

# 1. Generate new key at https://aistudio.google.com/

# 2. Upload to Key Vault (creates new version automatically)
az keyvault secret set \
  --vault-name kv-kirana-prod \
  --name gemini-api-key \
  --value "AIzaSyC_NEW_KEY_HERE"

# 3. Clear cache in running Function App (optional - expires in 5 min)
# POST /api/admin/clearSecretCache (requires admin role)

# 4. Verify new key works
curl https://func-kirana-prod.azurewebsites.net/api/health

# 5. Delete old version after grace period
az keyvault secret list-versions \
  --vault-name kv-kirana-prod \
  --name gemini-api-key

az keyvault secret delete \
  --vault-name kv-kirana-prod \
  --name gemini-api-key \
  --version <old-version-id>
```

## Security Best Practices

### 1. Principle of Least Privilege

✅ **Do:**
- Grant Function App only `get` and `list` permissions
- Use separate Key Vaults for dev/staging/prod
- Limit secret access to specific identities

❌ **Don't:**
- Give Function App `set` or `delete` permissions
- Share production secrets in dev environments
- Use same Key Vault for multiple applications

### 2. Audit Logging

```bash
# Enable diagnostic logs for Key Vault
az monitor diagnostic-settings create \
  --name kv-audit-logs \
  --resource /subscriptions/.../resourceGroups/rg-kirana-prod/providers/Microsoft.KeyVault/vaults/kv-kirana-prod \
  --logs '[{"category": "AuditEvent", "enabled": true}]' \
  --workspace /subscriptions/.../resourceGroups/rg-kirana-prod/providers/Microsoft.OperationalInsights/workspaces/log-kirana-prod

# Query secret access logs
az monitor log-analytics query \
  --workspace log-kirana-prod \
  --analytics-query "AzureDiagnostics | where ResourceProvider == 'MICROSOFT.KEYVAULT' | where OperationName == 'SecretGet' | project TimeGenerated, CallerIPAddress, identity_claim_oid_g, ResultSignature"
```

### 3. Secret Expiration

```bash
# Set expiration date for secrets (e.g., 90 days)
EXPIRY_DATE=$(date -u -d "+90 days" +"%Y-%m-%dT%H:%M:%SZ")

az keyvault secret set \
  --vault-name kv-kirana-prod \
  --name gemini-api-key \
  --value "AIzaSyC..." \
  --expires $EXPIRY_DATE
```

### 4. Network Isolation

```bash
# Restrict Key Vault access to specific networks
az keyvault update \
  --name kv-kirana-prod \
  --resource-group rg-kirana-prod \
  --default-action Deny

az keyvault network-rule add \
  --name kv-kirana-prod \
  --resource-group rg-kirana-prod \
  --vnet-name vnet-kirana-prod \
  --subnet subnet-functions
```

## Troubleshooting

### "Secret not found" Error

```
Error: Secret gemini-api-key not found in environment variables
```

**Solutions:**
1. Check `local.settings.json` has the secret (local dev)
2. Verify Key Vault has the secret: `az keyvault secret show --vault-name kv-kirana-prod --name gemini-api-key`
3. Check Function App has `KEY_VAULT_URL` setting
4. Verify Managed Identity has Key Vault permissions

### "DefaultAzureCredential failed" Error

```
Error: DefaultAzureCredential failed to retrieve a token from the included credentials.
```

**Solutions:**
1. **Local dev:** Run `az login` and verify with `az account show`
2. **CI/CD:** Set environment variables: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
3. **Production:** Enable Managed Identity on Function App
4. **Firewall:** Check if Key Vault network rules block access

### Secret Cache Not Updating

```
# Secret updated in Key Vault but Function App still using old value
```

**Solutions:**
1. Wait 5 minutes (cache TTL)
2. Restart Function App: `az functionapp restart --name func-kirana-prod --resource-group rg-kirana-prod`
3. Call clear cache endpoint (if implemented): `POST /api/admin/clearSecretCache`

### Git-Secrets Hook Blocks Valid Commit

```
✗ Potential secret found in src/config/secrets.ts
Pattern: [a-zA-Z0-9]{32,128}
```

**Solutions:**
1. Verify it's truly a false positive (double-check!)
2. Add to allowlist in `scripts/git-hooks/pre-commit`
3. Use `git commit --no-verify` with justification in commit message

## References

- [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)
- [DefaultAzureCredential](https://learn.microsoft.com/en-us/dotnet/api/azure.identity.defaultazurecredential)
- [git-secrets](https://github.com/awslabs/git-secrets)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [PRD Section 10: Security & Compliance](/docs/specs/PRD_Kirana.md#10-security--compliance)
