# ADR-006: Azure Functions for Backend

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** backend, serverless, azure-functions, nodejs

## Context

Kirana backend needs to:
- Handle HTTP requests for CRUD operations (items, transactions)
- Execute LLM parsing jobs (CSV import, receipt OCR)
- Run scheduled tasks (prediction recalculation, cost alerts)
- Scale automatically with user load (MVP: 10 users → Growth: 1,000 users)
- Integrate with Azure ecosystem (Cosmos DB, App Insights, Blob Storage)
- Keep infrastructure costs low during MVP (<$50/month)

We evaluated four backend architectures:
1. **Azure Functions (Serverless)**: Pay-per-execution, auto-scaling
2. **Azure App Service (PaaS)**: Managed VM, always-on server
3. **Azure Container Instances**: Docker containers, manual scaling
4. **Azure Kubernetes Service (AKS)**: Orchestrated containers, complex ops

## Decision

We will use **Azure Functions (Consumption Plan)** for all backend logic.

### Architecture

**Function App Structure:**
```
backend/
├── functions/
│   ├── items/
│   │   ├── getItems.ts          # GET /api/items
│   │   ├── createItem.ts        # POST /api/items
│   │   ├── updateItem.ts        # PUT /api/items/{id}
│   │   ├── deleteItem.ts        # DELETE /api/items/{id}
│   │   └── restockItem.ts       # POST /api/items/{id}/restock
│   ├── import/
│   │   ├── importCSV.ts         # POST /api/import/csv
│   │   └── importPhoto.ts       # POST /api/import/photo
│   ├── predictions/
│   │   ├── calculatePredictions.ts  # POST /api/predictions/calculate
│   │   └── recalculateScheduled.ts  # Timer trigger (daily 2 AM UTC)
│   ├── budget/
│   │   ├── getBudgetStatus.ts   # GET /api/budget/status
│   │   └── alertOnHighUsage.ts  # Timer trigger (hourly check)
│   └── auth/
│       ├── login.ts             # POST /api/auth/login
│       └── validateToken.ts     # Middleware
├── services/
│   ├── PredictionService.ts     # Exponential smoothing logic
│   ├── LLMService.ts            # Gemini API client
│   └── CosmosService.ts         # Database abstraction
├── utils/
│   ├── circuitBreaker.ts        # Resilience pattern
│   └── retryPolicy.ts           # Exponential backoff
├── host.json                    # Function runtime config
├── local.settings.json          # Local environment variables
└── package.json
```

### Function Configuration

**host.json** (Runtime settings):
```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensions": {
    "http": {
      "routePrefix": "api",
      "maxConcurrentRequests": 100,
      "maxOutstandingRequests": 200
    }
  },
  "functionTimeout": "00:05:00"
}
```

**Example Function** (getItems.ts):
```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosService } from '../services/CosmosService';

export async function getItems(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const householdId = request.headers.get('x-household-id');
    const filter = request.query.get('filter') || 'all';
    
    const cosmosService = new CosmosService();
    const items = await cosmosService.getItems(householdId, filter);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: items,
        requestId: context.invocationId
      }
    };
  } catch (error) {
    context.error('Error fetching items', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      }
    };
  }
}

app.http('getItems', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'items',
  handler: getItems
});
```

### Trigger Types

1. **HTTP Triggers** (9 functions):
   - Items CRUD: GET, POST, PUT, DELETE, restock
   - Import: CSV, photo
   - Predictions: calculate
   - Budget: status

2. **Timer Triggers** (2 functions):
   - `recalculateScheduled`: Cron `0 0 2 * * *` (daily 2 AM UTC)
   - `alertOnHighUsage`: Cron `0 0 * * * *` (hourly)

3. **Blob Triggers** (1 function - future):
   - `processReceiptBlob`: Triggered when photo uploaded to Blob Storage

### Consumption Plan Pricing

**Azure Functions Consumption Plan:**
- **Execution Time**: $0.000016/GB-s (first 400,000 GB-s free per month)
- **Requests**: $0.20 per million (first 1 million free)

**Estimated Monthly Cost (100 active users):**
- Requests: 100 users × 50 requests/day × 30 days = 150K requests → **Free tier**
- Execution: 150K × 500ms × 128MB = 9,600 GB-s → **Free tier**
- **Total: $0/month for Functions** (within free tier) 💰

## Consequences

### Positive

✅ **True pay-per-use**: $0 when no traffic (perfect for MVP)  
✅ **Auto-scaling**: Handles 1 user or 10,000 users seamlessly  
✅ **Fast deployment**: `func azure functionapp publish kirana-api` (30s)  
✅ **Native Azure integration**: Cosmos DB bindings, App Insights built-in  
✅ **No server management**: No patching, OS updates, or VM scaling  
✅ **Built-in retry**: Cosmos DB output binding handles transient failures  
✅ **TypeScript native**: First-class support with @azure/functions v4  
✅ **Free tier generous**: 1M requests + 400K GB-s per month  

### Negative

❌ **Cold start latency**: ~2-3s first request after idle (mitigated by always-on in production)  
❌ **5-minute timeout**: Long LLM jobs need durable functions or queues  
❌ **Stateless**: Can't hold in-memory cache (use Redis if needed)  
❌ **Debugging harder**: Can't attach debugger to remote (use local emulator)  
❌ **Vendor lock-in**: Tied to Azure (migration to AWS Lambda requires rewrite)  

### Alternatives Considered

**Azure App Service (PaaS)**:
- ❌ Rejected: Always-on server costs $55/month minimum (B1 tier)
- ❌ Must provision capacity upfront (not auto-scaling)
- ✅ No cold starts
- ✅ Can run long processes (>5 min)
- ❌ Overkill for low-traffic MVP

**Azure Container Instances**:
- ❌ Rejected: Manual scaling (not serverless)
- ❌ More expensive than Functions (~$30/month for 1 vCPU always-on)
- ✅ Full Docker environment (more flexibility)
- ❌ Need to manage container registry

**Azure Kubernetes Service (AKS)**:
- ❌ Rejected: Way too complex for MVP (cluster management, YAML configs)
- ❌ Minimum cost $70/month (single node pool)
- ✅ Best for microservices at scale (100+ services)
- ❌ Overkill for 11 API endpoints

**Express.js on Azure App Service**:
- ❌ Rejected: Need to maintain single monolith server
- ❌ Always-on costs
- ✅ Familiar Express API
- ❌ Manual scaling and load balancing

## Implementation Notes

### Local Development

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Start local emulator
func start

# Endpoints available at http://localhost:7071/api/items
```

### Deployment

```bash
# Deploy to Azure (production)
func azure functionapp publish kirana-api

# Deploy with slot (staging)
func azure functionapp publish kirana-api --slot staging
```

### Environment Variables

```bash
# local.settings.json (local dev)
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_CONNECTION_STRING": "...",
    "GOOGLE_AI_API_KEY": "...",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "..."
  }
}

# Azure Portal (production)
# Set as App Settings in Function App configuration
```

### Error Handling Pattern

```typescript
// utils/errorHandler.ts
export function handleFunctionError(
  error: Error,
  context: InvocationContext
): HttpResponseInit {
  context.error('Function error', error);
  
  // Track to App Insights
  context.log.metric('function_error', 1, {
    errorType: error.constructor.name,
    functionName: context.functionName
  });
  
  return {
    status: error.statusCode || 500,
    jsonBody: {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
        requestId: context.invocationId
      }
    }
  };
}
```

### Performance Optimization

1. **Warm-up functions**: Use Application Insights availability tests to ping every 5 min (prevent cold starts)
2. **Connection pooling**: Reuse Cosmos DB client across invocations (singleton pattern)
3. **Async/await**: Use async handlers for non-blocking I/O
4. **Batch operations**: Import CSV in batches of 10 items (avoid timeout)

### Scaling Configuration

```json
// host.json
{
  "extensions": {
    "http": {
      "maxConcurrentRequests": 100,  // Max concurrent requests per instance
      "maxOutstandingRequests": 200  // Max queued requests
    }
  },
  "functionTimeout": "00:05:00",     // 5-minute timeout
  "healthMonitor": {
    "enabled": true,
    "healthCheckInterval": "00:00:10"
  }
}
```

## Durable Functions (Future Enhancement)

For long-running LLM jobs (>5 min), consider migrating to Durable Functions:

```typescript
// Orchestrator function (handles CSV import)
const orchestrator: OrchestrationHandler = function* (context) {
  const csvFile = context.df.getInput();
  
  // Step 1: Parse CSV with LLM (5-10 min)
  const parsedItems = yield context.df.callActivity('parseCsvWithLLM', csvFile);
  
  // Step 2: Normalize items (1 min)
  const normalizedItems = yield context.df.callActivity('normalizeItems', parsedItems);
  
  // Step 3: Save to Cosmos DB (1 min)
  yield context.df.callActivity('saveItems', normalizedItems);
  
  return { itemCount: normalizedItems.length };
};
```

## Migration Strategy

If serverless becomes problematic:
1. **Phase 1**: Enable Always-On (eliminates cold starts, +$10/month)
2. **Phase 2**: Migrate long jobs to Durable Functions (handles >5 min)
3. **Phase 3**: Move to App Service if predictable traffic (break-even at ~10M requests/month)

## References

- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Azure Functions Pricing](https://azure.microsoft.com/en-us/pricing/details/functions/)
- [Durable Functions](https://learn.microsoft.com/en-us/azure/azure-functions/durable/)
- [Functions Best Practices](https://learn.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- PRD Section 8: "Backend Architecture"
- Tech Spec Section 2.2: "Azure Functions Design"

## Review History

- 2025-11-03: Initial version (Accepted)
