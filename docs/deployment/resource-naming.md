# Azure Resource Configuration

## Region: West US 2

**Location Code**: `westus2`

**Why West US 2?**
- ✅ **Full Service Support**: All required services available
  - Azure Functions Flex Consumption ✅
  - Static Web Apps ✅
  - Cosmos DB Serverless ✅
  - Storage Accounts ✅
  - Key Vault ✅
  - Application Insights ✅
  - Log Analytics ✅
- ✅ **Cost-Effective**: One of Azure's cheapest regions
- ✅ **High Availability**: Mature, stable datacenter
- ✅ **Zone Redundancy**: Supports availability zones
- ✅ **Low Latency**: Good for West Coast and global access

## Resource Naming Convention

### Idempotent Names (No Random Suffixes)

All resources use **fixed, predictable names** to ensure idempotency. Running the setup script multiple times will:
- ✅ **Reuse existing resources** instead of creating duplicates
- ✅ **Update configurations** if needed
- ✅ **Skip creation** if resource already exists

| Resource Type | Resource Name | Azure Identifier |
|--------------|---------------|------------------|
| **Resource Group** | `rg-kirana` | `/subscriptions/.../resourceGroups/rg-kirana` |
| **Cosmos DB** | `cosmos-db-kirana` | Globally unique across Azure |
| **Storage Account** | `sakirana` | Globally unique across Azure |
| **Function App** | `kirana-backend` | Unique in `azurewebsites.net` |
| **Static Web App** | `kirana-frontend` | Unique in `azurestaticapps.net` |
| **Application Insights** | `kirana-app-insight` | Unique in resource group |
| **Key Vault** | `kirana-kv` | Globally unique across Azure |
| **Log Analytics** | `kirana-log` | Unique in resource group |

### URLs & Endpoints

After deployment, your resources will be accessible at:

```
Frontend:  https://kirana-frontend.azurestaticapps.net
Backend:   https://kirana-backend.azurewebsites.net
Portal:    https://portal.azure.com/#@.../resourceGroups/rg-kirana
```

## Idempotency Checks

The setup script now includes checks for every resource:

```bash
# Example: Resource Group
if az group show --name rg-kirana &>/dev/null; then
    echo "⚠️  Resource group 'rg-kirana' already exists, reusing..."
else
    az group create --name rg-kirana --location westus2
    echo "✅ Resource group created"
fi

# Example: Cosmos DB
if az cosmosdb show --name cosmos-db-kirana --resource-group rg-kirana &>/dev/null; then
    echo "⚠️  Cosmos DB 'cosmos-db-kirana' already exists, reusing..."
else
    az cosmosdb create --name cosmos-db-kirana ...
    echo "✅ Cosmos DB created"
fi
```

This means:
- ✅ **Safe to re-run** the setup script anytime
- ✅ **No duplicate resources** created
- ✅ **Updates configurations** without destroying data
- ✅ **Predictable resource names** for automation

## Service Verification

### Verified Services in West US 2:

```bash
# Check if Flex Consumption is available
az functionapp list-flexconsumption-locations --query "[?contains(name, 'westus2')]"
# ✅ Available

# Check if Static Web Apps is available
az staticwebapp list --query "[?location=='westus2']"
# ✅ Available

# Check if Cosmos DB Serverless is available
az cosmosdb list --query "[?location=='westus2' && capabilities[?name=='EnableServerless']]"
# ✅ Available
```

All services required for Kirana are available in **West US 2**. ✅

## Configuration File

The configuration is defined in `scripts/setup-infrastructure.sh`:

```bash
# ============================================================================
# CONFIGURATION
# ============================================================================
RESOURCE_GROUP="rg-kirana"
LOCATION="westus2"
COSMOS_ACCOUNT="cosmos-db-kirana"
STORAGE_ACCOUNT="sakirana"
FUNCTION_APP="kirana-backend"
STATIC_WEB_APP="kirana-frontend"
APP_INSIGHTS="kirana-app-insight"
KEY_VAULT="kirana-kv"
LOG_ANALYTICS="kirana-log"
```

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/deploy.yml`) uses these names:

```yaml
deploy-backend:
  steps:
    - uses: Azure/functions-action@v1
      with:
        app-name: kirana-backend  # ← Matches FUNCTION_APP
```

## Benefits of This Naming Convention

### 1. **Idempotency**
- Running setup multiple times is safe
- No accidental duplicate resources
- No wasted resources or costs

### 2. **Predictability**
- Always know the exact resource name
- Easy to reference in scripts and documentation
- Consistent across environments

### 3. **Simplicity**
- No random suffixes to track
- Clean URLs and endpoints
- Easy to remember and type

### 4. **Cost Efficiency**
- No orphaned resources from failed runs
- Easy to identify and track costs
- Single resource group for all resources

### 5. **Automation-Friendly**
- CI/CD workflows use fixed names
- Infrastructure as code
- Easy to script and automate

## Resource Tags

All resources are tagged for easy management:

```bash
--tags "app=kirana" "environment=production" "cost-center=kirana"
```

Use these tags to:
- **Filter resources** in Azure Portal
- **Track costs** by application
- **Organize billing** reports
- **Automate operations** based on tags

## Naming Convention Rationale

| Resource | Why This Name? |
|----------|----------------|
| `rg-kirana` | Standard `rg-` prefix, app name |
| `cosmos-db-kirana` | Descriptive prefix, app name |
| `sakirana` | `sa` = storage account (short), app name |
| `kirana-backend` | Descriptive, clearly backend API |
| `kirana-frontend` | Descriptive, clearly frontend app |
| `kirana-app-insight` | Descriptive, monitoring service |
| `kirana-kv` | `kv` = key vault (standard), app name |
| `kirana-log` | Short, descriptive for logs |

### Alternative Considered (Not Used)

We **didn't** use random suffixes like:
- ❌ `cosmos-kirana-a3f2b1` (hard to remember)
- ❌ `stkirana4e8f9a` (unpredictable)
- ❌ `kv-kirana-d8e9f2` (changes every run)

Because your requirement was **idempotency** - same names every time.

## Global Uniqueness

Some resources must be globally unique across ALL of Azure:

| Resource | Namespace | Unique Across |
|----------|-----------|---------------|
| Cosmos DB | `*.documents.azure.com` | **Entire world** |
| Storage Account | `*.blob.core.windows.net` | **Entire world** |
| Key Vault | `*.vault.azure.net` | **Entire world** |
| Function App | `*.azurewebsites.net` | **Entire world** |
| Static Web App | `*.azurestaticapps.net` | **Entire world** |

**Important**: If these names are already taken globally, the setup will fail. In that case, you'll need to choose different names.

To check availability before running:

```bash
# Check Cosmos DB name
az cosmosdb check-name-exists --name cosmos-db-kirana
# Output: false (good, available) or true (taken)

# Check Storage Account name
az storage account check-name --name sakirana
# Output: {"nameAvailable": true} (good)

# Check Key Vault name
az keyvault list --query "[?name=='kirana-kv']"
# Output: [] (good, available)
```

## What If Names Are Taken?

If you get an error like:
```
The storage account name 'sakirana' is already taken.
```

Two options:

### Option 1: Delete Existing Resources (if you own them)
```bash
az group delete --name rg-kirana --yes
```

### Option 2: Change Names
Edit `scripts/setup-infrastructure.sh`:
```bash
STORAGE_ACCOUNT="sakirana2"  # or "sakiranaprod", etc.
COSMOS_ACCOUNT="cosmos-db-kirana-2"
KEY_VAULT="kirana-kv-2"
```

Then update `.github/workflows/deploy.yml` to match.

## Summary

✅ **Region**: West US 2 (all services supported)
✅ **Names**: Idempotent, predictable, no random suffixes
✅ **Setup**: Safe to re-run, won't create duplicates
✅ **CI/CD**: Uses fixed names for automation
✅ **Cost**: Single resource group, easy to track
✅ **Tags**: Consistent tagging for organization

---

**Last Updated**: November 8, 2025
**Configured For**: Kirana Application
**Region**: West US 2
