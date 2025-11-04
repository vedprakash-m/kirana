# Kirana - Smart Household Inventory Management

> Predictive inventory management for households. Never run out of essentials again.

## 🎯 Project Overview

Kirana helps households manage their grocery inventory with AI-powered predictions. Upload your order history, and Kirana predicts when items will run out, helping you restock at the right time.

**Status:** Phase 1A - Backend Core Services ✅ (9/12 tasks, 75%)  
**Timeline:** Week 2 of 12-week implementation plan  
**Next:** Phase 1B - Frontend Foundation

## 📚 Documentation

**PRIMARY SOURCE OF TRUTH:**
- **Implementation Tasks & Progress:** `docs/specs/Tasks_Kirana.md` ⭐

**Product Documentation:**
- **Product Requirements:** `docs/specs/PRD_Kirana.md`
- **Technical Specification:** `docs/specs/Tech_Spec_Kirana.md`
- **UX Design Specification:** `docs/specs/UX_Kirana.md`

## 🏗️ Project Structure

```
kirana/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API clients
│   │   ├── store/         # Zustand state management
│   │   ├── types/         # TypeScript types (symlinked)
│   │   ├── utils/         # Utility functions
│   │   └── hooks/         # Custom React hooks
│   └── package.json
├── backend/           # Azure Functions + Node.js
│   ├── src/
│   │   ├── functions/     # Azure Functions
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access layer
│   │   ├── models/        # Domain models
│   │   ├── types/         # TypeScript types (symlinked)
│   │   └── utils/         # Utility functions
│   └── package.json
├── shared/            # Shared TypeScript types
│   └── types.ts       # Common types for frontend/backend
├── scripts/           # Setup and deployment scripts
│   ├── setup-azure-infrastructure.sh
│   └── setup-cosmos-containers.js
└── docs/              # Product documentation
    └── specs/
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (LTS)
- **Azure CLI** (`brew install azure-cli`)
- **Azure Subscription** (required for infrastructure)
- **Azure Functions Core Tools** (`npm install -g azure-functions-core-tools@4`)

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Install script dependencies
cd ..
npm install -g @azure/cosmos dotenv
```

### 2. Azure Infrastructure Setup

```bash
# Login to Azure
az login

# Run infrastructure setup script
./scripts/setup-azure-infrastructure.sh

# Create Cosmos DB containers
node scripts/setup-cosmos-containers.js
```

This will create:
- ✅ Resource Group (`rg-kirana-dev`)
- ✅ Cosmos DB account with 7 containers
- ✅ Azure Blob Storage (3 containers)
- ✅ Azure Functions app
- ✅ Application Insights
- ✅ Azure Key Vault

### 3. Configure Environment Variables

**Backend (`backend/local.settings.json`):**
```bash
cp backend/.env.example backend/local.settings.json
# Fill in connection strings from setup script output
```

**Frontend (`frontend/.env.local`):**
```bash
cp frontend/.env.example frontend/.env.local
# Add Entra ID client ID and tenant ID
```

### 4. Set Up Microsoft Entra ID (OAuth)

1. Go to [Azure Portal](https://portal.azure.com) → **Entra ID** → **App registrations**
2. Click **New registration**
   - Name: `Kirana Dev`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Single-page application (SPA)** → `http://localhost:5173/auth/callback`
3. Note the **Application (client) ID** and **Directory (tenant) ID**
4. Under **API permissions**, add:
   - Microsoft Graph → `User.Read`
   - Microsoft Graph → `offline_access`
5. Update `frontend/.env.local` with client ID and tenant ID

### 5. Get Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API Key** → **Create API Key**
3. Copy the key and add to `backend/local.settings.json`:
   ```json
   "GEMINI_API_KEY": "your-api-key-here"
   ```
4. Store in Azure Key Vault:
   ```bash
   az keyvault secret set --vault-name kv-kirana-dev --name GeminiApiKey --value "your-api-key-here"
   ```

### 6. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run build
npm start
# Server runs on http://localhost:7071
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### 7. Verify Setup

1. Open http://localhost:5173
2. You should see the Kirana app
3. Backend API should be accessible at http://localhost:7071/api

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
npm test
```

## 📦 Deployment

```bash
# Deploy backend to Azure Functions
cd backend
npm run build
func azure functionapp publish func-kirana-dev

# Deploy frontend (to be configured)
cd frontend
npm run build
# Configure Azure Static Web Apps or similar
```

## 🔧 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Zustand** - State management
- **React Query** - Server state
- **Dexie.js** - IndexedDB (offline storage)
- **MSAL** - Microsoft authentication

### Backend
- **Azure Functions** - Serverless compute
- **Node.js 20** - Runtime
- **TypeScript** - Type safety
- **Azure Cosmos DB** - NoSQL database
- **Azure Blob Storage** - File storage
- **Google Gemini API** - LLM for parsing

## 📊 Current Status

### ✅ Phase 0: Infrastructure Setup (Week 1)

- [x] Project structure created
- [x] Shared TypeScript types defined
- [x] Backend scaffolding complete
- [x] Frontend directory structure created
- [x] Environment configuration templates
- [x] Azure setup scripts
- [x] Cosmos DB container creation script
- [ ] Run Azure infrastructure setup
- [ ] Configure Microsoft Entra ID
- [ ] Get Gemini API key
- [ ] Symlink shared types
- [ ] Install dependencies
- [ ] Verify local development

### 🔲 Next: Phase 1A - Backend Core Services (Week 2-3)

- Cosmos DB service layer
- Items CRUD API
- Transactions API
- Authentication wrapper
- Cost tracking service

## 🤝 Contributing

This is a private project in active development. Implementation follows the task list in `docs/specs/Tasks_Kirana.md`.

## 📝 License

Proprietary - All rights reserved

## 📧 Contact

For questions or issues, please refer to the project documentation in `docs/specs/`.

---

**Last Updated:** November 2, 2025  
**Implementation Phase:** Phase 0 - Infrastructure Setup
