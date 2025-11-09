# 🛒 Kirana - Smart Grocery Inventory Tracker

<div align="center">

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://reactjs.org/)
[![Azure Functions](https://img.shields.io/badge/Azure_Functions-4.x-0062AD)](https://azure.microsoft.com/en-us/services/functions/)
[![Status](https://img.shields.io/badge/Status-Production_Ready-green)](https://github.com/vedprakash-m/kirana)

**AI-powered grocery inventory management with predictive restocking intelligence**

[Features](#-features) • [Demo](#-demo) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Architecture](#-architecture)

</div>

---

## 🎯 Overview

Kirana is a production-ready, full-stack application that helps households intelligently manage their grocery inventory. Using AI-powered predictions and smart CSV parsing, it tracks what you buy, predicts when you'll run out, and helps you restock efficiently.

**Why Kirana?**
- 🤖 **AI-Powered Predictions**: Exponential smoothing algorithm predicts consumption patterns
- 📊 **Smart CSV Import**: Upload Amazon/Instacart orders with LLM-powered parsing
- 🔄 **Real-Time Sync**: Azure Cosmos DB with multi-device support
- 🔐 **Enterprise Security**: Microsoft Entra ID (Azure AD) authentication
- 📱 **Mobile-First**: Responsive PWA design with offline support
- 🎯 **Zero Configuration**: Intelligent onboarding with teach mode

**Current Status:** ✅ **Production Ready** (Phase 1 Complete - All 77 tasks, 100%)  
**Lines of Code:** 35,904 across 82 files (Backend: 9,968 | Frontend: 4,791 | Docs: 21,145)

## 🚀 Quick Start

### Deploy to Azure (15 minutes)

```bash
# 1. Run one-time infrastructure setup
chmod +x scripts/setup-infrastructure.sh
./scripts/setup-infrastructure.sh

# 2. Configure GitHub secrets (automated)
chmod +x scripts/setup-github-secrets.sh
./scripts/setup-github-secrets.sh

# 3. Deploy!
git push origin main
```

**That's it!** See [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) for detailed instructions.

**Cost**: ~$6-30/month (serverless, pay-per-use)

---

## ✨ Features

### Core Capabilities
- ✅ **Smart Inventory Tracking** - Track groceries with quantity, units, and purchase dates
- ✅ **Predictive Analytics** - AI predicts when items run out based on consumption patterns
- ✅ **CSV Import** - Upload Amazon/Instacart orders with Gemini AI parsing
- ✅ **Human-in-the-Loop** - Review and correct AI-parsed items before import
- ✅ **Multi-Device Sync** - Real-time sync across devices via Azure Cosmos DB
- ✅ **Offline Support** - Continue working offline with IndexedDB local storage
- ✅ **Teach Mode** - Quick onboarding to build your initial catalog

### Advanced Features
- 📊 **Usage Analytics** - Track spending patterns and consumption trends
- 🔔 **Smart Notifications** - Get alerted when items are running low
- 🎨 **Confidence Badges** - Visual indicators for prediction reliability
- 🔍 **SKU Lookup** - Auto-match items to Amazon products with brand normalization
- 💰 **Cost Monitoring** - Built-in budget tracking and LLM cost optimization
- 🛡️ **Security Hardening** - OWASP compliance, rate limiting, input validation

## 🎬 Demo

**Coming Soon:** Live demo deployment on Azure Static Web Apps

**Screenshots:**
- Home Dashboard with urgency indicators
- CSV Upload with parsing preview
- Item detail with prediction graphs
- Settings and household management

## 📚 Documentation

### Primary Resources
- 📋 **[Implementation Tasks](docs/specs/Tasks_Kirana.md)** - Complete task breakdown (100% done)
- 📖 **[Product Requirements](docs/specs/PRD_Kirana.md)** - Feature specifications
- 🏗️ **[Technical Specification](docs/specs/Tech_Spec_Kirana.md)** - Architecture details
- 🎨 **[UX Design](docs/specs/UX_Kirana.md)** - User experience guidelines

### Architecture & Design
- 📐 **[Architecture Decision Records](docs/decisions/)** - 8 ADRs documenting key decisions
- 🔐 **[Security Audit](docs/security/security-audit.md)** - OWASP Top 10 compliance
- 📊 **[API Documentation](backend/docs/kirana-api.postman_collection.json)** - Postman collection
- 📜 **[OpenAPI Spec](backend/openapi.yaml)** - Complete API specification

### Operations
- 🚀 **[Production Runbook](docs/deployment/production-runbook.md)** - Deployment guide
- 🔥 **[Incident Response](docs/runbooks/incident-response.md)** - Emergency procedures
- 📈 **[Observability](docs/observability/azure-dashboard.md)** - Monitoring setup
- 👨‍💻 **[New Engineer Guide](docs/onboarding/new-engineer-guide.md)** - Onboarding docs

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

- **Node.js 20+** (LTS recommended)
- **Azure Subscription** ([Free tier available](https://azure.microsoft.com/free/))
- **Azure CLI** - `brew install azure-cli` (macOS) or [Download](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Azure Functions Core Tools** - `npm install -g azure-functions-core-tools@4`
- **Google Gemini API Key** - [Get free key](https://aistudio.google.com/)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/vedprakash-m/kirana.git
cd kirana

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
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

## 🏗️ Architecture

### System Design

```
┌─────────────────┐
│   React SPA     │  ← Frontend (Vite + React 18 + TypeScript)
│   (Port 5173)   │
└────────┬────────┘
         │ HTTPS + JWT
         ▼
┌─────────────────┐
│ Azure Functions │  ← Backend (Node.js 20 + TypeScript)
│   (Port 7071)   │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬───────────┐
    ▼          ▼          ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Cosmos  │ │ Blob   │ │Gemini  │ │  Key   │
│  DB    │ │Storage │ │  AI    │ │ Vault  │
└────────┘ └────────┘ └────────┘ └────────┘
```

### Tech Stack

#### Frontend
- **React 18** + **TypeScript 5.6** - Type-safe UI framework
- **Vite 6** - Lightning-fast build tool
- **TailwindCSS 3** - Utility-first styling
- **Zustand 5** - Lightweight state management with persistence
- **Dexie.js 4** - IndexedDB wrapper for offline support
- **MSAL 3** - Microsoft authentication library
- **React Router 6** - Client-side routing
- **shadcn/ui** - Accessible component library

#### Backend
- **Azure Functions 4.x** - Serverless compute with TypeScript
- **Node.js 20 LTS** - JavaScript runtime
- **Azure Cosmos DB** - NoSQL database (7 containers, 99.99% SLA)
- **Azure Blob Storage** - CSV file storage (3 containers)
- **Google Gemini 2.0 Flash** - LLM for CSV parsing
- **Application Insights** - APM and observability
- **Azure Key Vault** - Secrets management

#### DevOps & Quality
- **Jest** - Unit and integration testing
- **ESLint + Prettier** - Code quality and formatting
- **GitHub Actions** - CI/CD pipelines (4 workflows)
- **Postman** - API testing (11 endpoints documented)
- **OpenAPI 3.0** - API specification
- **Spectral** - API linting

## 📊 Project Status

### ✅ Phase 1 Complete (100% - All 77 Tasks)

| Phase | Focus Area | Tasks | Status |
|-------|-----------|-------|--------|
| **Phase 0** | Infrastructure Setup | 13/13 | ✅ 100% |
| **Phase 1A** | Backend Core Services | 12/12 | ✅ 100% |
| **Phase 1B** | Frontend Foundation | 6/6 | ✅ 100% |
| **Phase 1C** | LLM Integration | 9/9 | ✅ 100% |
| **Phase 1D** | Prediction Engine | 6/6 | ✅ 100% |
| **Phase 1E** | Onboarding & Teach Mode | 5/5 | ✅ 100% |
| **Phase 1F** | Polish & Observability | 11/11 | ✅ 100% |
| **Phase 1G** | Beta Testing & Hardening | 4/4 | ✅ 100% |

### Key Deliverables

**Backend (9,968 lines)**
- ✅ 11 REST API endpoints (Items, Transactions, Parsing, Admin)
- ✅ Cosmos DB service layer with repositories
- ✅ Gemini AI client with circuit breaker
- ✅ Prediction engine (exponential smoothing)
- ✅ Cost tracking and budget enforcement
- ✅ Integration tests with Jest (615 lines)
- ✅ OpenAPI 3.0 specification
- ✅ Admin cost monitoring dashboard

**Frontend (4,791 lines)**
- ✅ 6 main pages (Home, Inventory, Item Detail, Import, Settings, Login)
- ✅ Authentication with Microsoft Entra ID (MSAL)
- ✅ Zustand stores (items, auth) with persistence
- ✅ Offline-first architecture with Dexie.js
- ✅ Responsive UI with TailwindCSS + shadcn/ui
- ✅ CSV upload with drag-and-drop
- ✅ Teach mode quick entry

**Documentation (21,145 lines)**
- ✅ Complete PRD, Tech Spec, UX Design
- ✅ 8 Architecture Decision Records (ADRs)
- ✅ Security audit (OWASP Top 10)
- ✅ Production runbook and incident response
- ✅ Load testing plan and UAT checklist
- ✅ Postman collection (11 endpoints)
- ✅ New engineer onboarding guide

### Production Readiness Checklist

- ✅ **Security**: OWASP audit, input validation, rate limiting, secrets in Key Vault
- ✅ **Performance**: Caching, lazy loading, query optimization, circuit breakers
- ✅ **Reliability**: Error boundaries, retry logic, health checks, telemetry
- ✅ **Scalability**: Serverless architecture, partition keys, connection pooling
- ✅ **Observability**: Application Insights, structured logging, cost tracking
- ✅ **Testing**: Integration tests, error scenarios, mock patterns
- ✅ **Documentation**: API specs, runbooks, architecture docs, code comments
- ✅ **DevOps**: CI/CD pipelines, deployment automation, rollback procedures

## 🛣️ Roadmap

### Phase 2: Enhanced Features (Planned)
- 📱 Mobile apps (React Native)
- 🔗 Third-party integrations (Amazon, Instacart, Walmart)
- 🤝 Shared household inventories
- 📊 Advanced analytics dashboard
- 🔔 Push notifications
- 🎯 Shopping list generation
- 💳 Price tracking and alerts

### Phase 3: Scale & Optimize (Planned)
- 🌍 Multi-region deployment
- 🔄 Real-time collaboration
- 🤖 Advanced ML models (LSTM, Prophet)
- 📈 Business intelligence features
- 🎨 White-label capabilities

## 🤝 Contributing

Contributions are welcome! This project follows the task-driven approach outlined in `docs/specs/Tasks_Kirana.md`.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Follow** the code style (ESLint + Prettier configured)
4. **Write** tests for new features
5. **Commit** with clear messages (`git commit -m 'Add amazing feature'`)
6. **Push** to your branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### Development Guidelines

- All code must pass TypeScript strict checks
- Maintain test coverage above 80%
- Follow existing patterns in repositories and services
- Update documentation for new features
- Add ADRs for significant architectural decisions

## � License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**What this means:**
- ✅ Free to use, modify, and distribute
- ✅ Must disclose source code
- ✅ Network use counts as distribution (SaaS clause)
- ✅ Derivative works must also be AGPL-3.0

See [LICENSE](LICENSE) for full details.

## 👤 Author

**Vedprakash Mishra**
- GitHub: [@vedprakash-m](https://github.com/vedprakash-m)
- Email: vedprakash.m@me.com

## 🙏 Acknowledgments

- **Azure** - Cloud infrastructure and services
- **Google Gemini** - LLM for intelligent CSV parsing
- **shadcn/ui** - Beautiful accessible components
- **Open Source Community** - Amazing tools and libraries

## 📧 Support

- 📖 Check the [Documentation](docs/specs/)
- 🐛 Report bugs via [GitHub Issues](https://github.com/vedprakash-m/kirana/issues)
- 💬 Ask questions in [Discussions](https://github.com/vedprakash-m/kirana/discussions)
- 📧 Email for private inquiries: vedprakash.m@me.com

---

<div align="center">

**Built with ❤️ for better household inventory management**

⭐ Star this repo if you find it useful! ⭐

[Report Bug](https://github.com/vedprakash-m/kirana/issues) • [Request Feature](https://github.com/vedprakash-m/kirana/issues) • [Documentation](docs/specs/)

**Last Updated:** November 3, 2025 | **Status:** Production Ready 🚀

</div>
