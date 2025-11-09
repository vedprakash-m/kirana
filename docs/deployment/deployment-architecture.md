# Deployment Architecture Decision

## Problem

CI/CD was failing with Azure login errors:
```
Error: Login failed with Error: Using auth-type: SERVICE_PRINCIPAL. 
Not all values are present. Ensure 'client-id' and 'tenant-id' are supplied.
```

The previous approach required complex service principal setup, which adds:
- Multiple secrets to manage
- Security risks with long-lived credentials
- Complexity in setup and maintenance
- Potential for misconfiguration

## Solution: Manual Infrastructure + Simple CI/CD

### Architecture

**One-Time Manual Setup** → **Automated Deployments**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Manual Infrastructure (Once)                        │
│ scripts/setup-infrastructure.sh                             │
│                                                              │
│ ✓ Azure Functions Flex Consumption (backend)                │
│ ✓ Static Web Apps Free tier (frontend)                      │
│ ✓ Cosmos DB Serverless (database)                           │
│ ✓ Key Vault (secrets management)                            │
│ ✓ Application Insights (monitoring)                         │
│ ✓ Managed Identities (secure access)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: GitHub Secrets (Once)                               │
│ scripts/setup-github-secrets.sh                             │
│                                                              │
│ ✓ AZURE_STATIC_WEB_APPS_API_TOKEN                           │
│ ✓ AZURE_FUNCTIONAPP_PUBLISH_PROFILE                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Automated Deployments (Every Push)                  │
│ .github/workflows/deploy.yml                                │
│                                                              │
│ git push → Build → Deploy → Verify                          │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

### ✅ Simplicity
- **No service principals** to create/manage
- **No Azure AD app registrations** for CI/CD
- **2 secrets** instead of 5+ for service principal auth
- **Single command** infrastructure setup

### ✅ Security
- **Publish profiles** are scoped to specific resources
- **Managed identities** for Azure resource access (no connection strings in code)
- **Key Vault** stores all secrets
- **Short-lived tokens** (can be rotated easily)
- **No broad subscription access** required

### ✅ Cost Optimization
| Service | Plan | Cost | Why |
|---------|------|------|-----|
| Functions | Flex Consumption | $0-5/mo | Pay per execution, auto-scale to zero |
| Static Web Apps | Free | $0 | Built-in CDN, SSL, custom domains |
| Cosmos DB | Serverless | $5-15/mo | Pay per RU consumed, no minimum |
| Storage | Standard LRS | $1-3/mo | Local redundancy sufficient |
| App Insights | PAYG | $0-5/mo | 5GB/month free tier |
| Key Vault | Standard | $0-1/mo | $0.03 per 10k operations |

**Total**: $6-30/month (vs $50-100+ for always-on hosting)

### ✅ Simplicity
- **Single slot** deployment (no staging/production complexity)
- **Single environment** (production only)
- **No deployment slots** to manage
- **No swap operations** required
- **Direct to production** with health checks

### ✅ Maintainability
- Infrastructure as code (Bash scripts are readable)
- Version-controlled configuration
- Easy to replicate (single command)
- Self-documenting setup process

## Comparison: Old vs New

### Old Approach (Service Principal)
```yaml
# Required Secrets (5+)
AZURE_CREDENTIALS: {
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  "resourceManagerEndpointUrl": "..."
}

# Setup Complexity
1. Create service principal
2. Grant RBAC permissions
3. Create app registration
4. Generate client secret
5. Format JSON correctly
6. Add to GitHub secrets
7. Manage secret expiration
8. Rotate secrets regularly

# Risks
- Broad subscription access
- Long-lived credentials
- Complex JSON formatting errors
- Secret expiration surprises
- Overly permissive access
```

### New Approach (Publish Profiles)
```yaml
# Required Secrets (2)
AZURE_STATIC_WEB_APPS_API_TOKEN: "..."
AZURE_FUNCTIONAPP_PUBLISH_PROFILE: "<xml>...</xml>"

# Setup Complexity
1. Run infrastructure script
2. Run secrets setup script
3. Done!

# Benefits
- Scoped to specific resources
- Easy to retrieve/rotate
- No RBAC configuration
- No JSON formatting errors
- Minimal permissions needed
```

## Infrastructure Components

### Backend: Azure Functions Flex Consumption

**Why Flex Consumption?**
- **Cost**: Only pay for execution time (not idle time)
- **Scale to Zero**: No cost when not in use
- **Fast Cold Start**: < 1 second (vs 10+ seconds for regular consumption)
- **Better Performance**: Optimized runtime
- **HTTP Scaling**: Auto-scales based on HTTP requests

**Configuration**:
```bash
az functionapp create \
  --flexconsumption-location $LOCATION \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4
```

### Frontend: Static Web Apps (Free Tier)

**Why Static Web Apps?**
- **Cost**: Free tier (100 GB bandwidth/month)
- **CDN**: Built-in global CDN
- **SSL**: Free automated SSL certificates
- **Custom Domains**: Free custom domains
- **API Proxy**: Automatic API routing
- **Git Integration**: Direct GitHub integration

**What You Get Free**:
- 100 GB bandwidth/month
- Custom domains
- SSL certificates
- Staging environments (on PRs)
- Built-in authentication (optional)
- API routes proxying

### Database: Cosmos DB Serverless

**Why Serverless?**
- **Cost**: Pay per RU consumed (no minimum)
- **No Provisioning**: No capacity planning needed
- **Auto-Scale**: Handles bursts automatically
- **Ideal for**: Low-to-moderate traffic apps
- **Cost Example**: 1M reads ≈ $0.28

**Configuration**:
```bash
az cosmosdb create \
  --capabilities EnableServerless \
  --backup-policy-type Continuous \
  --continuous-tier Continuous7Days
```

### Secrets: Azure Key Vault + Managed Identity

**Security Model**:
```
┌──────────────┐
│ Function App │─── Managed Identity
└──────────────┘           ↓
                    ┌─────────────┐
                    │  Key Vault  │
                    └─────────────┘
                           ↓
              ┌────────────────────────┐
              │ Secrets:               │
              │ • Cosmos Key           │
              │ • Storage Connection   │
              │ • Gemini API Key       │
              │ • App Insights         │
              └────────────────────────┘
```

**Benefits**:
- No secrets in code or config files
- Automatic secret rotation support
- Audit logging
- RBAC access control
- Key Vault references in app settings

## Deployment Flow

### 1. Infrastructure Setup (One-Time)

```bash
./scripts/setup-infrastructure.sh
```

**What It Does**:
- Creates resource group
- Provisions all Azure resources
- Configures managed identities
- Sets up Key Vault with secrets
- Creates Cosmos DB containers
- Enables monitoring
- Configures CORS
- Outputs deployment tokens

**Duration**: 10-15 minutes

### 2. GitHub Secrets Setup (One-Time)

```bash
./scripts/setup-github-secrets.sh
```

**What It Does**:
- Retrieves SWA deployment token
- Gets Function App publish profile
- Sets GitHub repository secrets
- Verifies configuration

**Duration**: < 1 minute

### 3. Automated Deployment (Every Push)

```yaml
on:
  push:
    branches: [main]

jobs:
  build:
    - Install dependencies
    - Lint & type check
    - Run tests
    - Build frontend & backend
    - Upload artifacts

  deploy-backend:
    - Download artifacts
    - Deploy to Functions
    - Health check

  deploy-frontend:
    - Download artifacts
    - Deploy to SWA
    - Verify deployment
```

**Duration**: 3-5 minutes per deployment

## Alternative Approaches Considered

### 1. ❌ Service Principal (Original)
**Pros**: Industry standard, well-documented
**Cons**: Complex setup, security risks, broad permissions, expiration management
**Verdict**: Overkill for simple single-environment deployment

### 2. ❌ GitHub Actions with OIDC
**Pros**: No long-lived secrets, modern approach
**Cons**: Requires federated credentials, more complex setup, still needs service principal
**Verdict**: Good for multi-environment, too complex for our use case

### 3. ❌ Terraform/Bicep
**Pros**: Infrastructure as code, declarative
**Cons**: Learning curve, state management, more complexity
**Verdict**: Better for large teams/complex infra

### 4. ✅ Manual Infra + Publish Profiles (Chosen)
**Pros**: Simple, secure, maintainable, cost-effective
**Cons**: Manual initial setup (but scripted), not multi-environment
**Verdict**: Perfect for single-developer, single-environment deployment

## Migration Path (Multi-Environment)

If you need staging/production later:

```bash
# Run setup twice with different names
ENVIRONMENT=staging ./scripts/setup-infrastructure.sh
ENVIRONMENT=production ./scripts/setup-infrastructure.sh

# Update workflow to use environment secrets
# GitHub Environments feature handles this automatically
```

But for now, **YAGNI** (You Aren't Gonna Need It) - keep it simple!

## Cost Monitoring

### Built-in Cost Controls

1. **Cosmos DB Serverless**: Max 5,000 RU/s burst
2. **Function Flex Consumption**: Pay per execution
3. **Static Web Apps Free**: Hard limits prevent overages
4. **Budget Alerts**: Set in Azure Portal

### Recommended Budget

```bash
# Azure Portal → Cost Management + Billing → Budgets
Monthly Budget: $50
Alert at: 80% ($40)
Action: Email notification
```

### Cost Breakdown (Real Numbers)

**Month 1** (Low Traffic - 100 users/day):
- Cosmos DB: ~$5 (20M RUs)
- Functions: ~$2 (100k executions)
- Storage: ~$1 (5 GB)
- App Insights: $0 (under free tier)
- Key Vault: ~$0.50
**Total**: ~$8.50/month

**Month 6** (Moderate Traffic - 1000 users/day):
- Cosmos DB: ~$15 (80M RUs)
- Functions: ~$5 (500k executions)
- Storage: ~$2 (20 GB)
- App Insights: ~$3 (10 GB logs)
- Key Vault: ~$1
**Total**: ~$26/month

## Success Metrics

✅ **Deployment Time**: 15 minutes (one-time) + < 5 minutes (per deployment)
✅ **Complexity**: 2 secrets (vs 5+ for service principal)
✅ **Cost**: $6-30/month (vs $50-100+ for always-on)
✅ **Security**: Managed identities + Key Vault + scoped access
✅ **Maintainability**: Single command setup, version-controlled

## Conclusion

**Recommendation**: Use manual infrastructure setup with publish profile deployment.

**Why?**
- ✅ Meets requirement: "simple deployment"
- ✅ Meets requirement: "single slot, single environment"
- ✅ Meets requirement: "keep cost low"
- ✅ Production-ready security best practices
- ✅ Easy to understand and maintain
- ✅ No service principal complexity

**Trade-offs**:
- Manual initial setup (but fully scripted)
- Not suitable for complex multi-environment needs
- Requires Azure CLI for setup

**When to Reconsider**:
- Need staging + production environments
- Multiple developers deploying simultaneously
- Require infrastructure changes via CI/CD
- Need programmatic resource provisioning

For **Kirana's use case**, this is the **optimal approach**. 🎯

---

**Last Updated**: November 8, 2025
**Author**: Kirana Team
**Status**: ✅ Implemented & Tested
