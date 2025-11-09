# Microsoft Entra ID Production Setup

## Your App Registration Details

**App Name**: Kirana  
**Production URL**: https://kirana.vedprakash.net  
**Environment**: Production

```
Application (client) ID:  dfedac17-a76a-4670-af9c-55e2d8e29549
Object ID:                617ff223-dea0-4b66-a471-987b5f069ffb
Directory (tenant) ID:    80fe68b7-105c-4fb9-ab03-c9a818e35848
```

---

## Configuration Strategy

### ✅ **Recommended Approach: Azure Key Vault + Environment Variables**

**Where to store each secret:**

| Secret | Storage Location | Reason |
|--------|-----------------|--------|
| **Client ID** | Frontend env vars + Backend env vars | ✅ Public identifier, safe to expose |
| **Tenant ID** | Frontend env vars + Backend env vars | ✅ Public identifier, safe to expose |
| **Client Secret** | ⚠️ **ONLY** Azure Key Vault | 🔒 Highly sensitive - never expose in frontend |

### Why This Approach?

1. **Client ID & Tenant ID**: 
   - Not sensitive (public identifiers)
   - Frontend needs them for MSAL to initiate OAuth flow
   - Backend needs them for JWT validation
   - Can be committed to GitHub Secrets / Azure App Settings

2. **Client Secret**: 
   - ⚠️ **HIGHLY SENSITIVE** - like a password
   - Only backend uses it (for token validation)
   - Must be stored in Azure Key Vault
   - Never expose in frontend code or environment variables

---

## Step-by-Step Setup

### Step 1: Create Client Secret in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations**
3. Find your app: **"Kirana"** (Client ID: `dfedac17-a76a-4670-af9c-55e2d8e29549`)
4. Click **Certificates & secrets** in the left menu
5. Click **+ New client secret**
   - **Description**: `Kirana Production Secret`
   - **Expires**: 6 months (recommended) or 12 months
6. Click **Add**
7. **CRITICAL**: Copy the **Value** immediately (not the Secret ID!)
   - Example: `abc123~XYZ789-secretvalue-thatYouMustCopy`
   - You won't be able to see it again!
8. Save this value temporarily (you'll add it to Key Vault next)

---

### Step 2: Add Secrets to Azure Key Vault

Azure Key Vault stores **backend** secrets securely with managed identity access.

```bash
# Set your Key Vault name (check deployment-guide.md for actual name)
KEY_VAULT_NAME="kv-kirana"  # Update this if different

# Add client secret to Key Vault
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "entra-client-secret" \
  --value "abc123~XYZ789-secretvalue-thatYouCopied"

# Add client ID to Key Vault (for backend)
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "entra-client-id" \
  --value "dfedac17-a76a-4670-af9c-55e2d8e29549"

# Verify secrets were added
az keyvault secret list \
  --vault-name "$KEY_VAULT_NAME" \
  --query "[?name=='entra-client-secret' || name=='entra-client-id'].{Name:name, Updated:attributes.updated}" \
  --output table
```

**Expected Output:**
```
Name                   Updated
---------------------  ------------------------
entra-client-id        2025-11-08T12:34:56+00:00
entra-client-secret    2025-11-08T12:35:23+00:00
```

---

### Step 3: Configure Backend (Azure Functions)

#### 3.1 Update Function App Settings

Backend accesses secrets via Azure Key Vault using Managed Identity.

```bash
# Get your Function App name (check deployment-guide.md)
FUNCTION_APP_NAME="func-kirana"  # Update this if different
RESOURCE_GROUP="rg-kirana"       # Update this if different

# Set Key Vault URL (if not already set)
az functionapp config appsettings set \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings KEY_VAULT_URL="https://${KEY_VAULT_NAME}.vault.azure.net/"

# Set Entra ID Tenant ID (public identifier, safe in app settings)
az functionapp config appsettings set \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings ENTRA_TENANT_ID="80fe68b7-105c-4fb9-ab03-c9a818e35848"
```

#### 3.2 Verify Managed Identity Access

Ensure Function App can read from Key Vault:

```bash
# Get Function App's Managed Identity Principal ID
FUNCTION_APP_IDENTITY=$(az functionapp identity show \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId \
  --output tsv)

# Grant Key Vault access (if not already configured)
az keyvault set-policy \
  --name "$KEY_VAULT_NAME" \
  --object-id "$FUNCTION_APP_IDENTITY" \
  --secret-permissions get list

echo "✅ Function App can now read secrets from Key Vault"
```

#### 3.3 How Backend Fetches Secrets

Your backend already has `secrets.ts` configured to:

1. Check for `KEY_VAULT_URL` environment variable
2. Use Managed Identity to authenticate
3. Fetch secrets from Key Vault at runtime:
   - `entra-client-secret` → `getSecret(SECRET_NAMES.ENTRA_CLIENT_SECRET)`
   - `entra-client-id` → `getSecret(SECRET_NAMES.ENTRA_CLIENT_ID)`

**No code changes needed!** The backend will automatically fetch secrets from Key Vault.

---

### Step 4: Configure Frontend (Azure Static Web Apps)

Frontend needs **public identifiers** (Client ID, Tenant ID) to initiate OAuth flow with MSAL.

#### 4.1 Update Static Web App Configuration

```bash
# Get your Static Web App name
STATIC_WEB_APP_NAME="stapp-kirana"  # Update this if different

# Set Entra ID Client ID
az staticwebapp appsettings set \
  --name "$STATIC_WEB_APP_NAME" \
  --setting-names \
    VITE_ENTRA_CLIENT_ID="dfedac17-a76a-4670-af9c-55e2d8e29549" \
    VITE_ENTRA_TENANT_ID="80fe68b7-105c-4fb9-ab03-c9a818e35848" \
    VITE_ENTRA_REDIRECT_URI="https://kirana.vedprakash.net/auth/callback" \
    VITE_ENTRA_AUTHORITY="https://login.microsoftonline.com/"
```

#### 4.2 Add to GitHub Secrets (for CI/CD builds)

GitHub Actions needs these values during the build process to bundle into the frontend.

```bash
# Using GitHub CLI
gh secret set VITE_ENTRA_CLIENT_ID --body "dfedac17-a76a-4670-af9c-55e2d8e29549"
gh secret set VITE_ENTRA_TENANT_ID --body "80fe68b7-105c-4fb9-ab03-c9a818e35848"
```

Or manually via GitHub web interface:
1. Go to: https://github.com/vedprakash-m/kirana/settings/secrets/actions
2. Add these secrets:
   - Name: `VITE_ENTRA_CLIENT_ID`
   - Value: `dfedac17-a76a-4670-af9c-55e2d8e29549`
   
   - Name: `VITE_ENTRA_TENANT_ID`
   - Value: `80fe68b7-105c-4fb9-ab03-c9a818e35848`

---

### Step 5: Update App Registration Redirect URIs

Ensure your Entra ID app registration allows production redirects.

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Find **"Kirana"** (Client ID: `dfedac17-a76a-4670-af9c-55e2d8e29549`)
3. Click **Authentication** in the left menu
4. Under **Platform configurations** → **Web**, ensure these URIs are listed:
   - ✅ `https://kirana.vedprakash.net`
   - ✅ `https://kirana.vedprakash.net/auth/callback`
   - ✅ `http://localhost:5173` (for local dev)
   - ✅ `http://localhost:5173/auth/callback` (for local dev)

5. Under **Implicit grant and hybrid flows**:
   - ✅ Check **"ID tokens (used for implicit and hybrid flows)"**

6. Click **Save**

---

### Step 6: Configure API Permissions

1. In the same app registration, click **API permissions**
2. Ensure these permissions are granted:
   - `Microsoft Graph` → `User.Read` (Delegated)
   - `OpenId permissions`: `openid`, `profile`, `email`

3. Click **Grant admin consent for [Your Organization]**
   - This prevents users from seeing a consent screen on first login

---

### Step 7: Test Production Login

#### 7.1 Deploy Updated Configuration

```bash
# If you updated GitHub Secrets, trigger a new deployment
git commit --allow-empty -m "Trigger deployment with Entra ID config"
git push origin main
```

Wait for GitHub Actions to complete (~5-10 minutes).

#### 7.2 Test Login Flow

1. Go to https://kirana.vedprakash.net
2. You should be redirected to `/login`
3. Click **"Sign in with Microsoft"**
4. You'll be redirected to Microsoft Entra ID login:
   ```
   https://login.microsoftonline.com/80fe68b7-105c-4fb9-ab03-c9a818e35848/oauth2/v2.0/authorize?...
   ```
5. Sign in with your Microsoft account (must be in the same tenant)
6. After successful authentication:
   - Redirected back to `https://kirana.vedprakash.net`
   - Should see Dashboard with "Your inventory is empty"

#### 7.3 Verify JWT Token

Open browser DevTools → **Application** tab → **Session Storage** → `kirana.vedprakash.net`

You should see:
```json
{
  "kirana-auth-state": {
    "isAuthenticated": true,
    "user": {
      "id": "...",
      "email": "your@email.com",
      "displayName": "Your Name"
    },
    "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "tokenExpiry": 1731099999
  }
}
```

---

## Security Checklist

Before going live, verify:

- ✅ Client secret stored **ONLY** in Azure Key Vault (never in code/env vars)
- ✅ Function App has Managed Identity enabled
- ✅ Function App has Key Vault access policy configured
- ✅ Redirect URIs include production domain (`https://kirana.vedprakash.net`)
- ✅ API permissions granted with admin consent
- ✅ GitHub Secrets configured for CI/CD builds
- ✅ Static Web App environment variables set
- ✅ Local dev still works with `local.settings.json` (separate dev app registration recommended)

---

## Local Development Setup (Separate)

**⚠️ Important**: For local development, create a **separate** app registration to avoid mixing dev/prod credentials.

### Create Dev App Registration

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `Kirana-Dev`
3. Redirect URI: `http://localhost:5173`, `http://localhost:5173/auth/callback`
4. Note the Client ID and Tenant ID (different from production!)
5. Create a client secret for local backend testing

### Configure Local Environment

**Frontend** (`frontend/.env.local`):
```bash
VITE_ENTRA_CLIENT_ID=<dev-client-id>
VITE_ENTRA_TENANT_ID=80fe68b7-105c-4fb9-ab03-c9a818e35848
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/
```

**Backend** (`backend/local.settings.json`):
```json
{
  "Values": {
    "ENTRA_TENANT_ID": "80fe68b7-105c-4fb9-ab03-c9a818e35848",
    "ENTRA_CLIENT_ID": "<dev-client-id>",
    "ENTRA_CLIENT_SECRET": "<dev-client-secret>"
  }
}
```

**⚠️ Never commit** `.env.local` or `local.settings.json` to Git!

---

## Troubleshooting

### Error: "AADSTS50011: The redirect URI does not match"

**Solution**: Check redirect URIs in Azure Portal match exactly (including protocol, trailing slashes).

### Error: "Failed to fetch secret from Key Vault"

**Solution**: 
1. Verify `KEY_VAULT_URL` is set in Function App settings
2. Check Managed Identity is enabled: `az functionapp identity show --name func-kirana --resource-group rg-kirana`
3. Verify Key Vault access policy: `az keyvault show --name kv-kirana --query "properties.accessPolicies"`

### Error: "CORS error when calling /api/auth/login"

**Solution**: Check Function App CORS settings allow `https://kirana.vedprakash.net`:
```bash
az functionapp cors show --name func-kirana --resource-group rg-kirana
```

### Error: "Client secret expired"

**Solution**: Rotate the secret:
1. Azure Portal → App registration → Certificates & secrets
2. Create new client secret
3. Update Key Vault: `az keyvault secret set --vault-name kv-kirana --name entra-client-secret --value <new-secret>`
4. Delete old secret after verifying new one works

---

## Secret Rotation Schedule

| Secret | Rotation Frequency | How to Rotate |
|--------|-------------------|---------------|
| Client Secret | Every 6 months | Azure Portal → New client secret → Update Key Vault |
| JWT Secret | Every 12 months | Generate new random string → Update Key Vault |
| Gemini API Key | As needed | Google AI Studio → Update Key Vault |

**Set a calendar reminder** to rotate the client secret **before** it expires!

---

## Summary

### ✅ What You Configured

| Component | Configuration | Storage Location |
|-----------|--------------|------------------|
| **Client ID** | `dfedac17-a76a-4670-af9c-55e2d8e29549` | GitHub Secrets + Static Web App settings + Key Vault |
| **Tenant ID** | `80fe68b7-105c-4fb9-ab03-c9a818e35848` | GitHub Secrets + Static Web App settings + Function App settings |
| **Client Secret** | `abc123~...` (created in Step 1) | ⚠️ **ONLY** Azure Key Vault |

### 🔒 Security Architecture

```
Frontend (Public)
  ├─ Client ID  ✅ (public identifier)
  ├─ Tenant ID  ✅ (public identifier)
  └─ Redirects user to Microsoft login

Microsoft Entra ID
  └─ User authenticates
  └─ Returns ID token + access token

Backend (Private)
  ├─ Client ID  ✅ (from Key Vault)
  ├─ Client Secret  🔒 (from Key Vault - NEVER exposed)
  └─ Validates JWT signature
  └─ Creates session, issues app-specific JWT
```

### 📋 Next Steps

1. ✅ Secrets added to Key Vault
2. ✅ Function App configured with Managed Identity
3. ✅ Static Web App environment variables set
4. ✅ GitHub Secrets configured for CI/CD
5. ✅ Redirect URIs updated in app registration
6. 🔄 Deploy and test production login
7. 🔄 Create separate dev app registration for local development

---

**You're ready for production!** 🚀

Users can now sign in with their Microsoft accounts at https://kirana.vedprakash.net.
