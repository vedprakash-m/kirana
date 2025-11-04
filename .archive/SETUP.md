# Kirana Setup Guide

**Last Updated:** November 2, 2025  
**Project Status:** Phase 1A Complete (Backend Core Services)

> For detailed task tracking and progress, see **`docs/specs/Tasks_Kirana.md`** (single source of truth)

## ✅ Completed Tasks

### Project Structure
- [x] Backend directory structure created
- [x] Frontend directory structure created (already existed)
- [x] Shared types directory created
- [x] Scripts directory created

### Configuration Files
- [x] `backend/package.json` - Dependencies and scripts
- [x] `backend/tsconfig.json` - TypeScript configuration
- [x] `backend/host.json` - Azure Functions configuration
- [x] `backend/local.settings.json` - Environment variables template
- [x] `backend/.env.example` - Environment variables documentation
- [x] `frontend/.env.example` - Frontend environment variables
- [x] `.gitignore` - Git ignore rules
- [x] Root `README.md` - Project documentation

### Shared Types
- [x] `shared/types.ts` - Comprehensive TypeScript definitions (800+ lines)
  - Core domain models (Item, Transaction, Household)
  - LLM & Parsing types (ParseJob, ParsedItem, CacheEntry)
  - API DTOs (Request/Response types)
  - Frontend state types
  - Enums and utility types

### Symlinks
- [x] `frontend/src/types/shared.ts` → `shared/types.ts`
- [x] `backend/src/types/shared.ts` → `shared/types.ts`
- [x] Script created: `scripts/symlink-shared-types.sh`

### Infrastructure Scripts
- [x] `scripts/setup-azure-infrastructure.sh` - Complete Azure provisioning
- [x] `scripts/setup-cosmos-containers.js` - Cosmos DB container creation

### CI/CD
- [x] `.github/workflows/deploy.yml` - GitHub Actions pipeline
  - Lint & type check
  - Build & test (frontend/backend)
  - Deploy to Azure Functions
  - Deploy frontend (placeholder)

## 🔲 Remaining Tasks

### Task 0.1.1-0.1.9: Azure Resource Provisioning
**Status:** Scripts ready, awaiting manual execution

**Prerequisites:**
- Azure CLI installed
- Azure subscription active
- Logged into Azure (`az login`)

**To Execute:**
```bash
# 1. Login to Azure
az login

# 2. Run infrastructure setup (10-15 minutes)
./scripts/setup-azure-infrastructure.sh

# 3. Create Cosmos DB containers
cd backend
npm install @azure/cosmos dotenv
cd ..
node scripts/setup-cosmos-containers.js
```

**Resources Created:**
- Resource Group: `rg-kirana-dev`
- Cosmos DB: `cosmos-kirana-dev` with 7 containers
- Storage Account: `stkiranadev` with 3 blob containers
- Function App: `func-kirana-dev`
- Application Insights: `appi-kirana-dev`
- Key Vault: `kv-kirana-dev`

### Task 0.1.7: Microsoft Entra ID Setup
**Status:** Manual configuration required

**Steps:**
1. Go to [Azure Portal](https://portal.azure.com) → Entra ID → App registrations
2. Create new registration:
   - Name: "Kirana Dev"
   - Accounts: Personal + Organizational
   - Redirect URI (SPA): `http://localhost:5173/auth/callback`
3. Add API permissions:
   - Microsoft Graph → `User.Read`
   - Microsoft Graph → `offline_access`
4. Copy Client ID and Tenant ID
5. Update `frontend/.env.local`:
   ```
   VITE_ENTRA_CLIENT_ID=<your-client-id>
   VITE_ENTRA_TENANT_ID=<your-tenant-id>
   ```
6. Store secrets in Key Vault:
   ```bash
   az keyvault secret set --vault-name kv-kirana-dev --name EntraClientId --value "<client-id>"
   az keyvault secret set --vault-name kv-kirana-dev --name EntraTenantId --value "<tenant-id>"
   ```

### Task 0.1.8: Google Gemini API Setup
**Status:** Manual configuration required

**Steps:**
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key" → "Create API Key"
3. Copy the API key
4. Update `backend/local.settings.json`:
   ```json
   "GEMINI_API_KEY": "your-api-key-here"
   ```
5. Store in Key Vault:
   ```bash
   az keyvault secret set --vault-name kv-kirana-dev --name GeminiApiKey --value "your-api-key"
   ```

### Task 0.2.2: Configure TailwindCSS
**Status:** Needs implementation

**Files to Create:**
- `frontend/tailwind.config.js`
- Update `frontend/src/index.css`

**Design Tokens (from UX Spec 6.1):**
- Urgency colors: Red (#EF4444), Yellow (#F59E0B), Green (#10B981)
- Neutrals: Gray scale
- Brand colors: Blue (#3B82F6)

## 📋 Next Steps (In Order)

1. **Install Dependencies**
   ```bash
   # Frontend
   cd frontend
   npm install
   
   # Backend
   cd ../backend
   npm install
   ```

2. **Run Azure Setup Scripts**
   ```bash
   ./scripts/setup-azure-infrastructure.sh
   node scripts/setup-cosmos-containers.js
   ```

3. **Configure Microsoft Entra ID**
   - Follow steps in Task 0.1.7 above

4. **Get Gemini API Key**
   - Follow steps in Task 0.1.8 above

5. **Configure Environment Files**
   ```bash
   # Frontend
   cp frontend/.env.example frontend/.env.local
   # Edit frontend/.env.local with Entra ID credentials
   
   # Backend
   # Edit backend/local.settings.json with Azure connection strings
   ```

6. **Configure TailwindCSS**
   - Create `frontend/tailwind.config.js`
   - Add design tokens

7. **Verify Setup**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run build
   npm start
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

8. **Initialize Git Repository** (if not done)
   ```bash
   git init
   git add .
   git commit -m "Phase 0: Infrastructure setup complete"
   ```

## 🎯 Acceptance Criteria

Phase 0 is complete when:
- [ ] All Azure resources provisioned and accessible
- [ ] Backend Functions app can be started locally (`func start`)
- [ ] Frontend app runs locally (`npm run dev`)
- [ ] Types compile without errors in both projects
- [ ] CI/CD pipeline runs successfully
- [ ] Environment variables configured (no secrets in git)
- [ ] TailwindCSS configured with design tokens

## 🔗 Useful Links

- [Azure Portal](https://portal.azure.com)
- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [Cosmos DB Documentation](https://docs.microsoft.com/en-us/azure/cosmos-db/)
- [Google AI Studio](https://aistudio.google.com/)
- [Microsoft Entra ID](https://entra.microsoft.com/)

## 📊 Cost Estimate (Phase 0)

| Resource | Tier | Monthly Cost |
|----------|------|--------------|
| Cosmos DB | 400 RU/s shared | ~$24 |
| Azure Functions | Consumption | ~$0 (free tier) |
| Blob Storage | Hot tier | ~$1 |
| Application Insights | Basic | ~$0 (free tier) |
| Key Vault | Standard | ~$1 |
| **Total** | | **~$26/month** |

**Note:** This is development environment cost. Production costs will scale with usage.

## 🚨 Blockers & Issues

None currently. All setup scripts are ready for execution.

## 📝 Notes

- All infrastructure scripts are idempotent (safe to re-run)
- Cosmos DB setup takes 5-10 minutes
- Key Vault integration requires Function App managed identity

---

## 📚 For Implementation Progress

**See `docs/specs/Tasks_Kirana.md` for:**
- Complete task list with checkboxes
- Phase completion status
- Implementation notes and decisions
- Next steps and blockers

This is the **single source of truth** for project progress.
- Gmail OAuth (for email forwarding) has 4-6 week approval timeline - started early
