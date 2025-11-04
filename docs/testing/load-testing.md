# Load Testing Guide

**Project:** Kirana - Smart Grocery Inventory Tracker  
**Phase:** Pre-Production Performance Testing  
**Tool:** Artillery + Azure Load Testing  
**Date Created:** November 3, 2025

---

## 1. Overview

### Purpose
Validate that Kirana can handle production load with acceptable performance before launch. Identify bottlenecks and optimize hot paths.

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **GET /items** p95 latency | <500ms | Under normal load (100 users) |
| **POST /items** p95 latency | <1000ms | Under normal load |
| **POST /parse/csv** p95 latency | <30s | 100-item CSV file |
| **Prediction calculation** p95 | <2000ms | 50 items per household |
| **Error rate** | <0.1% | Any endpoint under normal load |
| **Cosmos DB RU/s** | <400 RU/s | Shared throughput limit |
| **Concurrent users** | 500 users | Peak load (Black Friday) |
| **Response under spike** | No 500 errors | 0→1000 users in 1 min |

### Test Scenarios

1. **Normal Load:** 100 concurrent users, 10 req/sec sustained for 10 min
2. **Peak Load:** 500 concurrent users, 50 req/sec for 5 min
3. **Spike Test:** 0 → 1000 users in 1 min, hold for 2 min
4. **Soak Test:** 50 concurrent users for 2 hours (stability)
5. **Stress Test:** Increase load until system breaks (find limit)

---

## 2. Setup

### Install Artillery

```bash
# Install globally
npm install -g artillery@latest

# Verify installation
artillery --version # Should be 2.0.0+

# Install plugins
npm install -g artillery-plugin-metrics-by-endpoint
npm install -g artillery-plugin-expect
```

### Environment Configuration

```bash
# backend/.env.load-test
NODE_ENV=production
COSMOS_CONNECTION_STRING=AccountEndpoint=https://...
ENABLE_LLM=false # Disable during load tests to isolate backend performance
DAILY_BUDGET_CAP=1000 # Temporarily raise cap
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

### Test Data Setup

```bash
# Create test users and seed data
node scripts/seed-load-test-data.js

# Generates:
# - 100 test user accounts
# - 50 items per user (5,000 total items)
# - 200 transactions per user (20,000 total transactions)
```

**Script: `scripts/seed-load-test-data.js`**

```javascript
// scripts/seed-load-test-data.js
const { CosmosClient } = require('@azure/cosmos');
const { faker } = require('@faker-js/faker');

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database('kirana-db');
const usersContainer = database.container('users');
const itemsContainer = database.container('items');
const transactionsContainer = database.container('transactions');

async function seedData() {
  console.log('Seeding load test data...');

  // Create 100 test users
  const userIds = [];
  for (let i = 0; i < 100; i++) {
    const userId = `load-test-user-${i}`;
    userIds.push(userId);

    await usersContainer.items.create({
      id: userId,
      userId,
      email: `loadtest${i}@kirana.test`,
      householdName: `Test Household ${i}`,
      createdAt: new Date().toISOString(),
    });
  }

  console.log('Created 100 test users');

  // Create 50 items per user
  const categories = ['PRODUCE', 'DAIRY', 'MEAT', 'PANTRY', 'FROZEN', 'BEVERAGES', 'SNACKS'];
  const itemNames = [
    'Whole Milk', 'Eggs', 'Bread', 'Chicken Breast', 'Bananas', 'Apples',
    'Orange Juice', 'Cereal', 'Pasta', 'Rice', 'Coffee', 'Butter',
    'Yogurt', 'Cheese', 'Ground Beef', 'Salmon', 'Carrots', 'Onions',
    'Potatoes', 'Tomatoes', 'Lettuce', 'Spinach', 'Broccoli', 'Peppers',
  ];

  for (const userId of userIds) {
    for (let j = 0; j < 50; j++) {
      const itemId = `${userId}-item-${j}`;
      await itemsContainer.items.create({
        id: itemId,
        userId,
        canonicalName: faker.helpers.arrayElement(itemNames),
        originalName: faker.commerce.productName(),
        category: faker.helpers.arrayElement(categories),
        quantity: faker.number.int({ min: 1, max: 5 }),
        packageSize: faker.helpers.arrayElement(['1 lb', '1 gallon', '12 oz', '2 lbs']),
        unitPrice: parseFloat(faker.commerce.price({ min: 2, max: 20 })),
        totalPrice: parseFloat(faker.commerce.price({ min: 5, max: 50 })),
        purchaseDate: faker.date.past({ years: 0.5 }).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  console.log('Created 5,000 items (50 per user)');

  // Create 200 transactions per user
  for (const userId of userIds) {
    for (let k = 0; k < 200; k++) {
      const transactionId = `${userId}-txn-${k}`;
      await transactionsContainer.items.create({
        id: transactionId,
        userId,
        itemId: `${userId}-item-${k % 50}`,
        type: faker.helpers.arrayElement(['restock', 'consume', 'waste']),
        quantity: faker.number.int({ min: 1, max: 3 }),
        timestamp: faker.date.past({ years: 0.5 }).toISOString(),
      });
    }
  }

  console.log('Created 20,000 transactions (200 per user)');
  console.log('Load test data seeding complete!');
}

seedData().catch(console.error);
```

---

## 3. Artillery Test Scenarios

### Scenario 1: Normal Load (Baseline)

**File: `load-tests/normal-load.yml`**

```yaml
# load-tests/normal-load.yml
config:
  target: "https://kirana-api-staging.azurewebsites.net"
  phases:
    - duration: 60 # Ramp up: 1 minute
      arrivalRate: 5
      rampTo: 10 # Gradually increase from 5 to 10 users/sec
    - duration: 600 # Sustain: 10 minutes
      arrivalRate: 10 # 10 new users per second
  processor: "./load-test-processor.js"
  plugins:
    expect: {}
    metrics-by-endpoint: {}
  variables:
    userIds:
      - "load-test-user-0"
      - "load-test-user-1"
      - "load-test-user-2"
      # ... (list all 100 user IDs or load from file)

scenarios:
  - name: "Dashboard Load (Read-Heavy)"
    weight: 70 # 70% of traffic
    flow:
      - function: "selectRandomUser" # Custom function
      - get:
          url: "/api/items?userId={{ userId }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
            - contentType: json
            - hasProperty: "items"
          capture:
            - json: "$.items[0].id"
              as: "itemId"
      - think: 3 # User views dashboard for 3 seconds
      - get:
          url: "/api/predictions/calculate?userId={{ userId }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
            - contentType: json

  - name: "Add Item (Write)"
    weight: 20 # 20% of traffic
    flow:
      - function: "selectRandomUser"
      - post:
          url: "/api/items"
          headers:
            Authorization: "Bearer {{ token }}"
            Content-Type: "application/json"
          json:
            name: "{{ $randomProduct() }}"
            quantity: 1
            packageSize: "1 lb"
            category: "PANTRY"
            purchaseDate: "{{ $timestamp() }}"
          expect:
            - statusCode: 201
            - contentType: json
            - hasProperty: "id"

  - name: "Log Restock (Write)"
    weight: 10 # 10% of traffic
    flow:
      - function: "selectRandomUser"
      - get:
          url: "/api/items?userId={{ userId }}"
          headers:
            Authorization: "Bearer {{ token }}"
          capture:
            - json: "$.items[0].id"
              as: "itemId"
      - post:
          url: "/api/transactions"
          headers:
            Authorization: "Bearer {{ token }}"
            Content-Type: "application/json"
          json:
            itemId: "{{ itemId }}"
            type: "restock"
            quantity: 1
            timestamp: "{{ $timestamp() }}"
          expect:
            - statusCode: 201
```

**Run:**
```bash
artillery run load-tests/normal-load.yml --output report-normal.json
artillery report report-normal.json --output report-normal.html
open report-normal.html
```

---

### Scenario 2: Peak Load (Black Friday)

**File: `load-tests/peak-load.yml`**

```yaml
# load-tests/peak-load.yml
config:
  target: "https://kirana-api-staging.azurewebsites.net"
  phases:
    - duration: 120 # Ramp up: 2 minutes
      arrivalRate: 10
      rampTo: 50 # Increase to 50 users/sec
    - duration: 300 # Sustain: 5 minutes
      arrivalRate: 50 # 500 concurrent users at ~10s session duration
  processor: "./load-test-processor.js"
  plugins:
    expect: {}
    metrics-by-endpoint: {}

scenarios:
  - name: "Read Items"
    weight: 80
    flow:
      - function: "selectRandomUser"
      - get:
          url: "/api/items?userId={{ userId }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: [200, 429] # Allow rate limiting
            - maxResponseTime: 2000 # Fail if >2s

  - name: "Write Items"
    weight: 20
    flow:
      - function: "selectRandomUser"
      - post:
          url: "/api/items"
          headers:
            Authorization: "Bearer {{ token }}"
            Content-Type: "application/json"
          json:
            name: "Peak Load Test Item"
            quantity: 1
            category: "PANTRY"
          expect:
            - statusCode: [201, 429]
            - maxResponseTime: 3000
```

**Run:**
```bash
artillery run load-tests/peak-load.yml --output report-peak.json
```

---

### Scenario 3: Spike Test (Sudden Traffic Surge)

**File: `load-tests/spike-test.yml`**

```yaml
# load-tests/spike-test.yml
config:
  target: "https://kirana-api-staging.azurewebsites.net"
  phases:
    - duration: 10 # Baseline: 10 seconds
      arrivalRate: 1
    - duration: 60 # SPIKE: 1 minute
      arrivalRate: 100 # 0 → 1000 users in 1 minute
    - duration: 120 # Hold: 2 minutes
      arrivalRate: 100
    - duration: 60 # Ramp down: 1 minute
      arrivalRate: 100
      rampTo: 1
  processor: "./load-test-processor.js"

scenarios:
  - name: "Dashboard Load"
    weight: 100
    flow:
      - function: "selectRandomUser"
      - get:
          url: "/api/items?userId={{ userId }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: [200, 429, 503] # Allow rate limiting or overload
```

**Run:**
```bash
artillery run load-tests/spike-test.yml --output report-spike.json
```

---

### Scenario 4: CSV Import Load Test

**File: `load-tests/csv-import.yml`**

```yaml
# load-tests/csv-import.yml
config:
  target: "https://kirana-api-staging.azurewebsites.net"
  phases:
    - duration: 300 # 5 minutes
      arrivalRate: 1 # 1 CSV import per second (heavy operation)
  processor: "./load-test-processor.js"

scenarios:
  - name: "CSV Import"
    weight: 100
    flow:
      - function: "selectRandomUser"
      - function: "generateCSV" # Generates 100-item CSV
      - post:
          url: "/api/parse/csv"
          headers:
            Authorization: "Bearer {{ token }}"
            Content-Type: "text/csv"
          body: "{{ csvData }}"
          expect:
            - statusCode: [200, 429] # Budget cap may trigger
            - maxResponseTime: 30000 # 30 seconds max
          capture:
            - json: "$.items[0].id"
              as: "importedItemId"
```

**Run:**
```bash
artillery run load-tests/csv-import.yml --output report-csv.json
```

---

## 4. Load Test Processor (Helper Functions)

**File: `load-tests/load-test-processor.js`**

```javascript
// load-tests/load-test-processor.js
const { faker } = require('@faker-js/faker');

// Load 100 test user IDs
const userIds = Array.from({ length: 100 }, (_, i) => `load-test-user-${i}`);

// Select random user
function selectRandomUser(context, events, done) {
  context.vars.userId = faker.helpers.arrayElement(userIds);
  
  // In real scenario, would call auth endpoint to get JWT
  // For now, use pre-generated token or mock auth
  context.vars.token = process.env.TEST_JWT_TOKEN || 'mock-jwt-token';
  
  return done();
}

// Generate realistic CSV data
function generateCSV(context, events, done) {
  const rows = ['Date,Description,Amount,Category'];
  
  for (let i = 0; i < 100; i++) {
    const date = faker.date.past({ years: 0.5 }).toISOString().split('T')[0];
    const description = faker.commerce.productName();
    const amount = faker.commerce.price({ min: 5, max: 50 });
    const category = faker.helpers.arrayElement(['Grocery', 'Food', 'Household']);
    
    rows.push(`${date},${description},${amount},${category}`);
  }
  
  context.vars.csvData = rows.join('\n');
  return done();
}

// Custom timestamp generator
function timestamp() {
  return new Date().toISOString();
}

// Export functions
module.exports = {
  selectRandomUser,
  generateCSV,
  timestamp,
};
```

---

## 5. Azure Load Testing (Alternative)

### Setup

1. **Create Azure Load Testing Resource**
   ```bash
   az load create \
     --name kirana-load-test \
     --resource-group kirana-rg \
     --location eastus
   ```

2. **Upload JMeter Test Plan**
   - Create JMX file (JMeter GUI)
   - Upload to Azure Portal > Load Testing > Create Test

3. **Configure Test**
   - **Target:** https://kirana-api-staging.azurewebsites.net
   - **Duration:** 10 minutes
   - **Virtual Users:** 500
   - **Ramp-Up:** 2 minutes
   - **Regions:** East US, West US (multi-region test)

4. **Run Test**
   ```bash
   az load test create \
     --name kirana-normal-load \
     --load-test-resource kirana-load-test \
     --resource-group kirana-rg \
     --test-plan-file load-tests/kirana-test-plan.jmx \
     --engine-instances 5 \
     --description "Normal load test with 500 concurrent users"
   ```

5. **View Results**
   - Azure Portal > Load Testing > kirana-normal-load
   - Metrics: Throughput, Response Time (p50/p90/p95/p99), Error Rate
   - Integrated with Application Insights

---

## 6. Monitoring During Load Tests

### Application Insights Metrics

**Real-Time Dashboard (Grafana or Azure Portal):**

1. **Response Time (p50, p95, p99)**
   ```kusto
   requests
   | where timestamp > ago(15m)
   | summarize
       p50 = percentile(duration, 50),
       p95 = percentile(duration, 95),
       p99 = percentile(duration, 99)
     by bin(timestamp, 1m), name
   | render timechart
   ```

2. **Request Rate (RPS)**
   ```kusto
   requests
   | where timestamp > ago(15m)
   | summarize count() by bin(timestamp, 1m)
   | render timechart
   ```

3. **Error Rate**
   ```kusto
   requests
   | where timestamp > ago(15m)
   | summarize
       total = count(),
       errors = countif(success == false)
     by bin(timestamp, 1m)
   | extend errorRate = (errors * 100.0) / total
   | render timechart
   ```

4. **Cosmos DB RU/s Consumption**
   ```bash
   az monitor metrics list \
     --resource /subscriptions/{subscriptionId}/resourceGroups/kirana-rg/providers/Microsoft.DocumentDB/databaseAccounts/kirana-cosmosdb \
     --metric "TotalRequestUnits" \
     --interval PT1M \
     --start-time 2025-11-03T10:00:00Z \
     --end-time 2025-11-03T10:15:00Z
   ```

---

## 7. Performance Optimization (Based on Results)

### 7.1 Add Redis Cache (GET /items)

**Problem:** p95 latency for `GET /items` is 800ms (target: <500ms)

**Solution:** Cache dashboard items for 30 seconds

```typescript
// backend/services/CacheService.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_CONNECTION_STRING);

export class CacheService {
  async getItems(userId: string): Promise<Item[] | null> {
    const cacheKey = `items:${userId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }

  async setItems(userId: string, items: Item[], ttl: number = 30): Promise<void> {
    const cacheKey = `items:${userId}`;
    await redis.setex(cacheKey, ttl, JSON.stringify(items));
  }

  async invalidateItems(userId: string): Promise<void> {
    const cacheKey = `items:${userId}`;
    await redis.del(cacheKey);
  }
}

// In GET /items handler
const cached = await cacheService.getItems(userId);
if (cached) {
  return { status: 200, jsonBody: cached };
}

const items = await cosmosService.getItems(userId);
await cacheService.setItems(userId, items, 30); // 30-second TTL
return { status: 200, jsonBody: items };
```

**Expected Improvement:** p95 latency reduces to <200ms (60% improvement)

---

### 7.2 Batch Cosmos DB Writes (CSV Import)

**Problem:** CSV import takes 45 seconds for 100 items (target: <30s)

**Solution:** Batch inserts (20 items per batch)

```typescript
// backend/services/CosmosService.ts
export class CosmosService {
  async batchCreateItems(items: Item[]): Promise<void> {
    const BATCH_SIZE = 20;
    const batches = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      batches.push(this.createBatch(batch));
    }

    await Promise.all(batches);
  }

  private async createBatch(items: Item[]): Promise<void> {
    const operations = items.map(item => ({
      operationType: 'Create',
      resourceBody: item,
    }));

    await this.container.items.batch(operations, items[0].userId);
  }
}
```

**Expected Improvement:** CSV import reduces to <20 seconds (55% improvement)

---

### 7.3 Optimize SQL Queries (Add Composite Indexes)

**Problem:** Queries with multiple filters slow (userId + category + urgency)

**Solution:** Add composite indexes in Cosmos DB

```json
// Cosmos DB Indexing Policy
{
  "indexingMode": "consistent",
  "automatic": true,
  "includedPaths": [
    {
      "path": "/*"
    }
  ],
  "excludedPaths": [
    {
      "path": "/\"_etag\"/?"
    }
  ],
  "compositeIndexes": [
    [
      { "path": "/userId", "order": "ascending" },
      { "path": "/category", "order": "ascending" },
      { "path": "/purchaseDate", "order": "descending" }
    ],
    [
      { "path": "/userId", "order": "ascending" },
      { "path": "/updatedAt", "order": "descending" }
    ]
  ]
}
```

**Update via Azure CLI:**
```bash
az cosmosdb sql container update \
  --account-name kirana-cosmosdb \
  --database-name kirana-db \
  --name items \
  --resource-group kirana-rg \
  --idx @indexing-policy.json
```

**Expected Improvement:** Query RU/s reduces by 30-50%

---

### 7.4 Enable Cosmos DB Query Metrics

```typescript
// backend/services/CosmosService.ts
const { resources, requestCharge } = await container.items
  .query(query, { enableCrossPartitionQuery: false })
  .fetchAll();

console.log(`Query RU charge: ${requestCharge}`);

if (requestCharge > 100) {
  console.warn(`High RU query detected: ${requestCharge} RU/s`);
}
```

**Target:** Most queries <10 RU/s, complex queries <50 RU/s

---

## 8. Load Test Checklist

### Pre-Test
- [ ] Seed load test data (100 users, 5,000 items)
- [ ] Disable LLM calls (`ENABLE_LLM=false`)
- [ ] Temporarily raise budget cap to $1,000
- [ ] Verify Application Insights logging enabled
- [ ] Set up real-time monitoring dashboard

### During Test
- [ ] Monitor Application Insights (response time, error rate)
- [ ] Monitor Cosmos DB RU/s consumption
- [ ] Monitor Functions App CPU/memory usage
- [ ] Check for rate limiting (429 errors)
- [ ] Watch for Cosmos DB throttling (429 errors from Cosmos)

### Post-Test
- [ ] Generate Artillery HTML report
- [ ] Review p50/p95/p99 latencies
- [ ] Check error rate (<0.1% target)
- [ ] Identify slowest endpoints (top 5)
- [ ] Review Cosmos DB query metrics
- [ ] Document findings in `docs/testing/load-test-results.md`

---

## 9. Success Criteria

### Pass Criteria (Ready for Production)

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| GET /items p95 | <500ms | ___ ms | ⬜ |
| POST /items p95 | <1000ms | ___ ms | ⬜ |
| CSV parsing p95 | <30s | ___ s | ⬜ |
| Predictions p95 | <2000ms | ___ ms | ⬜ |
| Error rate (normal load) | <0.1% | ___ % | ⬜ |
| Error rate (peak load) | <1% | ___ % | ⬜ |
| Cosmos DB RU/s (peak) | <400 RU/s | ___ RU/s | ⬜ |
| Concurrent users (no errors) | ≥500 | ___ users | ⬜ |
| Spike test (no 500 errors) | 0 errors | ___ errors | ⬜ |

### Optimization Priorities

**If test fails:**
1. **P95 latency >500ms** → Add Redis cache
2. **CSV parsing >30s** → Batch Cosmos DB writes
3. **RU/s >400** → Optimize queries with composite indexes
4. **Error rate >0.1%** → Investigate error logs, add retries
5. **500 errors under spike** → Implement circuit breaker, graceful degradation

---

## 10. Load Test Results Template

**File: `docs/testing/load-test-results.md`**

```markdown
# Load Test Results

**Date:** November 3, 2025  
**Tester:** [Your Name]  
**Environment:** Staging (kirana-api-staging.azurewebsites.net)

## Test Scenarios

### 1. Normal Load (100 users, 10 req/sec)
- **Duration:** 10 minutes
- **Total Requests:** 6,000
- **Successful Requests:** 5,995 (99.92%)
- **Error Rate:** 0.08%

#### Performance Metrics
| Endpoint | p50 | p95 | p99 | Max | RPS |
|----------|-----|-----|-----|-----|-----|
| GET /items | 120ms | 320ms | 580ms | 1200ms | 7.0 |
| POST /items | 180ms | 450ms | 820ms | 1500ms | 2.0 |
| POST /predictions | 350ms | 1200ms | 2100ms | 3500ms | 1.0 |

**Status:** ✅ PASS (All metrics within target)

### 2. Peak Load (500 users, 50 req/sec)
- **Duration:** 5 minutes
- **Total Requests:** 15,000
- **Successful Requests:** 14,850 (99.0%)
- **Error Rate:** 1.0% (rate limiting kicked in)

#### Performance Metrics
| Endpoint | p50 | p95 | p99 | Max | RPS |
|----------|-----|-----|-----|-----|-----|
| GET /items | 250ms | 680ms | 1200ms | 2500ms | 35.0 |
| POST /items | 420ms | 1100ms | 1800ms | 3200ms | 10.0 |

**Status:** ✅ PASS (Within acceptable limits)

### 3. Spike Test (0→1000 users in 1 min)
- **Total Requests:** 12,000
- **500 Errors:** 0
- **429 Errors:** 1,200 (rate limiting)

**Status:** ✅ PASS (No crashes, rate limiting worked)

## Bottlenecks Identified
1. **GET /items** p95 latency 680ms under peak load (target: <500ms)
   - **Root Cause:** No caching, every request hits Cosmos DB
   - **Fix:** Add Redis cache with 30-second TTL

2. **Cosmos DB RU/s** peaked at 380 RU/s (near 400 limit)
   - **Root Cause:** Inefficient queries (cross-partition)
   - **Fix:** Add composite indexes for common query patterns

## Optimizations Planned
- [ ] Add Redis cache for dashboard items (expected: 60% latency reduction)
- [ ] Batch Cosmos DB writes for CSV imports (expected: 50% speed improvement)
- [ ] Add composite indexes (expected: 30% RU reduction)

## Conclusion
✅ **Ready for production** with optimizations applied.
```

---

**Last Updated:** November 3, 2025  
**Owner:** DevOps + Engineering Team  
**Status:** Ready for Execution
