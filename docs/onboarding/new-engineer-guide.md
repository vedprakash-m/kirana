# New Engineer Onboarding Guide

**Welcome to Kirana!** 🎉

This guide will get you up and running with the Kirana codebase in under 2 hours.

## Table of Contents

1. [Setup (45 minutes)](#setup)
2. [Architecture Overview (30 minutes)](#architecture-overview)
3. [Development Workflow (20 minutes)](#development-workflow)
4. [Key Concepts (15 minutes)](#key-concepts)
5. [Common Tasks (10 minutes)](#common-tasks)
6. [Debugging Tips](#debugging-tips)
7. [Resources](#resources)

---

## Setup

### Prerequisites

- **Node.js**: v20+ ([Download](https://nodejs.org/))
- **Azure CLI**: ([Install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- **Git**: v2.30+ ([Download](https://git-scm.com/))
- **VS Code**: Recommended editor ([Download](https://code.visualstudio.com/))

### 1. Clone Repository (2 min)

```bash
git clone https://github.com/kirana-team/kirana.git
cd kirana
```

### 2. Frontend Setup (15 min)

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your API endpoint
# VITE_API_URL=http://localhost:7071/api

# Start dev server
npm run dev

# Verify: Browser opens at http://localhost:3000
```

**Expected Output:**
```
VITE v5.4.0  ready in 421 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

### 3. Backend Setup (20 min)

```bash
cd ../backend

# Install dependencies
npm install

# Install Azure Functions Core Tools (if not already installed)
npm install -g azure-functions-core-tools@4

# Copy environment template
cp local.settings.example.json local.settings.json

# Edit local.settings.json with your keys:
# - COSMOS_DB_CONNECTION_STRING (get from Azure Portal)
# - GOOGLE_AI_API_KEY (get from Google AI Studio)
# - APPLICATIONINSIGHTS_CONNECTION_STRING (optional for local dev)

# Start Functions emulator
func start

# Verify: Endpoints listed at http://localhost:7071/api
```

**Expected Output:**
```
Azure Functions Core Tools
Core Tools Version: 4.0.5455

Functions:
  getItems: [GET] http://localhost:7071/api/items
  createItem: [POST] http://localhost:7071/api/items
  ...
```

### 4. Database Setup (8 min)

**Option A: Use Shared Dev Database** (Recommended for new engineers)
```bash
# Ask team lead for dev database connection string
# Add to backend/local.settings.json:
# "COSMOS_DB_CONNECTION_STRING": "<shared-dev-connection-string>"
```

**Option B: Create Personal Cosmos DB**
```bash
# Login to Azure
az login

# Create resource group
az group create --name kirana-dev --location eastus

# Create Cosmos DB account
az cosmosdb create \
  --name kirana-dev-<yourname> \
  --resource-group kirana-dev \
  --default-consistency-level Session

# Get connection string
az cosmosdb keys list \
  --name kirana-dev-<yourname> \
  --resource-group kirana-dev \
  --type connection-strings
```

### 5. Verify Setup (5 min)

**Frontend Health Check:**
```bash
# In frontend directory
npm run build
# Should compile without errors
```

**Backend Health Check:**
```bash
# In backend directory, with func start running
curl http://localhost:7071/api/items
# Should return: {"success": true, "data": []}
```

**Full Stack Test:**
1. Open http://localhost:3000 in browser
2. Click "Add Item" button
3. Enter item details and save
4. Item appears in dashboard
5. ✅ **Setup complete!**

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          React App (Vite + TypeScript)                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │ Dashboard   │  │ Teach Mode  │  │   Import    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  │         │                │                │            │  │
│  │         └────────────────┴────────────────┘            │  │
│  │                       │                                │  │
│  │                 Zustand Stores                         │  │
│  │                       │                                │  │
│  │                  API Client                            │  │
│  └───────────────────────┼─────────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────────┘
                           │ HTTPS (JWT Bearer)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Azure Functions                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  HTTP Triggers: GET/POST/PUT/DELETE /api/items        │  │
│  │  Timer Triggers: Predictions (daily 2AM UTC)          │  │
│  └────────┬──────────────────────────────────┬────────────┘  │
│           │                                  │               │
│     ┌─────▼─────┐                      ┌─────▼─────┐        │
│     │ Prediction│                      │    LLM    │        │
│     │  Service  │                      │  Service  │        │
│     └─────┬─────┘                      └─────┬─────┘        │
│           │                                  │               │
│           │ Exponential Smoothing            │ Gemini API    │
│           │ α = 0.1-0.5                      │ $0.075/1M tok │
│           │                                  │               │
└───────────┼──────────────────────────────────┼───────────────┘
            │                                  │
            ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐
│   Azure Cosmos DB    │          │   Google Gemini      │
│                      │          │                      │
│  Containers:         │          │  Tasks:              │
│  - items             │          │  - CSV parsing       │
│  - transactions      │          │  - Receipt OCR       │
│  - users             │          │  - Smart merge       │
│  - budgets           │          │                      │
│                      │          │  Cost: ~$1/month     │
│  Partition: /hhId    │          │  (100 households)    │
└──────────────────────┘          └──────────────────────┘
```

### Tech Stack Summary

| Layer | Technology | Why? |
|-------|-----------|------|
| **Frontend** | React 18 + Vite | Fast HMR (<100ms), TypeScript native |
| **State** | Zustand | Lightweight (1KB), simple API, no Provider |
| **Styling** | CSS Modules + Tailwind | Scoped styles + utility classes |
| **Backend** | Azure Functions (Node.js) | Serverless, $0 in free tier, auto-scaling |
| **Database** | Cosmos DB (NoSQL) | Flexible schema, fast queries, /householdId partition |
| **LLM** | Gemini 1.5 Flash | 13× cheaper than GPT-4, vision-capable |
| **Prediction** | Exponential Smoothing | O(1) complexity, real-time updates, interpretable |
| **Monitoring** | App Insights | Azure-native, custom metrics, distributed tracing |

### Directory Structure

```
kirana/
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ItemCard.tsx     # Item display with urgency badge
│   │   │   ├── ConfidenceBadge.tsx  # Prediction confidence
│   │   │   └── EmptyState.tsx   # No items placeholder
│   │   ├── pages/               # Route pages
│   │   │   ├── Dashboard.tsx    # Main view (filtered/sorted items)
│   │   │   ├── TeachMode.tsx    # Quick onboarding
│   │   │   └── Import.tsx       # CSV/photo upload
│   │   ├── stores/              # Zustand state
│   │   │   ├── itemStore.ts     # Items, filter, sort
│   │   │   ├── authStore.ts     # User, token
│   │   │   └── budgetStore.ts   # LLM spend tracking
│   │   ├── services/            # API clients
│   │   │   └── apiClient.ts     # Fetch wrapper with retry
│   │   ├── utils/               # Helpers
│   │   │   ├── accessibility.ts # WCAG utilities
│   │   │   └── dateUtils.ts     # Date formatting
│   │   ├── App.tsx              # Root component
│   │   └── main.tsx             # Entry point
│   ├── .storybook/              # Storybook config
│   ├── public/                  # Static assets
│   ├── vite.config.ts           # Vite configuration
│   └── package.json
├── backend/
│   ├── functions/
│   │   ├── items/               # Item CRUD operations
│   │   ├── import/              # CSV/photo import
│   │   ├── predictions/         # Prediction engine
│   │   ├── budget/              # Cost tracking
│   │   └── auth/                # Authentication
│   ├── services/
│   │   ├── PredictionService.ts # Exponential smoothing
│   │   ├── LLMService.ts        # Gemini API client
│   │   └── CosmosService.ts     # Database abstraction
│   ├── utils/
│   │   ├── circuitBreaker.ts    # Resilience pattern
│   │   └── retryPolicy.ts       # Exponential backoff
│   ├── host.json                # Function runtime config
│   └── package.json
├── docs/
│   ├── specs/                   # Product specs
│   │   ├── PRD_Kirana.md        # Product requirements
│   │   ├── Tech_Spec_Kirana.md  # Technical design
│   │   ├── Tasks_Kirana.md      # Implementation plan
│   │   └── UX_Kirana.md         # UX/UI guidelines
│   ├── decisions/               # Architecture Decision Records
│   │   ├── ADR-001-exponential-smoothing.md
│   │   ├── ADR-002-cosmos-db.md
│   │   └── ...                  # 8 ADRs total
│   ├── accessibility/           # WCAG compliance
│   ├── runbooks/                # Operations guides
│   ├── storybook/               # Component stories
│   └── onboarding/              # This guide!
└── .github/
    └── workflows/               # CI/CD pipelines
        ├── frontend-ci.yml      # Frontend build + test
        ├── backend-ci.yml       # Backend build + test
        ├── api-validation.yml   # OpenAPI schema validation
        └── chromatic.yml        # Visual regression tests
```

---

## Development Workflow

### Daily Workflow

1. **Pull latest changes**
   ```bash
   git pull origin main
   npm install  # (if package.json changed)
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/add-item-notes
   ```

3. **Make changes**
   - Edit code in VS Code
   - Frontend auto-reloads (Vite HMR)
   - Backend requires manual restart (Ctrl+C → `func start`)

4. **Test locally**
   ```bash
   # Frontend tests
   cd frontend
   npm run test
   npm run build  # Verify no TypeScript errors

   # Backend tests
   cd backend
   npm run test
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add item notes field"
   git push origin feature/add-item-notes
   ```

6. **Create Pull Request**
   - Open GitHub
   - Create PR from feature branch → main
   - CI runs automatically (build, test, lint, OpenAPI validation)
   - Request review from team

7. **Merge**
   - After approval, squash and merge
   - Delete feature branch
   - CI deploys to staging automatically

### Git Conventions

**Branch naming:**
- `feature/description` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation updates
- `refactor/what-improved` - Code refactoring

**Commit messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/)
- `feat: add item notes field`
- `fix: resolve prediction NaN bug`
- `docs: update API reference`
- `refactor: extract item service`
- `test: add confidence badge tests`

### Code Review Checklist

**Reviewer checks:**
- [ ] Code compiles (no TypeScript errors)
- [ ] Tests pass (unit + integration)
- [ ] Accessibility (keyboard navigation, ARIA labels)
- [ ] Error handling (try/catch, circuit breaker)
- [ ] Performance (no N+1 queries, use selectors)
- [ ] Security (no hardcoded secrets, validate inputs)
- [ ] Documentation (JSDoc for public APIs)

---

## Key Concepts

### 1. Smart Merge (LLM-powered item normalization)

**Problem:** Users import items from multiple sources with different names:
- Amazon CSV: "Horizon Organic Whole Milk, 1 Gallon"
- Manual entry: "Whole Milk"
- Receipt OCR: "HRZ MILK 1GL"

**Solution:** Gemini LLM normalizes to canonical name: "Whole Milk"

**Implementation:**
```typescript
// backend/services/LLMService.ts
export async function smartMerge(
  newItems: string[],
  existingItems: Item[]
): Promise<MergeResult[]> {
  const prompt = `
    Normalize these grocery items to canonical names.
    New items: ${JSON.stringify(newItems)}
    Existing items: ${JSON.stringify(existingItems.map(i => i.canonicalName))}
    
    Rules:
    - Match to existing item if similar (e.g., "Milk" → "Whole Milk")
    - Extract package size (e.g., "1 Gal", "2 lbs")
    - Preserve brand if specified
    
    JSON output:
  `;
  
  const result = await callGeminiAPI(prompt);
  return JSON.parse(result);
}
```

**User Experience:**
1. User uploads CSV with 100 items
2. LLM processes in <5 seconds
3. Micro-review shows matched items (green check) and new items (yellow badge)
4. User clicks "Approve All" or edits individual items
5. Items saved to Cosmos DB with canonical names

### 2. Dynamic Urgency (Real-time urgency updates)

**Problem:** Item urgency changes as time passes (7 days → warning, 3 days → critical)

**Solution:** Recalculate urgency on every dashboard load (not stored in DB)

**Implementation:**
```typescript
// frontend/src/stores/itemStore.ts
const useItemStore = create<ItemStore>((set, get) => ({
  items: [],
  
  fetchItems: async () => {
    const response = await apiClient.get('/items');
    const itemsWithDynamicUrgency = response.data.map(item => ({
      ...item,
      daysUntilRunOut: calculateDaysUntil(item.predictedRunOutDate),
      urgency: calculateUrgency(item.predictedRunOutDate)  // Real-time
    }));
    set({ items: itemsWithDynamicUrgency });
  }
}));

function calculateUrgency(predictedDate: string): Urgency {
  const days = calculateDaysUntil(predictedDate);
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'normal';
}
```

**Why not store urgency in DB?**
- Urgency changes every second (days until run-out decreases)
- Would require background job to update all items daily
- Real-time calculation is cheap (O(1) per item)

### 3. Cost Control (LLM budget enforcement)

**Problem:** Gemini API costs can spike if users abuse CSV imports

**Solution:** $50/day budget cap with enforcement at API level

**Implementation:**
```typescript
// backend/services/BudgetService.ts
export async function checkBudget(householdId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const budget = await cosmosService.getBudget(householdId, today);
  
  if (budget.currentSpend >= budget.dailyCap) {
    throw new BudgetExceededError(
      `Daily budget exceeded ($${budget.currentSpend}/$${budget.dailyCap}). ` +
      `Resets at midnight UTC.`
    );
  }
  
  return true;
}

// backend/functions/import/importCSV.ts
export async function importCSV(request: HttpRequest): Promise<HttpResponseInit> {
  const householdId = request.headers.get('x-household-id');
  
  // Check budget BEFORE calling LLM
  await checkBudget(householdId);
  
  const csvContent = await request.text();
  const llmResult = await llmService.parseCSV(csvContent);
  
  // Track cost AFTER successful call
  await cosmosService.recordLLMCost(householdId, llmResult.cost);
  
  return { status: 200, jsonBody: llmResult };
}
```

**User Experience:**
1. User tries to import CSV
2. If budget exceeded, see error: "Daily LLM budget reached ($50). Try again tomorrow."
3. Fallback: "Enter items manually" link
4. Budget resets at midnight UTC
5. Slack alert sent to team at 80% utilization ($40)

### 4. Prediction Confidence Factors

**Problem:** Users need to understand why predictions are uncertain

**Solution:** `PredictionMetadata.factors` array explains confidence

**Example:**
```json
{
  "predictionConfidence": "medium",
  "predictionMetadata": {
    "algorithm": "exponential_smoothing",
    "alpha": 0.3,
    "factors": [
      {
        "factor": "min_transactions",
        "met": true,
        "value": 5,
        "description": "At least 3 restock events"
      },
      {
        "factor": "consistent_intervals",
        "met": false,
        "value": 0.35,
        "description": "Standard deviation ≤30% of mean"
      },
      {
        "factor": "recent_data",
        "met": true,
        "value": true,
        "description": "Last restock within 2× average interval"
      }
    ]
  }
}
```

**UI Display:**
- High confidence: Green checkmark, no tooltip needed
- Medium confidence: Yellow badge with tooltip showing which factors failed
- Low confidence: Red badge with "Add more restock data" message

---

## Common Tasks

### Add a New API Endpoint

1. **Create function file**
   ```bash
   cd backend/functions/items
   touch getItemHistory.ts
   ```

2. **Implement handler**
   ```typescript
   // backend/functions/items/getItemHistory.ts
   import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
   
   export async function getItemHistory(
     request: HttpRequest
   ): Promise<HttpResponseInit> {
     const itemId = request.params.itemId;
     const history = await cosmosService.getTransactions(itemId);
     
     return {
       status: 200,
       jsonBody: { success: true, data: history }
     };
   }
   
   app.http('getItemHistory', {
     methods: ['GET'],
     authLevel: 'anonymous',
     route: 'items/{itemId}/history',
     handler: getItemHistory
   });
   ```

3. **Update OpenAPI spec**
   ```yaml
   # backend/openapi.yaml
   /items/{itemId}/history:
     get:
       summary: Get item restock history
       parameters:
         - name: itemId
           in: path
           required: true
           schema:
             type: string
       responses:
         '200':
           description: History retrieved
   ```

4. **Test locally**
   ```bash
   func start
   curl http://localhost:7071/api/items/123/history
   ```

### Add a New Frontend Component

1. **Create component file**
   ```bash
   cd frontend/src/components
   touch ItemHistory.tsx
   ```

2. **Implement component**
   ```typescript
   // frontend/src/components/ItemHistory.tsx
   import { useEffect, useState } from 'react';
   import { apiClient } from '../services/apiClient';
   
   interface ItemHistoryProps {
     itemId: string;
   }
   
   export function ItemHistory({ itemId }: ItemHistoryProps) {
     const [history, setHistory] = useState([]);
     
     useEffect(() => {
       apiClient.get(`/items/${itemId}/history`)
         .then(res => setHistory(res.data));
     }, [itemId]);
     
     return (
       <div>
         <h3>Restock History</h3>
         <ul>
           {history.map(event => (
             <li key={event.id}>{event.restockedAt}</li>
           ))}
         </ul>
       </div>
     );
   }
   ```

3. **Create Storybook story**
   ```typescript
   // frontend/src/components/ItemHistory.stories.tsx
   import type { Meta, StoryObj } from '@storybook/react';
   import { ItemHistory } from './ItemHistory';
   
   const meta: Meta<typeof ItemHistory> = {
     title: 'Components/ItemHistory',
     component: ItemHistory
   };
   
   export default meta;
   type Story = StoryObj<typeof ItemHistory>;
   
   export const Default: Story = {
     args: { itemId: '123' }
   };
   ```

4. **Test in Storybook**
   ```bash
   npm run storybook
   # Open http://localhost:6006
   ```

### Run Database Migrations

```bash
# Example: Add new field to items
# 1. Update CosmosService.ts to include new field
# 2. Run migration script

cd backend
node scripts/migrate-add-notes-field.js

# Migration script example:
const { CosmosClient } = require('@azure/cosmos');

async function migrate() {
  const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
  const container = client.database('kirana').container('items');
  
  const { resources: items } = await container.items.readAll().fetchAll();
  
  for (const item of items) {
    if (!item.notes) {
      item.notes = '';  // Add default value
      await container.item(item.id, item.householdId).replace(item);
    }
  }
  
  console.log(`Migrated ${items.length} items`);
}

migrate();
```

---

## Debugging Tips

### Frontend Debugging

**React DevTools:**
- Install [React DevTools](https://react.dev/learn/react-developer-tools)
- Inspect component props/state
- View Zustand store state in Components tab

**Vite Network Tab:**
- Open browser DevTools → Network tab
- Filter by "XHR" to see API calls
- Check request/response payloads

**Common Issues:**
- **Blank screen**: Check browser console for errors
- **API 401 error**: Token expired, logout and login again
- **State not updating**: Verify Zustand selector (avoid `state => state`)

### Backend Debugging

**Azure Functions Logs:**
```bash
# Start Functions with verbose logging
func start --verbose

# View logs in real-time
func logs --follow
```

**VS Code Debugger:**
1. Set breakpoint in function file
2. Press F5 (starts debugger)
3. Trigger endpoint in Postman/browser
4. Debugger pauses at breakpoint

**Common Issues:**
- **Function not found**: Check `host.json` routePrefix and function route
- **Cosmos DB 429 error**: RU/s exceeded, add retry logic or increase RUs
- **Gemini API timeout**: Network issue, check circuit breaker state

### Database Debugging

**Cosmos DB Data Explorer:**
1. Open Azure Portal → Cosmos DB account
2. Click "Data Explorer"
3. Browse containers, run SQL queries
4. Example: `SELECT * FROM c WHERE c.householdId = 'user123'`

**Local Cosmos DB Emulator:**
```bash
# Download: https://aka.ms/cosmosdb-emulator
# Start emulator (Windows only)
# Connection string: AccountEndpoint=https://localhost:8081/;AccountKey=...
```

---

## Resources

### Documentation

- **PRD**: `/docs/specs/PRD_Kirana.md` - Product requirements and features
- **Tech Spec**: `/docs/specs/Tech_Spec_Kirana.md` - Technical design and API contracts
- **Tasks**: `/docs/specs/Tasks_Kirana.md` - Implementation plan and progress tracking
- **UX Guidelines**: `/docs/specs/UX_Kirana.md` - Design system and component specs
- **ADRs**: `/docs/decisions/` - Architecture decision records (8 ADRs)
- **OpenAPI**: `/backend/openapi.yaml` - Complete API specification

### External Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Zustand Guide](https://github.com/pmndrs/zustand)
- [Azure Functions Docs](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Cosmos DB Best Practices](https://learn.microsoft.com/en-us/azure/cosmos-db/best-practices)
- [Gemini API Reference](https://ai.google.dev/api)

### Team Communication

- **Slack**: #kirana-dev (daily standups, questions)
- **GitHub Discussions**: For async design discussions
- **Weekly Sync**: Thursdays 2 PM PT (Zoom link in calendar)

### Getting Help

1. **Check docs first**: Search `/docs/` folder
2. **Search GitHub Issues**: Someone may have hit the same bug
3. **Ask in Slack**: #kirana-dev channel
4. **Pair programming**: Book time with team lead
5. **Debugging session**: Friday office hours (2-3 PM PT)

---

## Next Steps

Now that you're set up, try these beginner-friendly tasks:

1. **Add a new item category** (e.g., HOUSEHOLD)
   - Update `Category` enum in backend
   - Update OpenAPI spec
   - Add to frontend dropdown
   - PR: ~30 min

2. **Improve error messages**
   - Make Cosmos DB 429 error more user-friendly
   - Add retry countdown in UI
   - PR: ~1 hour

3. **Add item notes field**
   - Add `notes` property to Item schema
   - Update OpenAPI spec
   - Add textarea to ItemCard
   - PR: ~2 hours

**Welcome to the team!** 🚀

Questions? Ping @tech-lead in Slack.
