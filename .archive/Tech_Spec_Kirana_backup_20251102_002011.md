# Kirana Technical Design Specification

**Document Version:** 1.1 (Hardened)  
**Last Updated:** November 1, 2025  
**Status:** Ready for Implementation  
**Author(s):** Engineering Team  

---

## 🛡️ Revision Summary (v1.1 - Hardened for Production)

This revision addresses critical failure modes identified in external review (ChatGPT feedback, November 2025). Changes prioritize **cost control**, **parsing reliability**, and **privacy compliance** without adding expensive infrastructure.

### Key Hardening Changes:

**1. LLM Cost Control (Infrastructure-Level Enforcement)**
- ✅ **Replaced in-memory cost tracker** with Cosmos DB `costTracking` container (persistent across cold starts)
- ✅ **Pre-flight token estimation** and circuit breaker logic before API calls
- ✅ **Automated budget enforcement:** User monthly cap ($0.20), daily system cap ($50)
- ✅ Cost tracking survives function restarts and scales across multiple instances

**2. Parsing Quality & Reliability**
- ✅ **Queue-based degradation** when budget exceeded or confidence low (PRD strategy, zero additional cost)
- ✅ **Deterministic parsers** for Amazon/Costco (regex-based, zero LLM cost)
- ✅ **Per-retailer success monitoring** with hourly canary tests and automated alerts
- ✅ **Hybrid routing decision tree:** Regex → Gemini → Queue for batch processing

**3. Prediction Algorithm Robustness (PRD-Aligned)**
- ✅ **Z-score outlier detection** for promotional spikes and bulk purchases (filters values >2σ)
- ✅ **RELAXED confidence thresholds:** High confidence at ≥3 purchases (PRD: optimize for cold start activation)
- ✅ Seasonality detection deferred to Phase 2A (Holt-Winters) to keep Phase 1 lean

**4. Unit Normalization Hardening**
- ✅ **SKU lookup table** (top 5K grocery items) for deterministic normalization (confidence: 1.0)
- ✅ **Multi-pack parser:** "12 × 8 oz" → 96 oz total
- ✅ **Fraction parser:** "1/2 lb" → 0.5 lb = 8 oz
- ✅ **Confidence scoring:** SKU match (1.0), regex (0.9), heuristic (0.85-0.8)

**5. Privacy & OAuth Timeline**
- ✅ **Gmail OAuth prep moved to Week 1** (4-6 week approval timeline)
- ✅ Privacy policy, DPA, consent screens, verification video as immediate deliverables
- ✅ Email body retention policy: Delete after extraction or 7-day TTL

**6. Observability & Runbooks**
- ✅ **Risk table** with automated triggers for cost spike, parsing regression, privacy incident
- ✅ **Infrastructure runbooks** with step-by-step manual responses
- ✅ **Alert thresholds:** Parsing <70% = HIGH severity, Cost >$50 = circuit breaker

### Cost Impact of Hardening:
- **No Redis required:** Use Cosmos DB for persistent state (cost-neutral)
- **No paid parsers:** Queue-based degradation strategy (PRD) preserves $50/day hard cap
- **Queue processing:** $0 additional cost (uses existing Gemini budget during off-peak)
- **Total Phase 1 budget maintained:** $0.20/user/month (LLM only)

### Trade-Offs Accepted (PRD-Aligned):
- Cosmos DB has higher latency than Redis but acceptable for cost tracking (<100ms)
- Relaxed confidence thresholds (≥3 for High) optimize for activation over accuracy
- Queued receipts have <24h delay but preserve system availability for all users

---

## Table of Contents

1. [Overview & Architecture Philosophy](#1-overview--architecture-philosophy)
2. [System Architecture](#2-system-architecture)
3. [Data Model & Schema Design](#3-data-model--schema-design)
4. [API Design](#4-api-design)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Services](#6-backend-services)
7. [Intelligence Layer (LLM Integration)](#7-intelligence-layer-llm-integration)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Data Sync & Offline Strategy](#9-data-sync--offline-strategy)
10. [Cost Optimization & Monitoring](#10-cost-optimization--monitoring)
11. [Security & Privacy](#11-security--privacy)
12. [Performance & Scalability](#12-performance--scalability)
13. [Deployment & DevOps](#13-deployment--devops)
14. [Testing Strategy](#14-testing-strategy)
15. [Observability & Monitoring](#15-observability--monitoring)
16. [Phase 1 Implementation Plan](#16-phase-1-implementation-plan)

---

## 1. Overview & Architecture Philosophy

### 1.1 Design Principles

**Cost-Effectiveness First**
- Serverless-first architecture to minimize idle costs
- Pay-per-use model for all compute resources
- Aggressive caching strategy for LLM calls
- Scheduled sync (5-15 min) instead of real-time to reduce costs

**Scalability Through Simplicity**
- Microservices pattern with Azure Functions
- Stateless services for horizontal scaling
- NoSQL for flexible schema evolution
- Async processing for heavy workloads

**Performance Without Over-Engineering**
- <2s page load time through aggressive caching
- <500ms One-Tap Restock through optimized queries
- <5s perceived latency for OCR through async processing
- Offline-first PWA with IndexedDB

**Privacy by Design**
- Explicit opt-in for all data collection
- User-controlled data retention policies
- Anonymization for crowdsourced data
- One-click data deletion

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 18 + TypeScript + Vite | Fast dev experience, type safety, mature ecosystem |
| **State Management** | Zustand + React Query | Lightweight, great for offline-first apps |
| **Offline Storage** | IndexedDB (via Dexie.js) | PWA standard, robust for structured data |
| **UI Framework** | TailwindCSS + shadcn/ui | Rapid development, accessible components |
| **Backend Runtime** | Azure Functions (Node.js 20 LTS) | Serverless, auto-scaling, pay-per-use |
| **Database** | Azure Cosmos DB (NoSQL API) | Global distribution, change feed, flexible schema |
| **Blob Storage** | Azure Blob Storage (Hot tier) | Cost-effective for receipts/images |
| **Authentication** | Microsoft Entra ID | Enterprise-grade, OAuth 2.0, RBAC support |
| **LLM** | Google Gemini 2.5 Flash API | Cost-effective, multimodal (text + vision) |
| **Monitoring** | Azure Application Insights | Built-in dashboards, cost tracking, anomaly detection |
| **CI/CD** | GitHub Actions + Azure DevOps | Native Azure integration, free for open source |

### 1.3 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React PWA (TypeScript + Vite)                           │   │
│  │  - Service Worker (offline caching)                      │   │
│  │  - IndexedDB (local state)                               │   │
│  │  - React Query (server state sync)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS/REST
┌─────────────────────────────────────────────────────────────────┐
│                       API GATEWAY LAYER                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Azure API Management (optional for Phase 3+)            │   │
│  │  - Rate limiting, throttling                             │   │
│  │  - Request/response transformation                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    SERVERLESS FUNCTIONS LAYER                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Auth       │  │ Items      │  │ Prediction │  │ Parsing  │  │
│  │ Function   │  │ Function   │  │ Function   │  │ Function │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Sync       │  │ Email      │  │ CSV        │  │ Analytics│  │
│  │ Function   │  │ Function   │  │ Function   │  │ Function │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
          ↕                    ↕                         ↕
┌──────────────────┐  ┌──────────────────┐   ┌──────────────────┐
│  Cosmos DB       │  │  Blob Storage    │   │  Gemini API      │
│  (NoSQL)         │  │  (Receipts)      │   │  (External)      │
│  - Items         │  │  - Photos        │   │  - Normalization │
│  - Transactions  │  │  - Email HTML    │   │  - OCR           │
│  - Households    │  └──────────────────┘   └──────────────────┘
│  - Cache         │
└──────────────────┘
          ↕
┌──────────────────┐
│  Change Feed     │
│  (Sync Trigger)  │
└──────────────────┘
</pre>

### 1.4 Regional Deployment Strategy

**Primary Region:** West US 2 (or West US 3 as fallback)
- All resources co-located in single region for Phase 1-3
- Minimizes data transfer costs
- Simplifies compliance (single jurisdiction)
- <100ms latency for US West Coast users

**Multi-Region Expansion (Phase 4+):**
- East US 2 for US East Coast users
- Europe West (Ireland) for GDPR compliance
- Cosmos DB multi-region writes for global sync

---

## 2. System Architecture

### 2.1 Microservices Decomposition

Each Azure Function represents a bounded context with single responsibility:

#### 2.1.1 Core Domain Services

**1. Items Service (`items-function`)**
- **Responsibility:** CRUD operations for inventory items
- **Endpoints:**
  - `POST /api/items` - Create item
  - `GET /api/items/:id` - Get item
  - `GET /api/households/:householdId/items` - List household items
  - `PATCH /api/items/:id` - Update item
  - `DELETE /api/items/:id` - Soft delete item
- **Database:** Cosmos DB `items` container
- **Scaling:** Auto-scale based on request count

**2. Transactions Service (`transactions-function`)**
- **Responsibility:** Purchase history management
- **Endpoints:**
  - `POST /api/transactions` - Record purchase
  - `GET /api/items/:itemId/transactions` - Get item history
  - `GET /api/households/:householdId/transactions` - List all purchases
- **Database:** Cosmos DB `transactions` container
- **Scaling:** Auto-scale based on request count

**3. Predictions Service (`predictions-function`)**
- **Responsibility:** Run-out date calculation
- **Endpoints:**
  - `POST /api/predictions/calculate` - Trigger prediction recalculation
  - `GET /api/items/:itemId/prediction` - Get prediction details
  - `POST /api/predictions/override` - Record user override
- **Database:** Cosmos DB `items` container (updates `predictedRunOutDate`)
- **Scaling:** CPU-bound; may need premium plan for complex calculations
- **Triggers:** 
  - HTTP endpoint for manual triggers
  - Timer trigger (daily 2 AM) for batch recalculation

**4. Parsing Service (`parsing-function`)**
- **Responsibility:** Receipt parsing orchestration
- **Endpoints:**
  - `POST /api/parse/csv` - Parse CSV upload
  - `POST /api/parse/photo` - Parse photo receipt
  - `POST /api/parse/email` - Parse email receipt
- **External Dependencies:** Gemini API
- **Database:** Cosmos DB `parseJobs` container (job queue)
- **Scaling:** Queue-based processing with concurrency limits

#### 2.1.2 Supporting Services

**5. Sync Service (`sync-function`)**
- **Responsibility:** Multi-device synchronization
- **Trigger:** Cosmos DB Change Feed (every 5-15 min)
- **Logic:**
  - Detect changes since last sync
  - Resolve conflicts (Last-Write-Wins)
  - Push updates to clients via webhook/polling
- **Database:** Cosmos DB `syncState` container

**6. Auth Service (`auth-function`)**
- **Responsibility:** Authentication wrapper
- **Endpoints:**
  - `POST /api/auth/login` - Entra ID OAuth callback
  - `POST /api/auth/refresh` - Refresh access token
  - `POST /api/auth/logout` - Invalidate session
- **External Dependencies:** Microsoft Entra ID
- **Database:** Cosmos DB `users` container

**7. Analytics Service (`analytics-function`)**
- **Responsibility:** Event tracking and metrics
- **Endpoints:**
  - `POST /api/events` - Log user event
  - `GET /api/metrics/dashboard` - Get aggregated metrics
- **Database:** Cosmos DB `events` container
- **Scaling:** Batch writes to reduce costs

**8. Email Forwarding Service (`email-function`)**
- **Responsibility:** Process forwarded receipts
- **Trigger:** Azure Logic Apps (email connector) → HTTP trigger
- **Logic:**
  - Parse email metadata
  - Extract attachments
  - Store in Blob Storage
  - Trigger parsing service
- **Database:** Cosmos DB `emailJobs` container

### 2.2 Data Flow Diagrams

#### 2.2.1 CSV Import Flow

```
User uploads CSV
      ↓
Frontend validates format
      ↓
POST /api/parse/csv with file
      ↓
Parsing Function:
  1. Store raw CSV in Blob Storage
  2. Parse with deterministic logic (Amazon format)
  3. For each line item:
     - Check in-memory cache (top 1000 items)
     - If not found → Gemini API call
     - Store in parseJobs queue
  4. Return jobId
      ↓
Frontend polls GET /api/parse/jobs/:jobId
      ↓
When parsing complete:
  - Items with ≥80% confidence → auto-create
  - Items with <80% confidence → inline micro-review queue
      ↓
Predictions Function triggered (batch)
      ↓
User sees items with predictions
```

#### 2.2.2 Photo Receipt OCR Flow

```
User takes photo or uploads image
      ↓
Frontend compresses image (max 2MB)
      ↓
POST /api/parse/photo with base64 image
      ↓
Parsing Function:
  1. Store original in Blob Storage (hot tier)
  2. Call Gemini Vision API with structured prompt
  3. Parse JSON response
  4. For each extracted item:
     - Normalize with cached mappings
     - If confidence <80% → queue for review
  5. Return jobId + initial results
      ↓
Frontend shows inline micro-review UI
      ↓
User accepts/rejects/edits items
      ↓
POST /api/items/batch (bulk create)
      ↓
Predictions Function triggered
      ↓
User sees predictions
```

#### 2.2.3 Prediction Calculation Flow

```
Trigger: New transaction recorded OR Timer (2 AM daily)
      ↓
Predictions Function:
  1. Query all items for household
  2. For each item:
     - Get transaction history (last 12 months)
     - Calculate exponential smoothing:
       * smoothedDaysBetween = α * actualDays + (1-α) * prevSmoothed
       * smoothedQuantity = α * actualQty + (1-α) * prevSmoothed
     - Apply quantity-aware formula:
       * runOut = lastPurchaseDate + (smoothedDays * lastQty / smoothedQty)
     - Calculate confidence score:
       * High: ≥3 purchases, stdDev <20%, recent <30d
       * Medium: 2 purchases OR stdDev <40%
       * Low: 1 purchase OR irregular pattern
  3. Batch update Cosmos DB (items container)
  4. Log metrics to Analytics
      ↓
Client polls or receives webhook notification
      ↓
UI updates with new predictions
```

### 2.3 Cosmos DB Container Design

#### 2.3.1 Partition Strategy

**Goal:** Optimize for single-household queries (most common pattern)

**Partition Key:** `/householdId`

**Rationale:**
- 99% of queries filter by householdId
- Single-partition queries are fast and cost-effective
- Cross-partition queries only for admin/analytics (rare)
- Average household has 50-200 items → well within 20GB partition limit

#### 2.3.2 Container Schema

**Container 1: `items` (Master Inventory)**

```json
{
  "id": "uuid-v4",
  "householdId": "household-123",
  "type": "item",
  "canonicalName": "Organic Whole Milk",
  "brand": "365 Everyday Value",
  "category": "Dairy",
  "unitOfMeasure": "gal",
  "unitSize": 1.0,
  "preferredVendor": "Whole Foods",
  "avgFrequencyDays": 7.2,
  "avgPurchaseQuantity": 2.0,
  "lastPurchaseQuantity": 2.0,
  "lastPurchaseDate": "2025-10-28T10:00:00Z",
  "predictedRunOutDate": "2025-11-05T00:00:00Z",
  "predictionConfidence": "high",
  "predictionMetadata": {
    "purchaseCount": 5,
    "stdDevDays": 1.2,
    "lastCalculated": "2025-10-29T02:00:00Z"
  },
  "priceHistory": [
    {
      "date": "2025-10-28",
      "totalPrice": 7.98,
      "quantity": 2,
      "unitPrice": 3.99,
      "retailer": "Whole Foods"
    }
  ],
  "userOverrides": [
    {
      "date": "2025-10-29",
      "originalPrediction": "2025-11-05",
      "userPrediction": "2025-11-07",
      "reason": "going_on_vacation"
    }
  ],
  "teachModeData": {
    "enabled": true,
    "frequency": "weekly",
    "customDays": 7
  },
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-10-29T02:00:00Z",
  "deletedAt": null,
  "_etag": "auto-generated"
}
```

**Container 2: `transactions` (Purchase History)**

```json
{
  "id": "uuid-v4",
  "householdId": "household-123",
  "type": "transaction",
  "itemId": "item-uuid",
  "purchaseDate": "2025-10-28T10:00:00Z",
  "retailer": "Whole Foods",
  "totalPrice": 7.98,
  "quantity": 2.0,
  "unitPrice": 3.99,
  "unitOfMeasure": "gal",
  "sourceType": "csv_import",
  "sourceMetadata": {
    "fileName": "amazon_orders_2025.csv",
    "lineNumber": 42,
    "rawLineItem": "365 Organic Whole Milk, 1 gal (2-pack)"
  },
  "createdAt": "2025-10-28T10:30:00Z",
  "_etag": "auto-generated"
}
```

**Container 3: `households` (Multi-User Support)**

```json
{
  "id": "household-123",
  "householdId": "household-123",
  "type": "household",
  "name": "Smith Family",
  "members": [
    {
      "userId": "user-abc",
      "email": "john@example.com",
      "role": "admin",
      "joinedAt": "2025-09-01T10:00:00Z"
    },
    {
      "userId": "user-def",
      "email": "jane@example.com",
      "role": "member",
      "joinedAt": "2025-09-02T14:00:00Z"
    }
  ],
  "settings": {
    "syncInterval": 10,
    "timezone": "America/Los_Angeles",
    "currency": "USD"
  },
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-10-29T02:00:00Z"
}
```

**Container 4: `cache` (LLM Normalization Cache)**

```json
{
  "id": "cache-key-hash",
  "householdId": "global",
  "type": "normalization_cache",
  "rawText": "365 org whl mlk 1g",
  "canonicalName": "Organic Whole Milk",
  "brand": "365 Everyday Value",
  "category": "Dairy",
  "unitOfMeasure": "gal",
  "unitSize": 1.0,
  "confidence": 0.95,
  "hitCount": 127,
  "lastUsed": "2025-10-29T15:30:00Z",
  "createdAt": "2025-09-05T08:00:00Z",
  "ttl": 7776000
}
```

**Container 5: `parseJobs` (Async Processing Queue)**

```json
{
  "id": "job-uuid",
  "householdId": "household-123",
  "type": "parse_job",
  "jobType": "photo_ocr",
  "status": "processing",
  "blobUri": "https://storage.blob.core.windows.net/receipts/receipt-123.jpg",
  "results": [
    {
      "rawText": "Organic Milk 2x",
      "canonicalName": "Organic Whole Milk",
      "confidence": 0.85,
      "status": "auto_accepted",
      "itemId": "item-uuid"
    },
    {
      "rawText": "Broccoli 1.2lb",
      "canonicalName": "Broccoli Crowns",
      "confidence": 0.65,
      "status": "needs_review",
      "itemId": null
    }
  ],
  "metadata": {
    "retailer": "Whole Foods",
    "totalAmount": 45.67,
    "date": "2025-10-28"
  },
  "llmCost": 0.0012,
  "processingTime": 3.2,
  "createdAt": "2025-10-29T15:00:00Z",
  "updatedAt": "2025-10-29T15:00:03Z",
  "ttl": 604800
}
```

**Container 6: `events` (Analytics & Telemetry)**

```json
{
  "id": "event-uuid",
  "householdId": "household-123",
  "type": "event",
  "eventType": "prediction_override",
  "userId": "user-abc",
  "itemId": "item-uuid",
  "metadata": {
    "originalPrediction": "2025-11-05",
    "userPrediction": "2025-11-07",
    "confidenceScore": "high"
  },
  "timestamp": "2025-10-29T16:45:00Z",
  "sessionId": "session-xyz",
  "ttl": 7776000
}
```

### 2.4 Indexing Strategy

**Goal:** Optimize for common query patterns while minimizing RU costs

**Container: `items`**
- Automatic indexing: All properties (Cosmos DB default)
- Exclude from index: `priceHistory/*/date`, `userOverrides/*/date` (rarely queried)
- Composite index: `[householdId ASC, predictedRunOutDate ASC]` for shopping list queries

**Container: `transactions`**
- Composite index: `[householdId ASC, itemId ASC, purchaseDate DESC]` for history queries
- Exclude from index: `sourceMetadata/*` (large, never queried)

**Container: `cache`**
- Composite index: `[rawText ASC, hitCount DESC]` for cache lookup and eviction

**Container: `parseJobs`**
- Composite index: `[householdId ASC, createdAt DESC]` for job history
- TTL enabled: Auto-delete after 7 days

**Container: `events`**
- Composite index: `[householdId ASC, eventType ASC, timestamp DESC]` for analytics
- TTL enabled: Auto-delete after 90 days

---

## 3. Data Model & Schema Design

### 3.1 Domain Entities

#### 3.1.1 Item (Aggregate Root)

**Invariants:**
- `canonicalName` must be non-empty and ≤200 chars
- `unitOfMeasure` must be from allowed enum
- `predictedRunOutDate` must be >= `lastPurchaseDate`
- `avgFrequencyDays` must be > 0
- `priceHistory` max 12 entries (rolling 12 months)

**Business Rules:**
- Soft delete only (set `deletedAt`, never remove from DB)
- `predictedRunOutDate` recalculated on transaction insert
- `predictionConfidence` recomputed daily
- User overrides decay after 30 days without activity

#### 3.1.2 Transaction (Value Object)

**Invariants:**
- `quantity` must be > 0
- `totalPrice` must be >= 0
- `purchaseDate` must be <= current date
- `itemId` must reference existing item

**Business Rules:**
- Immutable once created (no updates, only inserts)
- Triggers prediction recalculation for associated item
- Grouped by date for batch processing

#### 3.1.3 Household (Aggregate Root)

**Invariants:**
- Must have at least one admin member
- `members` array max 10 entries (Phase 1-2 limit)
- `syncInterval` between 5-60 minutes

**Business Rules:**
- Admin can add/remove members
- Members can only view/edit items
- Last admin cannot leave without promoting another member

### 3.2 Unit Normalization Library

**Implementation:** TypeScript module with zero dependencies

```typescript
// src/shared/unitNormalizer.ts

export enum UnitType {
  WEIGHT = 'weight',
  VOLUME = 'volume',
  COUNT = 'count',
  UNKNOWN = 'unknown'
}

export enum StandardUnit {
  // Weight
  OZ = 'oz',
  LB = 'lb',
  G = 'g',
  KG = 'kg',
  // Volume
  FL_OZ = 'fl_oz',
  GAL = 'gal',
  QT = 'qt',
  PT = 'pt',
  ML = 'ml',
  L = 'l',
  // Count
  COUNT = 'count',
  PACK = 'pack',
  EACH = 'each'
}

interface NormalizedUnit {
  type: UnitType;
  standardUnit: StandardUnit;
  standardQuantity: number;
  originalUnit: string;
  originalQuantity: number;
}

const WEIGHT_CONVERSIONS: Record<string, number> = {
  'oz': 1,
  'lb': 16,
  'g': 0.035274,
  'kg': 35.274
};

const VOLUME_CONVERSIONS: Record<string, number> = {
  'fl_oz': 1,
  'fl oz': 1,
  'cup': 8,
  'pt': 16,
  'pint': 16,
  'qt': 32,
  'quart': 32,
  'gal': 128,
  'gallon': 128,
  'ml': 0.033814,
  'l': 33.814,
  'liter': 33.814
};

// SKU Lookup Table (top 5K most common grocery items)
// Loaded from Cosmos DB `cache` container at startup
interface SKUMapping {
  sku: string;
  canonicalName: string;
  brand: string;
  retailer: string;
  unitType: UnitType;
  standardUnit: StandardUnit;
  standardQuantity: number;
  confidence: number; // 1.0 for verified SKUs
}

export class UnitNormalizer {
  private static skuCache: Map<string, SKUMapping> = new Map();
  
  static async loadSKUCache(cosmosContainer: any): Promise<void> {
    // Load top 5K SKUs from Cosmos `cache` container
    const { resources } = await cosmosContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.frequency DESC OFFSET 0 LIMIT 5000',
        parameters: [{ name: '@type', value: 'sku_mapping' }]
      })
      .fetchAll();
    
    resources.forEach((sku: SKUMapping) => {
      this.skuCache.set(sku.sku, sku);
    });
  }
  
  /**
   * Normalize unit string with multi-strategy approach:
   * 1. SKU lookup (deterministic, high confidence)
   * 2. Regex parsing with heuristics
   * 3. Return null for manual review if ambiguous
   */
  static normalize(
    quantity: number, 
    unit: string,
    context?: { 
      retailer?: string;
      sku?: string;
      rawText?: string; 
    }
  ): (NormalizedUnit & { confidence: number }) | null {
    const cleanUnit = unit.toLowerCase().trim();
    
    // STRATEGY 1: SKU Lookup (highest confidence)
    if (context?.sku && this.skuCache.has(context.sku)) {
      const skuData = this.skuCache.get(context.sku)!;
      return {
        type: skuData.unitType,
        standardUnit: skuData.standardUnit,
        standardQuantity: quantity * skuData.standardQuantity,
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 1.0,
      };
    }
    
    // STRATEGY 2: Parse multi-pack format ("12 × 8 oz" → 96 oz total)
    const multiPackMatch = cleanUnit.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(\w+)/);
    if (multiPackMatch) {
      const packCount = parseInt(multiPackMatch[1]);
      const unitSize = parseFloat(multiPackMatch[2]);
      const unitName = multiPackMatch[3];
      
      const baseNormalized = this.normalize(unitSize, unitName);
      if (baseNormalized) {
        return {
          ...baseNormalized,
          standardQuantity: baseNormalized.standardQuantity * packCount * quantity,
          originalUnit: unit,
          confidence: 0.85, // High confidence for explicit multi-pack
        };
      }
    }
    
    // STRATEGY 3: Parse fractional units ("1/2 lb" → 0.5 lb)
    const fractionMatch = cleanUnit.match(/(\d+)\/(\d+)\s*(\w+)/);
    if (fractionMatch) {
      const numerator = parseInt(fractionMatch[1]);
      const denominator = parseInt(fractionMatch[2]);
      const unitName = fractionMatch[3];
      
      const fractionalQty = (numerator / denominator) * quantity;
      const baseNormalized = this.normalize(fractionalQty, unitName);
      if (baseNormalized) {
        return { ...baseNormalized, confidence: 0.85 };
      }
    }
    
    // STRATEGY 4: Standard unit conversions
    // Weight normalization
    if (cleanUnit in WEIGHT_CONVERSIONS) {
      return {
        type: UnitType.WEIGHT,
        standardUnit: StandardUnit.OZ,
        standardQuantity: quantity * WEIGHT_CONVERSIONS[cleanUnit],
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 0.9,
      };
    }
    
    // Volume normalization
    if (cleanUnit in VOLUME_CONVERSIONS) {
      return {
        type: UnitType.VOLUME,
        standardUnit: StandardUnit.FL_OZ,
        standardQuantity: quantity * VOLUME_CONVERSIONS[cleanUnit],
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 0.9,
      };
    }
    
    // Count normalization
    if (['count', 'each', 'pack', 'ct', 'ea'].includes(cleanUnit)) {
      return {
        type: UnitType.COUNT,
        standardUnit: StandardUnit.COUNT,
        standardQuantity: quantity,
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 0.8,
      };
    }
    
    // STRATEGY 5: Heuristic for promotional formats ("2 for $5")
    // Return null to trigger micro-review with suggested unit
    if (context?.rawText?.match(/\d+\s+for\s+\$\d+/i)) {
      console.warn('Promotional format detected, flagging for review:', context.rawText);
      return null; // Trigger micro-review
    }
    
    // Unknown unit - flag for manual review
    return null;
  }
  
  static calculateUnitPrice(
    totalPrice: number, 
    quantity: number, 
    unit: string,
    context?: { retailer?: string; sku?: string; rawText?: string }
  ): { unitPrice: number; confidence: number } | null {
    const normalized = this.normalize(quantity, unit, context);
    if (!normalized) return null;
    
    return {
      unitPrice: totalPrice / normalized.standardQuantity,
      confidence: normalized.confidence,
    };
  }
  
  static compareUnits(unit1: string, unit2: string): boolean {
    // Returns true if units are of same type (can be compared)
    const norm1 = this.normalize(1, unit1);
    const norm2 = this.normalize(1, unit2);
    
    if (!norm1 || !norm2) return false;
    return norm1.type === norm2.type;
  }
  
  /**
   * Tokenize and canonicalize item names for cache lookup
   * Strips brand tokens, pack descriptors, promotional text
   */
  static canonicalizeItemName(rawText: string): string {
    let cleaned = rawText.toLowerCase().trim();
    
    // Remove promotional text
    cleaned = cleaned.replace(/\b(sale|discount|bonus|free|save|extra)\b/gi, '');
    
    // Remove pack descriptors
    cleaned = cleaned.replace(/\(\d+\s*-?\s*pack\)/gi, '');
    cleaned = cleaned.replace(/\b\d+\s*ct\b/gi, '');
    
    // Remove size descriptors from name (keep in unit field)
    cleaned = cleaned.replace(/\b\d+(?:\.\d+)?\s*(oz|lb|gal|fl\s*oz|ml|l|g|kg)\b/gi, '');
    
    // Normalize common abbreviations
    cleaned = cleaned.replace(/\borg\b/g, 'organic');
    cleaned = cleaned.replace(/\bwhl\b/g, 'whole');
    cleaned = cleaned.replace(/\bmlk\b/g, 'milk');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
}
```

**Edge Cases Handled:**
- **SKU Match:** Top 5K SKUs → deterministic normalization (confidence: 1.0)
- **Multi-pack:** "12 × 8 oz" → 96 oz total (confidence: 0.85)
- **Fractions:** "1/2 lb" → 0.5 lb = 8 oz (confidence: 0.85)
- **Promotions:** "2 for $5" → return null → trigger micro-review
- **Family size** (no unit) → return null → flag for manual review
- **12 oz vs 12 fl oz** → distinguish via WEIGHT vs VOLUME conversions
- **Missing units** → return null → prompt in micro-review

**Confidence Scoring:**
- `1.0` = SKU match (deterministic, verified)
- `0.9` = Standard unit conversion (oz, lb, gal, etc.)
- `0.85` = Multi-pack or fraction parsing (heuristic)
- `0.8` = Count/Each normalization
- `null` = Ambiguous or promotional format → manual review

**Test Coverage:** 1,000 SKU test harness required before Phase 2 (target: >90% normalization success)

---

## 4. API Design

### 4.1 RESTful API Conventions

**Base URL:** `https://api.kirana.app/v1`

**Authentication:** Bearer token (JWT from Entra ID)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Household-Id: household-123 (optional, defaults to user's primary household)
X-Request-Id: uuid-v4 (for tracing)
```

**Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601",
    "version": "v1"
  }
}
```

**Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "ITEM_NOT_FOUND",
    "message": "Item with ID 'xyz' not found",
    "details": { ... },
    "requestId": "uuid"
  }
}
```

**HTTP Status Codes:**
- 200: Success (GET, PATCH, DELETE)
- 201: Created (POST)
- 400: Bad Request (validation errors)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (optimistic concurrency failure)
- 429: Too Many Requests (rate limited)
- 500: Internal Server Error
- 503: Service Unavailable (LLM quota exceeded, degraded mode)

### 4.2 Core API Endpoints

#### 4.2.1 Items API

**Create Item**
```
POST /api/items
Authorization: Bearer <token>

Request:
{
  "canonicalName": "Organic Whole Milk",
  "brand": "365 Everyday Value",
  "category": "Dairy",
  "unitOfMeasure": "gal",
  "unitSize": 1.0,
  "preferredVendor": "Whole Foods",
  "teachModeData": {
    "enabled": true,
    "frequency": "weekly"
  }
}

Response: 201 Created
{
  "success": true,
  "data": {
    "id": "item-uuid",
    "canonicalName": "Organic Whole Milk",
    ...
    "predictedRunOutDate": null,
    "predictionConfidence": "low"
  }
}
```

**List Items**
```
GET /api/households/:householdId/items?
  filter=active|all|deleted&
  sortBy=runOutDate|name|lastPurchase&
  vendor=Whole Foods&
  category=Dairy

Response: 200 OK
{
  "success": true,
  "data": [
    { "id": "item-1", ... },
    { "id": "item-2", ... }
  ],
  "meta": {
    "total": 127,
    "page": 1,
    "pageSize": 50
  }
}
```

**Get Item Details**
```
GET /api/items/:id

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "item-uuid",
    "canonicalName": "Organic Whole Milk",
    "predictedRunOutDate": "2025-11-05T00:00:00Z",
    "predictionConfidence": "high",
    "predictionMetadata": {
      "purchaseCount": 5,
      "avgFrequencyDays": 7.2,
      "lastCalculated": "2025-10-29T02:00:00Z",
      "factors": [
        "Consistent purchase pattern (±1 day)",
        "Recent purchase (< 30 days)",
        "5 historical purchases"
      ]
    },
    "transactions": [ ... ],
    "priceHistory": [ ... ]
  }
}
```

**Update Item**
```
PATCH /api/items/:id
If-Match: "etag-value" (optimistic concurrency)

Request:
{
  "preferredVendor": "Costco",
  "teachModeData": {
    "enabled": false
  }
}

Response: 200 OK (returns updated item)
```

**Delete Item (Soft Delete)**
```
DELETE /api/items/:id

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "item-uuid",
    "deletedAt": "2025-10-29T16:00:00Z"
  }
}
```

#### 4.2.2 Transactions API

**Record Purchase**
```
POST /api/transactions

Request:
{
  "itemId": "item-uuid",
  "purchaseDate": "2025-10-28T10:00:00Z",
  "retailer": "Whole Foods",
  "totalPrice": 7.98,
  "quantity": 2.0,
  "unitOfMeasure": "gal",
  "sourceType": "manual_entry"
}

Response: 201 Created
{
  "success": true,
  "data": {
    "id": "txn-uuid",
    "itemId": "item-uuid",
    ...
    "unitPrice": 3.99
  },
  "meta": {
    "predictionUpdated": true,
    "newRunOutDate": "2025-11-05T00:00:00Z"
  }
}
```

**Get Transaction History**
```
GET /api/items/:itemId/transactions?
  limit=10&
  since=2025-01-01

Response: 200 OK
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 5,
    "oldest": "2025-09-01T00:00:00Z",
    "newest": "2025-10-28T10:00:00Z"
  }
}
```

#### 4.2.3 Predictions API

**Trigger Prediction Recalculation**
```
POST /api/predictions/calculate

Request:
{
  "itemIds": ["item-1", "item-2"], // optional, defaults to all
  "force": false // optional, skip cache
}

Response: 202 Accepted
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "queued",
    "estimatedCompletion": "2025-10-29T16:05:00Z"
  }
}
```

**Override Prediction**
```
POST /api/predictions/override

Request:
{
  "itemId": "item-uuid",
  "originalPrediction": "2025-11-05T00:00:00Z",
  "userPrediction": "2025-11-07T00:00:00Z",
  "reason": "going_on_vacation"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "itemId": "item-uuid",
    "predictedRunOutDate": "2025-11-07T00:00:00Z",
    "overrideRecorded": true
  }
}
```

#### 4.2.4 Parsing API

**Parse CSV Upload**
```
POST /api/parse/csv
Content-Type: multipart/form-data

Request:
- file: amazon_orders_2025.csv
- source: "amazon"

Response: 202 Accepted
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "processing",
    "estimatedCompletion": "2025-10-29T16:02:00Z"
  }
}

Polling endpoint:
GET /api/parse/jobs/:jobId

Response: 200 OK
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "completed",
    "results": {
      "totalLines": 247,
      "parsed": 245,
      "autoAccepted": 220,
      "needsReview": 25,
      "failed": 2
    },
    "items": [ ... ],
    "reviewQueue": [ ... ]
  }
}
```

**Parse Photo Receipt**
```
POST /api/parse/photo
Content-Type: multipart/form-data

Request:
- file: receipt.jpg (max 2MB)
- retailer: "Whole Foods" (optional hint)

Response: 202 Accepted
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "blobUri": "https://storage.blob.core.windows.net/receipts/receipt-uuid.jpg"
  }
}

Polling: GET /api/parse/jobs/:jobId
```

**Submit Micro-Review**
```
POST /api/parse/review

Request:
{
  "jobId": "job-uuid",
  "itemIndex": 0,
  "action": "accept|reject|edit",
  "edits": {
    "canonicalName": "Organic Whole Milk",
    "quantity": 2.0,
    "unitOfMeasure": "gal"
  }
}

Response: 200 OK
{
  "success": true,
  "data": {
    "itemId": "item-uuid", // if accepted/edited
    "remainingReviews": 2
  }
}
```

---

## 5. Frontend Architecture

### 5.1 React Application Structure

```
src/
├── app/                          # Application root
│   ├── App.tsx                   # Main app component
│   ├── routes.tsx                # Route definitions
│   └── providers.tsx             # Context providers
├── features/                     # Feature modules
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   └── LogoutButton.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useEntraId.ts
│   │   ├── services/
│   │   │   └── authService.ts
│   │   └── store/
│   │       └── authStore.ts
│   ├── items/
│   │   ├── components/
│   │   │   ├── ItemList.tsx
│   │   │   ├── ItemCard.tsx
│   │   │   ├── ItemDetails.tsx
│   │   │   └── AddItemForm.tsx
│   │   ├── hooks/
│   │   │   ├── useItems.ts
│   │   │   ├── usePredictions.ts
│   │   │   └── useItemMutations.ts
│   │   └── services/
│   │       └── itemsService.ts
│   ├── parsing/
│   │   ├── components/
│   │   │   ├── CSVUploader.tsx
│   │   │   ├── PhotoCapture.tsx
│   │   │   ├── MicroReview.tsx
│   │   │   └── ParsingProgress.tsx
│   │   ├── hooks/
│   │   │   ├── useParseJob.ts
│   │   │   └── useMicroReview.ts
│   │   └── services/
│   │       └── parsingService.ts
│   ├── onboarding/
│   │   ├── components/
│   │   │   ├── DemoMode.tsx
│   │   │   ├── TeachMode.tsx
│   │   │   └── OnboardingStepper.tsx
│   │   └── hooks/
│   │       └── useOnboarding.ts
│   └── analytics/
│       ├── hooks/
│       │   └── useAnalytics.ts
│       └── services/
│           └── analyticsService.ts
├── shared/                       # Shared utilities
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── Layout.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── LoadingSpinner.tsx
│   ├── hooks/
│   │   ├── useOfflineSync.ts
│   │   ├── useIndexedDB.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   ├── unitNormalizer.ts
│   │   └── dateUtils.ts
│   └── store/
│       ├── rootStore.ts
│       └── syncStore.ts
├── workers/                      # Service Workers
│   ├── sw.ts                    # Main service worker
│   └── sync-worker.ts           # Background sync
└── styles/
    └── globals.css              # TailwindCSS
```

### 5.2 State Management Strategy

**Zustand for Global State**
```typescript
// src/shared/store/rootStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  householdId: string | null;
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
  
  setHouseholdId: (id: string) => void;
  setOnlineStatus: (status: boolean) => void;
  setSyncStatus: (status: AppState['syncStatus']) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      householdId: null,
      isOnline: navigator.onLine,
      syncStatus: 'idle',
      lastSyncTime: null,
      
      setHouseholdId: (id) => set({ householdId: id }),
      setOnlineStatus: (status) => set({ isOnline: status }),
      setSyncStatus: (status) => set({ syncStatus: status }),
    }),
    {
      name: 'kirana-app-state',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**React Query for Server State**
```typescript
// src/features/items/hooks/useItems.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsService } from '../services/itemsService';

export function useItems(householdId: string) {
  return useQuery({
    queryKey: ['items', householdId],
    queryFn: () => itemsService.list(householdId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
    retry: 3,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: itemsService.create,
    onSuccess: (data, variables) => {
      // Optimistic update
      queryClient.setQueryData(
        ['items', variables.householdId],
        (old: any) => [...(old || []), data]
      );
      
      // Invalidate to refetch with predictions
      queryClient.invalidateQueries(['items', variables.householdId]);
    },
    onError: (error, variables) => {
      // Revert optimistic update
      queryClient.invalidateQueries(['items', variables.householdId]);
      console.error('Failed to create item:', error);
    },
  });
}
```

### 5.3 Offline-First Architecture

**IndexedDB Schema (via Dexie.js)**
```typescript
// src/shared/lib/db.ts
import Dexie, { Table } from 'dexie';

interface Item {
  id: string;
  householdId: string;
  canonicalName: string;
  predictedRunOutDate: string | null;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastModified: Date;
  // ... other fields
}

interface Transaction {
  id: string;
  itemId: string;
  purchaseDate: string;
  syncStatus: 'synced' | 'pending';
  // ... other fields
}

interface SyncQueue {
  id?: number;
  operation: 'create' | 'update' | 'delete';
  entity: 'item' | 'transaction';
  entityId: string;
  payload: any;
  retryCount: number;
  createdAt: Date;
}

class KiranaDB extends Dexie {
  items!: Table<Item, string>;
  transactions!: Table<Transaction, string>;
  syncQueue!: Table<SyncQueue, number>;
  
  constructor() {
    super('KiranaDB');
    this.version(1).stores({
      items: 'id, householdId, predictedRunOutDate, syncStatus',
      transactions: 'id, itemId, purchaseDate, syncStatus',
      syncQueue: '++id, entity, createdAt',
    });
  }
}

export const db = new KiranaDB();
```

**Offline Sync Hook**
```typescript
// src/shared/hooks/useOfflineSync.ts
import { useEffect } from 'react';
import { useAppStore } from '../store/rootStore';
import { db } from '../lib/db';
import { syncService } from '../services/syncService';

export function useOfflineSync() {
  const { isOnline, setSyncStatus } = useAppStore();
  
  useEffect(() => {
    if (!isOnline) return;
    
    const syncPendingChanges = async () => {
      setSyncStatus('syncing');
      
      try {
        const pendingItems = await db.syncQueue
          .where('operation')
          .anyOf(['create', 'update', 'delete'])
          .toArray();
        
        for (const item of pendingItems) {
          try {
            await syncService.syncOperation(item);
            await db.syncQueue.delete(item.id!);
          } catch (error) {
            // Increment retry count
            await db.syncQueue.update(item.id!, {
              retryCount: item.retryCount + 1,
            });
            
            // If retries exceeded, mark for manual resolution
            if (item.retryCount >= 3) {
              console.error('Sync failed after 3 retries:', item);
            }
          }
        }
        
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        console.error('Sync error:', error);
      }
    };
    
    // Sync immediately when online
    syncPendingChanges();
    
    // Then sync every 10 minutes
    const interval = setInterval(syncPendingChanges, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isOnline, setSyncStatus]);
}
```

**Service Worker for Offline Caching**
```typescript
// src/workers/sw.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);

// Cache API responses with stale-while-revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 60, // 30 minutes
      }),
    ],
  })
);

// Cache images with cache-first
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Background sync for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncQueue());
  }
});

async function syncQueue() {
  // Sync pending operations from IndexedDB
  const db = await openDB();
  const pending = await db.getAllFromIndex('syncQueue', 'createdAt');
  
  for (const item of pending) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      await db.delete('syncQueue', item.id);
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
}
```

### 5.4 Key UI Components

**Demo Mode Component**
```typescript
// src/features/onboarding/components/DemoMode.tsx
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ChevronRight, Sparkles } from 'lucide-react';

const DEMO_ITEMS = [
  {
    name: 'Organic Whole Milk',
    runOutDate: '3 days',
    confidence: 'High',
    icon: '🥛',
  },
  {
    name: 'Free-Range Eggs (Dozen)',
    runOutDate: '5 days',
    confidence: 'High',
    icon: '🥚',
  },
  {
    name: 'Sourdough Bread',
    runOutDate: '2 days',
    confidence: 'Medium',
    icon: '🍞',
  },
  // ... more items
];

export function DemoMode({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">
          Never run out of essentials again
        </h1>
      </div>
      
      <p className="text-gray-600 mb-6">
        Kirana predicts when you'll run out of items and alerts you at the best time to restock.
      </p>
      
      <div className="space-y-3 mb-8">
        {DEMO_ITEMS.map((item, i) => (
          <Card key={i} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{item.icon}</span>
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">
                  Next restock in <strong>{item.runOutDate}</strong>
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs px-2 py-1 rounded-full ${
                item.confidence === 'High' 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {item.confidence} confidence
              </span>
            </div>
          </Card>
        ))}
      </div>
      
      <Button 
        onClick={onContinue} 
        className="w-full"
        size="lg"
      >
        Upload your Amazon order history to get started
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
      
      <p className="text-xs text-center text-gray-500 mt-4">
        Or skip and add items manually
      </p>
    </div>
  );
}
```

**Micro-Review Component**
```typescript
// src/features/parsing/components/MicroReview.tsx
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Check, X, Edit2 } from 'lucide-react';

interface MicroReviewProps {
  item: {
    rawText: string;
    canonicalName: string;
    quantity: number;
    unitOfMeasure: string;
    price: number;
    confidence: number;
  };
  onAccept: () => void;
  onReject: () => void;
  onEdit: (edited: any) => void;
  variant: '2-tap' | '3-tap';
}

export function MicroReview({ item, onAccept, onReject, onEdit, variant }: MicroReviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);
  
  if (isEditing) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-slide-up">
        <h3 className="font-semibold mb-3">Edit Item</h3>
        <div className="space-y-2">
          <Input
            value={editedItem.canonicalName}
            onChange={(e) => setEditedItem({ ...editedItem, canonicalName: e.target.value })}
            placeholder="Item name"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              value={editedItem.quantity}
              onChange={(e) => setEditedItem({ ...editedItem, quantity: parseFloat(e.target.value) })}
              className="w-24"
            />
            <Input
              value={editedItem.unitOfMeasure}
              onChange={(e) => setEditedItem({ ...editedItem, unitOfMeasure: e.target.value })}
              className="w-24"
            />
            <Input
              type="number"
              value={editedItem.price}
              onChange={(e) => setEditedItem({ ...editedItem, price: parseFloat(e.target.value) })}
              className="flex-1"
              placeholder="Price"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button 
            onClick={() => { onEdit(editedItem); setIsEditing(false); }}
            className="flex-1"
          >
            Save
          </Button>
          <Button 
            onClick={() => setIsEditing(false)}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-slide-up">
      <div className="mb-3">
        <p className="text-sm text-gray-500">Confirm item:</p>
        <p className="font-semibold text-lg">{item.canonicalName}</p>
        <p className="text-sm text-gray-600">
          {item.quantity} {item.unitOfMeasure} • ${item.price.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          From: "{item.rawText}"
        </p>
      </div>
      
      {variant === '2-tap' ? (
        <div className="flex gap-2">
          <Button 
            onClick={onAccept} 
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept
          </Button>
          <Button 
            onClick={onReject}
            variant="outline"
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={() => setIsEditing(true)}
            variant="ghost"
            size="icon"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button 
            onClick={onAccept} 
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept
          </Button>
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            className="flex-1"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button 
            onClick={onReject}
            variant="outline"
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Backend Services

### 6.1 Azure Functions Architecture

**Function App Configuration**
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
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "functionTimeout": "00:10:00",
  "healthMonitor": {
    "enabled": true,
    "healthCheckInterval": "00:00:10",
    "healthCheckThreshold": 6,
    "counterThreshold": 0.80
  }
}
```

**Shared Dependencies**
```json
{
  "name": "kirana-functions",
  "version": "1.0.0",
  "dependencies": {
    "@azure/cosmos": "^4.0.0",
    "@azure/storage-blob": "^12.17.0",
    "@azure/identity": "^4.0.0",
    "@azure/communication-email": "^1.0.0",
    "@google/generative-ai": "^0.1.0",
    "csv-parse": "^5.5.0",
    "zod": "^3.22.0",
    "date-fns": "^2.30.0"
  }
}
```

### 6.2 Items Function Implementation

**Function Definition**
```typescript
// functions/items/index.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';
import { z } from 'zod';

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
const database = cosmosClient.database('kirana');
const container = database.container('items');

const CreateItemSchema = z.object({
  canonicalName: z.string().min(1).max(200),
  brand: z.string().optional(),
  category: z.string(),
  unitOfMeasure: z.enum(['oz', 'lb', 'g', 'kg', 'fl_oz', 'gal', 'qt', 'pt', 'ml', 'l', 'count', 'pack', 'each']),
  unitSize: z.number().positive(),
  preferredVendor: z.string().optional(),
  teachModeData: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
    customDays: z.number().positive().optional(),
  }).optional(),
});

export async function createItem(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Extract user and household from JWT
    const { userId, householdId } = await validateToken(request);
    
    // Parse and validate request body
    const body = await request.json();
    const validated = CreateItemSchema.parse(body);
    
    // Create item entity
    const item = {
      id: generateId(),
      householdId,
      type: 'item',
      ...validated,
      avgFrequencyDays: validated.teachModeData?.customDays || null,
      avgPurchaseQuantity: null,
      lastPurchaseQuantity: null,
      lastPurchaseDate: null,
      predictedRunOutDate: calculateTeachModePrediction(validated.teachModeData),
      predictionConfidence: 'low',
      predictionMetadata: {},
      priceHistory: [],
      userOverrides: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    
    // Insert into Cosmos DB
    const { resource } = await container.items.create(item);
    
    // Log analytics event
    await logEvent({
      eventType: 'item_created',
      userId,
      householdId,
      itemId: item.id,
      metadata: { source: 'manual_entry' },
    });
    
    return {
      status: 201,
      jsonBody: {
        success: true,
        data: resource,
        meta: {
          requestId: context.invocationId,
          timestamp: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    context.error('Error creating item:', error);
    
    if (error instanceof z.ZodError) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
        },
      };
    }
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create item',
          requestId: context.invocationId,
        },
      },
    };
  }
}

function calculateTeachModePrediction(teachModeData?: any): string | null {
  if (!teachModeData?.enabled) return null;
  
  const now = new Date();
  const frequencyDays = teachModeData.customDays || 
    (teachModeData.frequency === 'daily' ? 1 :
     teachModeData.frequency === 'weekly' ? 7 :
     teachModeData.frequency === 'biweekly' ? 14 :
     teachModeData.frequency === 'monthly' ? 30 : 7);
  
  const runOutDate = new Date(now.getTime() + frequencyDays * 24 * 60 * 60 * 1000);
  return runOutDate.toISOString();
}

// Register HTTP trigger
app.http('createItem', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'items',
  handler: createItem,
});

app.http('getItems', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'households/{householdId}/items',
  handler: async (request, context) => {
    const { householdId } = request.params;
    const { filter, sortBy, vendor, category } = request.query;
    
    // Build query
    let query = `SELECT * FROM c WHERE c.householdId = @householdId AND c.type = 'item'`;
    const parameters = [{ name: '@householdId', value: householdId }];
    
    if (filter === 'active') {
      query += ' AND c.deletedAt = null';
    } else if (filter === 'deleted') {
      query += ' AND c.deletedAt != null';
    }
    
    if (vendor) {
      query += ' AND c.preferredVendor = @vendor';
      parameters.push({ name: '@vendor', value: vendor });
    }
    
    if (category) {
      query += ' AND c.category = @category';
      parameters.push({ name: '@category', value: category });
    }
    
    // Sort
    if (sortBy === 'runOutDate') {
      query += ' ORDER BY c.predictedRunOutDate ASC';
    } else if (sortBy === 'name') {
      query += ' ORDER BY c.canonicalName ASC';
    } else if (sortBy === 'lastPurchase') {
      query += ' ORDER BY c.lastPurchaseDate DESC';
    }
    
    const { resources } = await container.items
      .query({ query, parameters })
      .fetchAll();
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: resources,
        meta: {
          total: resources.length,
          requestId: context.invocationId,
        },
      },
    };
  },
});
```

### 6.3 Predictions Function Implementation

**Exponential Smoothing Algorithm**
```typescript
// functions/predictions/exponentialSmoothing.ts
interface Transaction {
  purchaseDate: string;
  quantity: number;
}

interface PredictionResult {
  predictedRunOutDate: string | null;
  confidence: 'low' | 'medium' | 'high';
  metadata: {
    purchaseCount: number;
    avgFrequencyDays: number;
    avgPurchaseQuantity: number;
    stdDevDays: number;
    lastCalculated: string;
    factors: string[];
  };
}

const ALPHA = 0.3; // Smoothing factor (stability over responsiveness)

export function calculatePrediction(
  transactions: Transaction[],
  teachModeFrequency?: number
): PredictionResult {
  // Sort transactions by date
  const sorted = transactions
    .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
  
  const purchaseCount = sorted.length;
  
  // Cold start: use teach mode if available
  if (purchaseCount === 0) {
    if (teachModeFrequency) {
      const now = new Date();
      const runOut = new Date(now.getTime() + teachModeFrequency * 24 * 60 * 60 * 1000);
      
      return {
        predictedRunOutDate: runOut.toISOString(),
        confidence: 'low',
        metadata: {
          purchaseCount: 0,
          avgFrequencyDays: teachModeFrequency,
          avgPurchaseQuantity: 0,
          stdDevDays: 0,
          lastCalculated: new Date().toISOString(),
          factors: ['Prediction based on your expected frequency (Teach Mode)'],
        },
      };
    }
    
    return {
      predictedRunOutDate: null,
      confidence: 'low',
      metadata: {
        purchaseCount: 0,
        avgFrequencyDays: 0,
        avgPurchaseQuantity: 0,
        stdDevDays: 0,
        lastCalculated: new Date().toISOString(),
        factors: ['No purchase history yet'],
      },
    };
  }
  
  // Calculate days between purchases
  const daysBetween: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (new Date(sorted[i].purchaseDate).getTime() - 
                  new Date(sorted[i - 1].purchaseDate).getTime()) / 
                 (24 * 60 * 60 * 1000);
    daysBetween.push(days);
  }
  
  // OUTLIER DETECTION: Filter promotional spikes using z-score
  // Remove intervals >2 standard deviations from mean (likely 2-for-1 deals, bulk purchases)
  const meanDaysRaw = daysBetween.reduce((sum, d) => sum + d, 0) / daysBetween.length;
  const stdDevRaw = Math.sqrt(
    daysBetween.reduce((sum, d) => sum + Math.pow(d - meanDaysRaw, 2), 0) / daysBetween.length
  );
  
  const filteredDaysBetween = daysBetween.filter(days => {
    const zScore = Math.abs((days - meanDaysRaw) / (stdDevRaw || 1));
    return zScore <= 2.0; // Keep values within 2 standard deviations
  });
  
  // Use filtered data if we have enough data points, otherwise use all
  const daysForSmoothing = filteredDaysBetween.length >= 3 ? filteredDaysBetween : daysBetween;
  
  // Exponential smoothing for frequency (with outliers removed)
  let smoothedDays = daysForSmoothing[0];
  for (let i = 1; i < daysForSmoothing.length; i++) {
    smoothedDays = ALPHA * daysForSmoothing[i] + (1 - ALPHA) * smoothedDays;
  }
  
  // OUTLIER DETECTION: Filter promotional quantities
  const quantities = sorted.map(t => t.quantity);
  const meanQty = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  const stdDevQty = Math.sqrt(
    quantities.reduce((sum, q) => sum + Math.pow(q - meanQty, 2), 0) / quantities.length
  );
  
  const filteredQuantities = quantities.filter(qty => {
    const zScore = Math.abs((qty - meanQty) / (stdDevQty || 1));
    return zScore <= 2.0; // Remove extreme bulk purchases
  });
  
  const qtyForSmoothing = filteredQuantities.length >= 3 ? filteredQuantities : quantities;
  
  // Exponential smoothing for quantity (with outliers removed)
  let smoothedQuantity = qtyForSmoothing[0];
  for (let i = 1; i < qtyForSmoothing.length; i++) {
    smoothedQuantity = ALPHA * qtyForSmoothing[i] + (1 - ALPHA) * smoothedQuantity;
  }
  
  // Calculate standard deviation of days between purchases
  const meanDays = daysBetween.reduce((sum, d) => sum + d, 0) / daysBetween.length;
  const variance = daysBetween.reduce((sum, d) => sum + Math.pow(d - meanDays, 2), 0) / daysBetween.length;
  const stdDev = Math.sqrt(variance);
  
  // Quantity-aware prediction
  const lastPurchase = sorted[sorted.length - 1];
  const lastPurchaseDate = new Date(lastPurchase.purchaseDate);
  const lastQuantity = lastPurchase.quantity;
  
  const adjustedDays = smoothedDays * (lastQuantity / smoothedQuantity);
  const runOutDate = new Date(lastPurchaseDate.getTime() + adjustedDays * 24 * 60 * 60 * 1000);
  
  // Confidence calculation (RELAXED for Phase 1-2 cold start optimization)
  // NOTE: PRD strategy is to optimize for user activation, not accuracy
  // Phase 3+ can tighten to ≥5 after trust validation
  const daysSinceLastPurchase = (Date.now() - lastPurchaseDate.getTime()) / (24 * 60 * 60 * 1000);
  const isRecent = daysSinceLastPurchase < 30;
  const isConsistent = stdDev < 0.2 * meanDays; // <20% variance
  
  const outliersRemoved = daysBetween.length !== daysForSmoothing.length || 
                         quantities.length !== qtyForSmoothing.length;
  
  let confidence: 'low' | 'medium' | 'high';
  const factors: string[] = [];
  
  // HIGH CONFIDENCE: ≥3 purchases (PRD: "relaxed from ≥5 for cold start")
  // Z-score outlier detection (above) already mitigates worst inaccuracy risks
  if (purchaseCount >= 3 && isConsistent && isRecent) {
    confidence = 'high';
    factors.push(`${purchaseCount} purchases with consistent pattern (±${stdDev.toFixed(1)} days)`);
    factors.push('Recent purchase (< 30 days)');
    if (outliersRemoved) {
      factors.push('Promotional spikes detected and filtered');
    }
  } 
  // MEDIUM CONFIDENCE: 2 purchases with some consistency OR recent
  else if (purchaseCount >= 2 && (isConsistent || isRecent)) {
    confidence = 'medium';
    factors.push(`${purchaseCount} purchases`);
    if (isConsistent) factors.push('Consistent purchase pattern');
    if (isRecent) factors.push('Recent purchase');
    if (purchaseCount < 3) {
      factors.push('⚠️ More data will improve accuracy');
    }
  } 
  // LOW CONFIDENCE: 1 purchase or irregular pattern
  else {
    confidence = 'low';
    if (purchaseCount === 1) {
      factors.push('Only 1 purchase - need more history');
    } else {
      factors.push('Limited purchase history');
    }
    if (!isConsistent) factors.push('Irregular purchase pattern');
    if (!isRecent) factors.push('No recent purchases (> 30 days)');
    factors.push('💡 Use Teach Mode to set expected frequency');
  }
  
  return {
    predictedRunOutDate: runOutDate.toISOString(),
    confidence,
    metadata: {
      purchaseCount,
      avgFrequencyDays: smoothedDays,
      avgPurchaseQuantity: smoothedQuantity,
      stdDevDays: stdDev,
      lastCalculated: new Date().toISOString(),
      factors,
    },
  };
}
```

**Batch Prediction Function**
```typescript
// functions/predictions/index.ts
import { app, Timer, InvocationContext } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';
import { calculatePrediction } from './exponentialSmoothing';

export async function batchPredictions(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('Starting batch prediction recalculation');
  
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
  const database = cosmosClient.database('kirana');
  const itemsContainer = database.container('items');
  const transactionsContainer = database.container('transactions');
  
  try {
    // Get all active items
    const { resources: items } = await itemsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.deletedAt = null',
        parameters: [{ name: '@type', value: 'item' }],
      })
      .fetchAll();
    
    context.log(`Processing ${items.length} items`);
    
    let updated = 0;
    let errors = 0;
    
    for (const item of items) {
      try {
        // Get transaction history for this item
        const { resources: transactions } = await transactionsContainer.items
          .query({
            query: 'SELECT * FROM c WHERE c.itemId = @itemId AND c.type = @type ORDER BY c.purchaseDate ASC',
            parameters: [
              { name: '@itemId', value: item.id },
              { name: '@type', value: 'transaction' },
            ],
          })
          .fetchAll();
        
        // Calculate prediction
        const prediction = calculatePrediction(
          transactions,
          item.teachModeData?.enabled ? item.avgFrequencyDays : undefined
        );
        
        // Update item
        await itemsContainer.item(item.id, item.householdId).replace({
          ...item,
          predictedRunOutDate: prediction.predictedRunOutDate,
          predictionConfidence: prediction.confidence,
          predictionMetadata: prediction.metadata,
          avgFrequencyDays: prediction.metadata.avgFrequencyDays,
          avgPurchaseQuantity: prediction.metadata.avgPurchaseQuantity,
          updatedAt: new Date().toISOString(),
        });
        
        updated++;
      } catch (error) {
        context.error(`Error processing item ${item.id}:`, error);
        errors++;
      }
    }
    
    context.log(`Batch prediction complete: ${updated} updated, ${errors} errors`);
  } catch (error) {
    context.error('Batch prediction failed:', error);
    throw error;
  }
}

// Register timer trigger (daily at 2 AM)
app.timer('batchPredictions', {
  schedule: '0 0 2 * * *',
  handler: batchPredictions,
});
```

---

## 7. Intelligence Layer (LLM Integration)

### 7.1 Gemini API Integration

**Configuration & Cost Management**
```typescript
// functions/shared/geminiClient.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CosmosClient } from '@azure/cosmos';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

interface LLMUsageMetrics {
  userId: string;
  householdId: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

export class GeminiClient {
  private cosmosClient: CosmosClient;
  private costContainer: any; // Cosmos container for persistent cost tracking
  
  constructor() {
    this.cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
    this.costContainer = this.cosmosClient.database('kirana').container('costTracking');
  }
  
  /**
   * Pre-flight token estimation to prevent overspending before API call
   */
  private estimateTokens(prompt: string, expectedOutputTokens: number = 200): number {
    const inputTokens = Math.ceil(prompt.length / 4); // 1 token ≈ 4 chars
    return inputTokens + expectedOutputTokens;
  }
  
  private calculateCost(inputTokens: number, outputTokens: number, isVision: boolean = false): number {
    if (isVision) {
      // Gemini Vision pricing: $0.25/1K images (we'll track as tokens equivalent)
      return 0.25 / 1000;
    }
    // Gemini 2.0 Flash text pricing: $0.075/1M input, $0.30/1M output
    return (inputTokens * 0.075 / 1_000_000) + (outputTokens * 0.30 / 1_000_000);
  }
  
  /**
   * Circuit breaker: Check budget BEFORE making API call
   * Uses Cosmos DB for persistence across cold starts and multi-instance scaling
   */
  async checkBudget(
    userId: string, 
    householdId: string,
    estimatedTokens: number
  ): Promise<{ allowed: boolean; reason?: string; currentSpend?: number }> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayKey = now.toISOString().split('T')[0];
    
    // Get user's monthly spend from Cosmos
    const userCostId = `user-${userId}-${monthKey}`;
    let userCost = 0;
    try {
      const { resource } = await this.costContainer.item(userCostId, householdId).read();
      userCost = resource?.totalCost || 0;
    } catch (err) {
      // Item doesn't exist yet, cost is 0
    }
    
    // Phase 1-2: $0.20/user/month hard cap
    // Phase 3+: $0.30/user/month soft cap with alerting
    const MONTHLY_LIMIT = parseFloat(process.env.LLM_USER_MONTHLY_CAP || '0.20');
    const estimatedCost = this.calculateCost(estimatedTokens, 0);
    
    if (userCost + estimatedCost >= MONTHLY_LIMIT) {
      return {
        allowed: false,
        reason: 'Monthly AI budget reached. New receipts will be queued for overnight processing.',
        currentSpend: userCost,
      };
    }
    
    // Check daily system-wide budget
    const dailyTotal = await this.getDailyTotalCost(dayKey);
    const DAILY_LIMIT = parseFloat(process.env.LLM_DAILY_CAP || '50'); // $50/day operational budget
    
    if (dailyTotal + estimatedCost >= DAILY_LIMIT) {
      return {
        allowed: false,
        reason: 'System at capacity. Your receipt will be processed within 24 hours.',
        currentSpend: userCost,
      };
    }
    
    return { allowed: true, currentSpend: userCost };
  }
  
  /**
   * Record actual cost to Cosmos DB after API call
   */
  async recordCost(
    userId: string,
    householdId: string,
    operation: string,
    inputTokens: number,
    outputTokens: number,
    isVision: boolean = false
  ): Promise<void> {
    const cost = this.calculateCost(inputTokens, outputTokens, isVision);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const userCostId = `user-${userId}-${monthKey}`;
    
    try {
      // Upsert user monthly cost
      const { resource: existing } = await this.costContainer.item(userCostId, householdId).read();
      await this.costContainer.items.upsert({
        id: userCostId,
        householdId,
        userId,
        month: monthKey,
        totalCost: (existing?.totalCost || 0) + cost,
        operations: [
          ...(existing?.operations || []),
          {
            operation,
            inputTokens,
            outputTokens,
            cost,
            timestamp: now.toISOString(),
          }
        ],
        updatedAt: now.toISOString(),
      });
      
      // Also record to daily aggregate for system-wide throttling
      const dayKey = now.toISOString().split('T')[0];
      const dailyCostId = `daily-${dayKey}`;
      const { resource: dailyExisting } = await this.costContainer.item(dailyCostId, 'global').read().catch(() => ({ resource: null }));
      await this.costContainer.items.upsert({
        id: dailyCostId,
        householdId: 'global', // System-wide partition
        date: dayKey,
        totalCost: (dailyExisting?.totalCost || 0) + cost,
        updatedAt: now.toISOString(),
      });
    } catch (err) {
      console.error('Failed to record LLM cost:', err);
      // Non-blocking: don't fail user request if cost tracking fails
    }
  }
  
  async getDailyTotalCost(dayKey: string): Promise<number> {
    try {
      const dailyCostId = `daily-${dayKey}`;
      const { resource } = await this.costContainer.item(dailyCostId, 'global').read();
      return resource?.totalCost || 0;
    } catch {
      return 0;
    }
  }
  
  async normalizeItem(
    rawText: string, 
    userId: string,
    householdId: string,
    context?: { retailer?: string }
  ): Promise<{
    canonicalName: string;
    brand: string | null;
    category: string;
    unitOfMeasure: string;
    unitSize: number;
    confidence: number;
    cost: number;
  }> {
    // Check cache first (top 1000 most common items)
    const cached = await this.getCachedNormalization(rawText);
    if (cached) {
      cached.cost = 0; // Cache hit = no cost
      return cached;
    }
    
    // Build prompt for LLM normalization
    const prompt = `
You are a grocery item normalization expert. Given a raw receipt line item, extract structured data.

Raw text: "${rawText}"
Retailer: ${context?.retailer || 'Unknown'}

Return JSON with:
{
  "canonicalName": "Descriptive item name (e.g., 'Organic Whole Milk')",
  "brand": "Brand name or null if generic",
  "category": "One of: Dairy, Meat, Produce, Bakery, Pantry, Beverages, Snacks, Frozen, Household, Personal Care, Other",
  "unitOfMeasure": "oz|lb|g|kg|fl_oz|gal|qt|pt|ml|l|count|pack|each",
  "unitSize": "Numeric size (e.g., 1 for '1 gallon', 12 for '12 oz')",
  "confidence": "0.0-1.0 score based on text clarity"
}

Rules:
- Normalize abbreviations: "org" → "organic", "whl" → "whole", "mlk" → "milk"
- Extract quantity from "2x" or "(2-pack)" → unitSize
- Distinguish oz (weight) from fl oz (volume)
- If unit is unclear, use "each" and unitSize 1
- Be conservative with confidence scores
`;
    
    // PRE-FLIGHT BUDGET CHECK (circuit breaker)
    const estimatedTokens = this.estimateTokens(prompt, 200);
    const budgetCheck = await this.checkBudget(userId, householdId, estimatedTokens);
    
    if (!budgetCheck.allowed) {
      throw new Error(`LLM_BUDGET_EXCEEDED: ${budgetCheck.reason}`);
    }
    
    // Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response with validation
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    
    // Calculate actual cost
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);
    const cost = this.calculateCost(inputTokens, outputTokens, false);
    
    // Record cost to Cosmos DB
    await this.recordCost(userId, householdId, 'normalizeItem', inputTokens, outputTokens, false);
    
    // Cache result if confidence >= 0.8
    if (parsed.confidence >= 0.8) {
      await this.cacheNormalization(rawText, parsed);
    }
    
    return { ...parsed, cost };
  }
  
  async parseReceiptPhoto(blobUri: string, retailerHint?: string): Promise<{
    retailer: string;
    date: string;
    items: Array<{
      rawText: string;
      quantity: number;
      price: number;
      canonicalName?: string;
      confidence: number;
    }>;
    totalAmount: number;
    cost: number;
  }> {
    // Fetch image from blob storage
    const imageBuffer = await this.fetchBlob(blobUri);
    const base64Image = imageBuffer.toString('base64');
    
    const prompt = `
You are a receipt OCR expert. Extract structured data from this receipt image.

Retailer hint: ${retailerHint || 'Unknown'}

Return JSON with:
{
  "retailer": "Store name (e.g., 'Whole Foods', 'Costco')",
  "date": "YYYY-MM-DD",
  "totalAmount": 123.45,
  "items": [
    {
      "rawText": "Exact text from receipt",
      "quantity": 2.0,
      "price": 7.98,
      "confidence": 0.95
    }
  ]
}

Rules:
- Extract EVERY line item, including quantity multipliers
- "2x Milk $3.99" → quantity: 2, price: 7.98
- Skip non-product lines (tax, subtotal, payment method)
- Confidence reflects OCR quality (blurry text = lower confidence)
`;
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      { text: prompt },
    ]);
    
    const response = await result.response;
    const text = response.text();
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    
    // Calculate cost (Vision API: $0.25/1K images)
    const cost = 0.00025; // $0.25 per 1000 images
    
    return { ...parsed, cost };
  }
  
  private async getCachedNormalization(rawText: string): Promise<any | null> {
    const database = this.cosmosClient.database('kirana');
    const cacheContainer = database.container('cache');
    
    const cacheKey = rawText.toLowerCase().trim();
    
    try {
      const { resource } = await cacheContainer.item(cacheKey, 'global').read();
      
      // Update hit count
      await cacheContainer.item(cacheKey, 'global').patch([
        { op: 'incr', path: '/hitCount', value: 1 },
        { op: 'set', path: '/lastUsed', value: new Date().toISOString() },
      ]);
      
      return resource;
    } catch (error) {
      return null; // Cache miss
    }
  }
  
  private async cacheNormalization(rawText: string, data: any): Promise<void> {
    const database = this.cosmosClient.database('kirana');
    const cacheContainer = database.container('cache');
    
    const cacheKey = rawText.toLowerCase().trim();
    
    await cacheContainer.items.upsert({
      id: cacheKey,
      householdId: 'global',
      type: 'normalization_cache',
      rawText,
      ...data,
      hitCount: 1,
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      ttl: 7776000, // 90 days
    });
  }
  
  private async getDailyTotalCost(): Promise<number> {
    const database = this.cosmosClient.database('kirana');
    const eventsContainer = database.container('events');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { resources } = await eventsContainer.items
      .query({
        query: 'SELECT VALUE SUM(c.metadata.llmCost) FROM c WHERE c.eventType = @eventType AND c.timestamp >= @today',
        parameters: [
          { name: '@eventType', value: 'llm_call' },
          { name: '@today', value: today.toISOString() },
        ],
      })
      .fetchAll();
    
    return resources[0] || 0;
  }
  
  private async fetchBlob(blobUri: string): Promise<Buffer> {
    // Implementation to fetch from Azure Blob Storage
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    );
    
    const url = new URL(blobUri);
    const containerName = url.pathname.split('/')[1];
    const blobName = url.pathname.split('/').slice(2).join('/');
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    const downloadResponse = await blobClient.download();
    const chunks: Buffer[] = [];
    
    for await (const chunk of downloadResponse.readableStreamBody!) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }
}
```

### 7.2 Hybrid Parsing Strategy

**Deterministic Regex Parsers for Structured Retailers**
```typescript
// functions/parsing/retailers/amazonParser.ts
export class AmazonCSVParser {
  static parse(csvContent: string): Array<{
    itemName: string;
    quantity: number;
    price: number;
    date: string;
    confidence: number;
  }> {
    const lines = csvContent.split('\n').slice(1); // Skip header
    const items: any[] = [];
    
    for (const line of lines) {
      const columns = line.split(',');
      
      // Amazon CSV format:
      // Order Date, Product Name, Quantity, Price, Order ID, ...
      const date = columns[0].trim();
      const rawName = columns[1].trim().replace(/"/g, '');
      const quantity = parseFloat(columns[2]);
      const price = parseFloat(columns[3].replace('$', ''));
      
      // Deterministic parsing for common patterns
      const normalized = this.normalizeAmazonItem(rawName);
      
      items.push({
        ...normalized,
        quantity,
        price,
        date,
        confidence: normalized.confidence,
      });
    }
    
    return items;
  }
  
  private static normalizeAmazonItem(rawName: string): {
    itemName: string;
    brand: string | null;
    unitOfMeasure: string;
    unitSize: number;
    confidence: number;
  } {
    // Extract brand from common patterns
    let brand: string | null = null;
    let name = rawName;
    
    // "365 by Whole Foods Market, Organic Whole Milk, 1 Gallon"
    const brandMatch = rawName.match(/^([^,]+),\s*(.+)/);
    if (brandMatch) {
      brand = brandMatch[1].trim();
      name = brandMatch[2].trim();
    }
    
    // Extract unit
    const unitPatterns = [
      /(\d+(?:\.\d+)?)\s*(oz|ounce|ounces)/i,
      /(\d+(?:\.\d+)?)\s*(lb|pound|pounds)/i,
      /(\d+(?:\.\d+)?)\s*(gal|gallon|gallons)/i,
      /(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounce)/i,
      /(\d+)\s*-?\s*(count|pack|ct)/i,
    ];
    
    let unitOfMeasure = 'each';
    let unitSize = 1;
    let confidence = 0.9; // High confidence for deterministic parsing
    
    for (const pattern of unitPatterns) {
      const match = name.match(pattern);
      if (match) {
        unitSize = parseFloat(match[1]);
        unitOfMeasure = match[2].toLowerCase().replace(/\s/g, '');
        
        // Normalize units
        if (['ounce', 'ounces'].includes(unitOfMeasure)) unitOfMeasure = 'oz';
        if (['pound', 'pounds'].includes(unitOfMeasure)) unitOfMeasure = 'lb';
        if (['gallon', 'gallons'].includes(unitOfMeasure)) unitOfMeasure = 'gal';
        if (['count', 'ct'].includes(unitOfMeasure)) unitOfMeasure = 'count';
        
        break;
      }
    }
    
    // Clean up item name (remove size info)
    let itemName = name.replace(/,?\s*\d+(?:\.\d+)?\s*(oz|lb|gal|fl oz|count|pack|ct)\s*$/i, '').trim();
    
    return {
      itemName,
      brand,
      unitOfMeasure,
      unitSize,
      confidence,
    };
  }
}
```

**LLM Fallback for Unstructured Receipts**
```typescript
// functions/parsing/hybridParser.ts
import { AmazonCSVParser } from './retailers/amazonParser';
import { CostcoReceiptParser } from './retailers/costcoParser';
import { GeminiClient } from '../shared/geminiClient';

export class HybridParser {
  private geminiClient: GeminiClient;
  
  constructor() {
    this.geminiClient = new GeminiClient();
  }
  
  async parseCSV(csvContent: string, retailer: string, userId: string): Promise<{
    items: any[];
    llmCallsMade: number;
    totalCost: number;
  }> {
    // Try deterministic parser first
    if (retailer.toLowerCase() === 'amazon') {
      try {
        const items = AmazonCSVParser.parse(csvContent);
        return {
          items,
          llmCallsMade: 0,
          totalCost: 0,
        };
      } catch (error) {
        console.warn('Amazon parser failed, falling back to LLM:', error);
      }
    }
    
    // Fallback to LLM for unknown retailers
    const budget = await this.geminiClient.checkBudget(userId);
    if (!budget.allowed) {
      throw new Error(`LLM_BUDGET_EXCEEDED: ${budget.reason}`);
    }
    
    // Parse with Gemini
    const lines = csvContent.split('\n').slice(1);
    const items: any[] = [];
    let totalCost = 0;
    let llmCallsMade = 0;
    
    for (const line of lines) {
      const normalized = await this.geminiClient.normalizeItem(line, { retailer });
      items.push(normalized);
      totalCost += normalized.cost;
      llmCallsMade++;
    }
    
    return {
      items,
      llmCallsMade,
      totalCost,
    };
  }
  
  async parsePhotoReceipt(blobUri: string, retailerHint: string, userId: string): Promise<{
    receipt: any;
    llmCallsMade: number;
    totalCost: number;
  }> {
    // Check budget
    const budget = await this.geminiClient.checkBudget(userId);
    if (!budget.allowed) {
      // Queue for overnight processing
      throw new Error(`LLM_BUDGET_EXCEEDED: ${budget.reason}`);
    }
    
    // Parse with Gemini Vision
    const receipt = await this.geminiClient.parseReceiptPhoto(blobUri, retailerHint);
    
    return {
      receipt,
      llmCallsMade: 1,
      totalCost: receipt.cost,
    };
  }
}
```

### 7.3 Cost Monitoring & Degradation

**Real-Time Cost Tracking**
```typescript
// functions/shared/costMonitor.ts
import { CosmosClient } from '@azure/cosmos';
import { ApplicationInsightsClient } from '@azure/monitor-opentelemetry-exporter';

export class CostMonitor {
  private static instance: CostMonitor;
  private cosmosClient: CosmosClient;
  
  private constructor() {
    this.cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
  }
  
  static getInstance(): CostMonitor {
    if (!CostMonitor.instance) {
      CostMonitor.instance = new CostMonitor();
    }
    return CostMonitor.instance;
  }
  
  async logLLMUsage(data: {
    userId: string;
    householdId: string;
    operation: 'normalize' | 'ocr' | 'parse';
    cost: number;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    const database = this.cosmosClient.database('kirana');
    const eventsContainer = database.container('events');
    
    await eventsContainer.items.create({
      id: `llm-${Date.now()}-${Math.random()}`,
      householdId: data.householdId,
      type: 'event',
      eventType: 'llm_call',
      userId: data.userId,
      metadata: {
        operation: data.operation,
        llmCost: data.cost,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
      },
      timestamp: new Date().toISOString(),
      ttl: 7776000, // 90 days
    });
    
    // Send to Application Insights
    const metric = {
      name: 'llm_cost',
      value: data.cost,
      properties: {
        operation: data.operation,
        userId: data.userId,
      },
    };
    
    // Track custom metric for alerting
    console.log(`[LLM_COST] ${JSON.stringify(metric)}`);
  }
  
  async getDailyCost(): Promise<number> {
    const database = this.cosmosClient.database('kirana');
    const eventsContainer = database.container('events');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { resources } = await eventsContainer.items
      .query({
        query: 'SELECT VALUE SUM(c.metadata.llmCost) FROM c WHERE c.eventType = @eventType AND c.timestamp >= @today',
        parameters: [
          { name: '@eventType', value: 'llm_call' },
          { name: '@today', value: today.toISOString() },
        ],
      })
      .fetchAll();
    
    return resources[0] || 0;
  }
  
  async shouldDegradeService(): Promise<{ degrade: boolean; reason?: string }> {
    const dailyCost = await this.getDailyCost();
    const DAILY_LIMIT = 50; // $50/day
    const THRESHOLD = 0.7 * DAILY_LIMIT; // 70% = $35/day warning
    
    if (dailyCost >= DAILY_LIMIT) {
      return {
        degrade: true,
        reason: `Daily LLM budget exceeded ($${dailyCost.toFixed(2)} / $${DAILY_LIMIT})`,
      };
    }
    
    if (dailyCost >= THRESHOLD) {
      console.warn(`[WARNING] LLM cost approaching daily limit: $${dailyCost.toFixed(2)} / $${DAILY_LIMIT}`);
    }
    
    return { degrade: false };
  }
}
```

### 7.4 Queue-Based Degradation Strategy

**Cost-Effective Fallback for Budget Constraints (PRD Strategy)**

When LLM budget is exceeded OR parsing confidence is low, queue receipts for overnight batch processing instead of using expensive paid APIs. This preserves the $50/day hard cap while maintaining system availability for all users.

```typescript
// functions/parsing/queueManager.ts
import { CosmosClient } from '@azure/cosmos';

interface QueuedReceipt {
  id: string;
  userId: string;
  householdId: string;
  blobUri: string;
  retailerHint?: string;
  queuedAt: string;
  reason: 'budget_exceeded' | 'low_confidence' | 'api_failure';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedCompletion: string;
}

export class ParseQueueManager {
  private cosmosClient: CosmosClient;
  private parseJobsContainer: any;
  
  constructor() {
    this.cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
    this.parseJobsContainer = this.cosmosClient.database('kirana').container('parseJobs');
  }
  
  /**
   * Add receipt to overnight batch processing queue
   * Returns estimated completion time (next scheduled batch run)
   */
  async queueReceipt(
    userId: string,
    householdId: string,
    blobUri: string,
    reason: 'budget_exceeded' | 'low_confidence' | 'api_failure',
    retailerHint?: string
  ): Promise<{ queueId: string; estimatedCompletion: string }> {
    const now = new Date();
    const queuedReceipt: QueuedReceipt = {
      id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      householdId,
      blobUri,
      retailerHint,
      queuedAt: now.toISOString(),
      reason,
      status: 'queued',
      estimatedCompletion: this.getNextBatchTime(now),
    };
    
    await this.parseJobsContainer.items.create(queuedReceipt);
    
    return {
      queueId: queuedReceipt.id,
      estimatedCompletion: queuedReceipt.estimatedCompletion,
    };
  }
  
  /**
   * Calculate next batch processing time
   * Batch runs daily at 2 AM local time
   */
  private getNextBatchTime(now: Date): string {
    const nextBatch = new Date(now);
    nextBatch.setHours(2, 0, 0, 0); // 2 AM
    
    // If it's already past 2 AM today, schedule for tomorrow
    if (now.getHours() >= 2) {
      nextBatch.setDate(nextBatch.getDate() + 1);
    }
    
    return nextBatch.toISOString();
  }
  
  /**
   * Get user's queued receipts with status
   */
  async getUserQueue(userId: string): Promise<QueuedReceipt[]> {
    const { resources } = await this.parseJobsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.userId = @userId AND c.status IN ("queued", "processing") ORDER BY c.queuedAt DESC',
        parameters: [{ name: '@userId', value: userId }],
      })
      .fetchAll();
    
    return resources;
  }
}
```

**Hybrid Parser with Queue-Based Fallback**

```typescript
// functions/parsing/hybridParser.ts
import { GeminiClient } from '../shared/geminiClient';
import { ParseQueueManager } from './queueManager';
import { AmazonCSVParser } from './retailers/amazonParser';

export class HybridParser {
  private geminiClient: GeminiClient;
  private queueManager: ParseQueueManager;
  
  constructor() {
    this.geminiClient = new GeminiClient();
    this.queueManager = new ParseQueueManager();
  }
  
  async parsePhotoReceipt(
    blobUri: string, 
    userId: string, 
    householdId: string,
    retailerHint?: string
  ): Promise<{
    receipt?: any;
    queued?: { queueId: string; estimatedCompletion: string };
    parsingMethod: 'regex' | 'gemini' | 'queued';
    cost: number;
  }> {
    let parsingMethod: 'regex' | 'gemini' | 'queued' = 'gemini';
    let cost = 0;
    
    // Step 1: Try deterministic regex parser for known retailers
    if (retailerHint && ['amazon', 'costco', 'target'].includes(retailerHint.toLowerCase())) {
      try {
        const receipt = await this.tryDeterministicParser(blobUri, retailerHint);
        if (receipt.confidence >= 0.9) {
          return { receipt, parsingMethod: 'regex', cost: 0 };
        }
      } catch (err) {
        console.warn(`Deterministic parser failed for ${retailerHint}, falling back`, err);
      }
    }
    
    // Step 2: Check budget before calling Gemini
    const budgetCheck = await this.geminiClient.checkBudget(userId, householdId, 5000); // Estimate tokens
    if (!budgetCheck.allowed) {
      // QUEUE for overnight processing (PRD strategy)
      const queued = await this.queueManager.queueReceipt(
        userId,
        householdId,
        blobUri,
        'budget_exceeded',
        retailerHint
      );
      
      return {
        queued,
        parsingMethod: 'queued',
        cost: 0,
      };
    }
    
    // Step 3: Try Gemini Vision API
    try {
      const receipt = await this.geminiClient.parseReceiptPhoto(blobUri, userId, householdId, retailerHint);
      cost = receipt.cost;
      parsingMethod = 'gemini';
      
      // If Gemini confidence >= 0.6, accept result
      if (receipt.overallConfidence >= 0.6) {
        return { receipt, parsingMethod, cost };
      }
      
      // Low confidence → QUEUE for manual review or batch retry
      console.warn(`Gemini confidence low (${receipt.overallConfidence}), queueing for batch processing`);
      const queued = await this.queueManager.queueReceipt(
        userId,
        householdId,
        blobUri,
        'low_confidence',
        retailerHint
      );
      
      return {
        queued,
        parsingMethod: 'queued',
        cost,
      };
    } catch (err: any) {
      console.error('Gemini parsing failed:', err);
      
      // API failure → QUEUE for retry
      const queued = await this.queueManager.queueReceipt(
        userId,
        householdId,
        blobUri,
        'api_failure',
        retailerHint
      );
      
      return {
        queued,
        parsingMethod: 'queued',
        cost: 0,
      };
    }
  }
  
  private async tryDeterministicParser(blobUri: string, retailer: string): Promise<any> {
    // Placeholder: OCR + retailer-specific regex patterns
    throw new Error('Not implemented in Phase 1');
  }
}
```

**Routing Decision Tree (PRD-Aligned)**

```
Photo Receipt Upload
         │
         ├─→ Known Retailer (Amazon/Costco/Target)?
         │   └─→ YES → Try Deterministic Regex Parser
         │       ├─→ Confidence ≥ 0.9 → ✅ Accept (FREE)
         │       └─→ Confidence < 0.9 → Continue to Gemini
         │
         ├─→ Budget Check (user monthly < $0.20 AND daily < $50)?
         │   └─→ NO → 📥 Queue for overnight processing (FREE)
         │
         ├─→ Call Gemini Vision API
         │   ├─→ Confidence ≥ 0.6 → ✅ Accept (~$0.001-0.005/receipt)
         │   ├─→ Confidence < 0.6 → 📥 Queue for batch retry (FREE)
         │   └─→ API Failure → 📥 Queue for retry (FREE)
         │
         └─→ Manual Entry Always Available
```

**User Experience for Queued Receipts**

```typescript
// UI Component
<QueuedReceiptBanner>
  <AlertCircle className="w-5 h-5 text-blue-500" />
  <div>
    <h3 className="font-semibold">Receipt queued for processing</h3>
    <p className="text-sm text-gray-600">
      Your receipt will be processed overnight. Expected completion: {estimatedCompletion}
    </p>
    <p className="text-xs text-gray-500 mt-1">
      You'll receive a notification when it's ready. You can add items manually in the meantime.
    </p>
  </div>
</QueuedReceiptBanner>
```

**Batch Processing Job (Overnight)**

```typescript
// functions/parsing/batchProcessor.ts
import { app, Timer, InvocationContext } from '@azure/functions';

export async function processPendingReceipts(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('Starting overnight batch receipt processing at 2 AM');
  
  const queueManager = new ParseQueueManager();
  const hybridParser = new HybridParser();
  
  // Get all queued receipts
  const { resources: queuedReceipts } = await queueManager.parseJobsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.status = "queued" AND c.queuedAt < @cutoff',
      parameters: [
        { name: '@cutoff', value: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() } // 2+ hours old
      ],
    })
    .fetchAll();
  
  context.log(`Found ${queuedReceipts.length} queued receipts to process`);
  
  // Process with relaxed budget constraints (overnight batch has higher limit)
  for (const queued of queuedReceipts) {
    try {
      const result = await hybridParser.parsePhotoReceipt(
        queued.blobUri,
        queued.userId,
        queued.householdId,
        queued.retailerHint
      );
      
      if (result.receipt) {
        // Success - update status
        await queueManager.parseJobsContainer.item(queued.id, queued.householdId).patch({
          operations: [
            { op: 'replace', path: '/status', value: 'completed' },
            { op: 'add', path: '/completedAt', value: new Date().toISOString() },
            { op: 'add', path: '/result', value: result.receipt },
          ],
        });
        
        // Send push notification to user
        context.log(`Processed queued receipt ${queued.id} successfully`);
      }
    } catch (err) {
      context.error(`Failed to process queued receipt ${queued.id}:`, err);
      // Mark as failed, user will be prompted for manual entry
    }
  }
}

// Schedule daily at 2 AM
app.timer('batchReceiptProcessor', {
  schedule: '0 0 2 * * *', // 2 AM daily
  handler: processPendingReceipts,
});
```

**Cost Comparison: Queue vs Paid API**

| Scenario | Strategy | Cost/Receipt | System Impact | User Experience |
|----------|----------|--------------|---------------|-----------------|
| **Budget Exceeded** | Queue (PRD) ✅ | $0 | Preserves $50/day cap for all users | Delayed (<24h), clear expectation |
| **Low Confidence** | Queue (PRD) ✅ | $0 (retry in batch) | Free second attempt | Delayed but functional |
| **API Failure** | Queue (PRD) ✅ | $0 (retry in batch) | Resilient to transient failures | Delayed but no user impact |

**Phase 1 Budget Allocation (Revised):**
- Gemini budget: $0.20/user/month (all parsing)
- Queue processing: $0 (uses same Gemini budget during off-peak)
- **Total LLM+Parsing: $0.20/user/month**

### 7.5 Open-Source LLM Fallback Strategy (Phase 2A)

**Strategic Rationale**

While Gemini provides excellent cost/performance for Phase 1-2, we need a fallback to protect against:
1. Gemini API price increases
2. Sustained high LLM costs (>$0.30/user/month)
3. API reliability issues or service changes

**Trigger Conditions (from PRD):**

```
IF (LLM cost >$0.30/user for 2 consecutive months) 
   OR (Gemini API unavailable >4 hours)
   OR (Gemini pricing changes >50%)
THEN → Activate OSS LLM migration plan
```

**Phase 2A Implementation Plan (Week 9-10)**

**Scope:** Start with item normalization only (high-volume, low-complexity)
- OCR remains on Gemini Vision (cost-effective for images)
- Normalization switches to OSS for high-volume users

**Technology Stack:**
- **Model:** Llama 3.1 8B (quantized 4-bit) or Mistral 7B
- **Hosting:** Azure Container Instances (pay-per-use) or self-hosted VM
- **Framework:** vLLM or Ollama for efficient inference

**Cost Comparison (Normalization Only):**

| Solution | Cost/1M Tokens | Phase 3 Estimate (500 users, 5 receipts/month) | Notes |
|----------|----------------|------------------------------------------------|-------|
| **Gemini 2.0 Flash** | $0.075 input, $0.30 output | ~$100/month | Current solution |
| **Llama 3.1 8B (Azure Container)** | ~$0.02-0.05 (compute only) | ~$30-50/month | 60-70% savings |
| **Self-hosted (VM)** | Fixed: $50-80/month | $50-80/month | Cost-effective at scale |

**Week 9-10 Deliverables:**

```markdown
- [ ] Benchmark Llama 3.1 8B vs Mistral 7B on 1K SKU test harness
- [ ] Implement normalization adapter (drop-in replacement for GeminiClient)
- [ ] Test accuracy: Target ≥90% match with Gemini normalization
- [ ] Deploy to staging environment (Azure Container Instance)
- [ ] A/B test: 10% of traffic to OSS model, compare quality
- [ ] Document migration runbook (gradual rollout strategy)
```

**Migration Strategy (If Triggered):**

```typescript
// functions/shared/llmRouter.ts
export class LLMRouter {
  private geminiClient: GeminiClient;
  private ossClient: OSSLLMClient;
  
  async normalizeItem(rawText: string, userId: string): Promise<NormalizedItem> {
    const userCost = await this.getUserMonthlyCost(userId);
    
    // Route high-cost users to OSS model
    if (userCost > 0.25) { // 80% of $0.30 threshold
      return await this.ossClient.normalizeItem(rawText);
    }
    
    // Default to Gemini for low-cost users
    return await this.geminiClient.normalizeItem(rawText, userId, householdId);
  }
}
```

**Success Criteria for OSS Fallback:**

| Metric | Target | Notes |
|--------|--------|-------|
| **Normalization Accuracy** | ≥90% match with Gemini | Tested on 1K SKU harness |
| **Latency** | <2s p95 | Acceptable for queued processing |
| **Cost Savings** | ≥50% reduction | Must be materially cheaper |
| **Maintenance Overhead** | <4 hours/week | Model updates, monitoring |

**Risks & Mitigations:**

| Risk | Mitigation |
|------|-----------|
| OSS model quality degrades over time | Monthly accuracy audits; retain Gemini for validation |
| Self-hosting increases ops burden | Start with Azure Container Instances (managed) |
| Model drift from Gemini baseline | Continuous A/B testing; rollback if accuracy <85% |

**Decision Point (Phase 2A Week 12):**

- ✅ **Deploy OSS fallback** IF accuracy ≥90% AND cost savings ≥50%
- ❌ **Defer to Phase 3** IF accuracy <85% OR maintenance overhead >4h/week
- 🔄 **Hybrid approach** IF accuracy 85-90%: Route only high-volume users to OSS

---

## 8. Authentication & Authorization

### 8.1 Microsoft Entra ID Integration

**Configuration**
```typescript
// functions/shared/auth.ts
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.ENTRA_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}`,
    clientSecret: process.env.ENTRA_CLIENT_SECRET!,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

export async function validateToken(request: HttpRequest): Promise<{
  userId: string;
  email: string;
  householdId: string;
  roles: string[];
}> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Validate JWT with Entra ID
    const decoded = await msalClient.acquireTokenOnBehalfOf({
      oboAssertion: token,
      scopes: ['api://kirana-api/.default'],
    });
    
    const userId = decoded.account?.homeAccountId || '';
    const email = decoded.account?.username || '';
    
    // Get user's household from database
    const householdId = await getUserHousehold(userId);
    
    // Get roles from token claims
    const roles = decoded.idTokenClaims?.roles || ['member'];
    
    return {
      userId,
      email,
      householdId,
      roles,
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

async function getUserHousehold(userId: string): Promise<string> {
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
  const database = cosmosClient.database('kirana');
  const householdsContainer = database.container('households');
  
  // Find household where user is a member
  const { resources } = await householdsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.members, {"userId": @userId}, true)',
      parameters: [{ name: '@userId', value: userId }],
    })
    .fetchAll();
  
  if (resources.length === 0) {
    // Create new household for first-time user
    const newHousehold = {
      id: `household-${userId}`,
      householdId: `household-${userId}`,
      type: 'household',
      name: 'My Household',
      members: [
        {
          userId,
          email: '', // Will be filled by Entra ID
          role: 'admin',
          joinedAt: new Date().toISOString(),
        },
      ],
      settings: {
        syncInterval: 10,
        timezone: 'America/Los_Angeles',
        currency: 'USD',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await householdsContainer.items.create(newHousehold);
    return newHousehold.id;
  }
  
  return resources[0].id;
}

class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

**Frontend Auth Hook**
```typescript
// src/features/auth/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const initialize = async () => {
      await msalInstance.initialize();
      const accounts = msalInstance.getAllAccounts();
      
      if (accounts.length > 0) {
        setIsAuthenticated(true);
        setUser(accounts[0]);
      }
      
      setLoading(false);
    };
    
    initialize();
  }, []);
  
  const login = async () => {
    try {
      const response = await msalInstance.loginPopup({
        scopes: ['api://kirana-api/.default'],
      });
      
      setIsAuthenticated(true);
      setUser(response.account);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };
  
  const logout = async () => {
    await msalInstance.logoutPopup();
    setIsAuthenticated(false);
    setUser(null);
  };
  
  const getAccessToken = async (): Promise<string> => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    const response = await msalInstance.acquireTokenSilent({
      scopes: ['api://kirana-api/.default'],
      account: accounts[0],
    });
    
    return response.accessToken;
  };
  
  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    getAccessToken,
  };
}
```

### 8.2 Role-Based Access Control (RBAC)

**Roles Definition**
```typescript
// functions/shared/rbac.ts
export enum Role {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export const Permissions = {
  ITEMS: {
    CREATE: 'items:create',
    READ: 'items:read',
    UPDATE: 'items:update',
    DELETE: 'items:delete',
  },
  HOUSEHOLD: {
    INVITE: 'household:invite',
    REMOVE_MEMBER: 'household:remove_member',
    UPDATE_SETTINGS: 'household:update_settings',
  },
  TRANSACTIONS: {
    CREATE: 'transactions:create',
    READ: 'transactions:read',
  },
};

export const RolePermissions: Record<Role, string[]> = {
  [Role.ADMIN]: [
    Permissions.ITEMS.CREATE,
    Permissions.ITEMS.READ,
    Permissions.ITEMS.UPDATE,
    Permissions.ITEMS.DELETE,
    Permissions.HOUSEHOLD.INVITE,
    Permissions.HOUSEHOLD.REMOVE_MEMBER,
    Permissions.HOUSEHOLD.UPDATE_SETTINGS,
    Permissions.TRANSACTIONS.CREATE,
    Permissions.TRANSACTIONS.READ,
  ],
  [Role.MEMBER]: [
    Permissions.ITEMS.CREATE,
    Permissions.ITEMS.READ,
    Permissions.ITEMS.UPDATE,
    Permissions.TRANSACTIONS.CREATE,
    Permissions.TRANSACTIONS.READ,
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return RolePermissions[role].includes(permission);
}

export function requirePermission(permission: string) {
  return (req: HttpRequest, context: InvocationContext, next: () => Promise<HttpResponseInit>) => {
    const { roles } = req.user; // Attached by validateToken middleware
    
    const hasAccess = roles.some((role: Role) => hasPermission(role, permission));
    
    if (!hasAccess) {
      return {
        status: 403,
        jsonBody: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions. Required: ${permission}`,
          },
        },
      };
    }
    
    return next();
  };
}
```

---

## 9. Data Sync & Offline Strategy

### 9.1 Sync Architecture

**Cosmos DB Change Feed Processing**
```typescript
// functions/sync/changeFeedProcessor.ts
import { CosmosClient } from '@azure/cosmos';

export async function processSyncChanges(
  context: InvocationContext
): Promise<void> {
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
  const database = cosmosClient.database('kirana');
  const itemsContainer = database.container('items');
  const syncStateContainer = database.container('syncState');
  
  // Get change feed from last processed token
  const changeFeedIterator = itemsContainer.items.getChangeFeedIterator({
    startFromBeginning: false,
    maxItemCount: 100,
  });
  
  while (changeFeedIterator.hasMoreResults) {
    const response = await changeFeedIterator.readNext();
    
    if (!response || response.result.length === 0) break;
    
    const changes = response.result;
    context.log(`Processing ${changes.length} changes`);
    
    // Group changes by household
    const changesByHousehold = new Map<string, any[]>();
    
    for (const change of changes) {
      const householdId = change.householdId;
      if (!changesByHousehold.has(householdId)) {
        changesByHousehold.set(householdId, []);
      }
      changesByHousehold.get(householdId)!.push(change);
    }
    
    // Update sync state for each household
    for (const [householdId, householdChanges] of changesByHousehold) {
      await syncStateContainer.items.upsert({
        id: `sync-${householdId}-${Date.now()}`,
        householdId,
        type: 'sync_state',
        changes: householdChanges.map(c => ({
          entityId: c.id,
          entityType: c.type,
          operation: c._self ? 'update' : 'create',
          timestamp: c.updatedAt || c.createdAt,
        })),
        createdAt: new Date().toISOString(),
        ttl: 3600, // 1 hour (clients poll every 10 min)
      });
    }
  }
}

// Register timer trigger (every 10 minutes)
app.timer('syncChangeFeed', {
  schedule: '0 */10 * * * *', // Every 10 minutes
  handler: processSyncChanges,
});
```

**Client-Side Sync Service**
```typescript
// src/shared/services/syncService.ts
import { db } from '../lib/db';
import { api } from '../lib/api';

export class SyncService {
  private syncInterval: number = 10 * 60 * 1000; // 10 minutes
  private intervalId: number | null = null;
  
  start() {
    if (this.intervalId) return; // Already running
    
    // Sync immediately on start
    this.sync();
    
    // Then sync every 10 minutes
    this.intervalId = window.setInterval(() => this.sync(), this.syncInterval);
  }
  
  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  async sync() {
    try {
      // 1. Push local changes to server
      await this.pushChanges();
      
      // 2. Pull remote changes from server
      await this.pullChanges();
      
      // 3. Update last sync timestamp
      localStorage.setItem('lastSyncTime', new Date().toISOString());
    } catch (error) {
      console.error('Sync failed:', error);
      // Don't throw - allow app to continue working offline
    }
  }
  
  private async pushChanges() {
    const pendingItems = await db.syncQueue
      .where('operation')
      .anyOf(['create', 'update', 'delete'])
      .toArray();
    
    for (const item of pendingItems) {
      try {
        if (item.entity === 'item') {
          if (item.operation === 'create') {
            await api.post('/api/items', item.payload);
          } else if (item.operation === 'update') {
            await api.patch(`/api/items/${item.entityId}`, item.payload);
          } else if (item.operation === 'delete') {
            await api.delete(`/api/items/${item.entityId}`);
          }
        } else if (item.entity === 'transaction') {
          await api.post('/api/transactions', item.payload);
        }
        
        // Remove from queue on success
        await db.syncQueue.delete(item.id!);
      } catch (error: any) {
        // Handle 409 Conflict (concurrent modification)
        if (error.status === 409) {
          console.warn('Conflict detected, will resolve on next pull');
          await db.syncQueue.delete(item.id!);
        } else {
          // Increment retry count
          await db.syncQueue.update(item.id!, {
            retryCount: item.retryCount + 1,
          });
        }
      }
    }
  }
  
  private async pullChanges() {
    const lastSyncTime = localStorage.getItem('lastSyncTime');
    const householdId = localStorage.getItem('householdId');
    
    if (!householdId) return;
    
    // Get changes since last sync
    const response = await api.get(`/api/sync/changes`, {
      params: {
        householdId,
        since: lastSyncTime || new Date(0).toISOString(),
      },
    });
    
    const changes = response.data.changes;
    
    // Apply changes to IndexedDB
    for (const change of changes) {
      if (change.entityType === 'item') {
        if (change.operation === 'update' || change.operation === 'create') {
          await db.items.put({
            ...change.data,
            syncStatus: 'synced',
            lastModified: new Date(),
          });
        } else if (change.operation === 'delete') {
          await db.items.delete(change.entityId);
        }
      } else if (change.entityType === 'transaction') {
        await db.transactions.put({
          ...change.data,
          syncStatus: 'synced',
        });
      }
    }
  }
}

export const syncService = new SyncService();
```

### 9.2 Conflict Resolution

**Last-Write-Wins Strategy**
```typescript
// functions/sync/conflictResolver.ts
export function resolveConflict(local: any, remote: any): any {
  // Compare timestamps
  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();
  
  if (remoteTime >= localTime) {
    // Remote is newer or same → use remote
    return remote;
  } else {
    // Local is newer → use local
    return local;
  }
}

// For Phase 2+: Optional version history
export function createVersionHistory(item: any): any {
  return {
    ...item,
    versions: [
      {
        data: item,
        timestamp: item.updatedAt,
        userId: item.lastModifiedBy,
      },
      ...(item.versions || []),
    ].slice(0, 10), // Keep last 10 versions
  };
}
```

---

## 10. Cost Optimization & Monitoring

### 10.1 Azure Cost Breakdown (Projected)

**Phase 1-2 (50-500 users)**

| Resource | Tier/SKU | Usage Pattern | Monthly Cost | Notes |
|----------|----------|---------------|--------------|-------|
| **Cosmos DB** | Serverless | ~50K RU/month | $12-25 | Single region, <1GB data |
| **Azure Functions** | Consumption | ~1M executions/month | $0-20 | First 1M free |
| **Blob Storage** | Hot tier | 5GB storage, 10K operations | $0.50-2 | Receipt photos |
| **Entra ID** | Free tier | Up to 50K MAU | $0 | Includes OAuth |
| **Application Insights** | Pay-as-you-go | 5GB ingestion/month | $10-15 | Critical for cost tracking |
| **Gemini API** | Pay-per-use | 500 users × $0.20 | $100 | Largest variable cost |
| **Bandwidth** | Outbound | 10GB/month | $1-2 | Minimal in single region |
| **TOTAL** | | | **$123-164/month** | ~$0.25-0.33/user |

**Phase 3 (1,000 users)**

| Resource | Tier/SKU | Usage Pattern | Monthly Cost | Notes |
|----------|----------|---------------|--------------|-------|
| **Cosmos DB** | Serverless → Provisioned | 400 RU/s baseline | $25-40 | Autoscale 400-4000 RU/s |
| **Azure Functions** | Consumption | ~5M executions/month | $5-30 | Still cost-effective |
| **Blob Storage** | Hot tier | 20GB storage | $2-5 | Growing receipt archive |
| **Application Insights** | Pay-as-you-go | 20GB ingestion/month | $40-60 | More telemetry |
| **Gemini API** | Pay-per-use | 1K users × $0.15 | $150 | Improved caching |
| **TOTAL** | | | **$222-285/month** | ~$0.22-0.29/user |

**Cost Optimization Triggers**

| Metric | Action | Expected Savings |
|--------|--------|------------------|
| Cosmos DB > $100/month at 1K users | Evaluate PostgreSQL + Supabase | 40-50% reduction |
| LLM cost > $0.30/user for 2 months | Switch to open-source model (Llama 3.1) | 60-70% reduction |
| Blob Storage > $50/month | Implement lifecycle policy (hot → cool after 90 days) | 30-40% reduction |
| Application Insights > $100/month | Switch to Grafana + Prometheus (self-hosted) | 70-80% reduction |

### 10.2 Real-Time Cost Dashboard

**Application Insights Custom Metrics**
```typescript
// functions/shared/telemetry.ts
import { TelemetryClient } from 'applicationinsights';

const appInsights = new TelemetryClient(process.env.APPINSIGHTS_CONNECTION_STRING!);

export function trackCost(data: {
  resource: 'cosmos' | 'gemini' | 'blob' | 'functions';
  operation: string;
  cost: number;
  userId?: string;
  householdId?: string;
}) {
  appInsights.trackMetric({
    name: 'resource_cost',
    value: data.cost,
    properties: {
      resource: data.resource,
      operation: data.operation,
      userId: data.userId || 'unknown',
      householdId: data.householdId || 'unknown',
    },
  });
}

export function trackPerformance(data: {
  operation: string;
  duration: number;
  success: boolean;
}) {
  appInsights.trackDependency({
    name: data.operation,
    duration: data.duration,
    success: data.success,
    resultCode: data.success ? 200 : 500,
  });
}
```

---

## 11. Security & Privacy

### 11.1 Data Encryption

**Encryption at Rest**
- **Cosmos DB:** Automatic encryption with Microsoft-managed keys
- **Blob Storage:** AES-256 encryption enabled by default
- **Secrets:** Azure Key Vault for API keys, connection strings

**Encryption in Transit**
- TLS 1.2+ for all HTTPS connections
- Certificate pinning for mobile apps (Phase 3+)

**Key Vault Integration**
```typescript
// functions/shared/secrets.ts
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const keyVaultUrl = `https://${process.env.KEY_VAULT_NAME}.vault.azure.net`;
const secretClient = new SecretClient(keyVaultUrl, credential);

export async function getSecret(secretName: string): Promise<string> {
  const secret = await secretClient.getSecret(secretName);
  return secret.value!;
}
```

### 11.2 Privacy Controls & Data Retention

**One-Click Data Deletion** (See implementation in Section 11 of full spec)

---

## 12. Performance & Scalability

### 12.1 Performance Targets

| Metric | Target | Measurement | Mitigation if Exceeded |
|--------|--------|-------------|------------------------|
| **Page Load Time** | <2s (p95) | Lighthouse CI | Optimize bundle size, lazy load routes |
| **One-Tap Restock** | <500ms | Custom timing API | Add Cosmos DB read cache |
| **Photo OCR Processing** | <5s perceived latency | User perception (async UI) | Queue-based processing, progress indicator |
| **Prediction Calculation** | <1s per item | Function execution time | Batch processing, pre-compute overnight |
| **Sync Latency** | 5-15 min | Change feed delay | Acceptable for MVP; optimize in Phase 3 |

---

## 13. Deployment & DevOps

### 13.1 Infrastructure as Code (Bicep)

**Deploy Azure Resources**
```bash
# Create resource group
az group create --name kirana-rg --location westus2

# Deploy resources
az deployment group create \
  --resource-group kirana-rg \
  --template-file infrastructure/main.bicep \
  --parameters environment=prod
```

---

## 14. Testing Strategy

### 14.1 Testing Pyramid

```
       ┌───────────────┐
       │  E2E Tests    │ ← 10% (Critical user flows)
       │  (Playwright) │
       └───────────────┘
      ┌─────────────────┐
      │ Integration     │ ← 30% (API + DB)
      │ Tests (Jest)    │
      └─────────────────┘
    ┌───────────────────────┐
    │  Unit Tests           │ ← 60% (Business logic)
    │  (Jest + Vitest)      │
    └───────────────────────┘
```

**Unit Tests:** Prediction model, unit normalizer, business logic  
**Integration Tests:** API + Cosmos DB  
**E2E Tests:** Onboarding flow, CSV upload, photo OCR  

---

## 15. Observability & Monitoring

### 15.1 Key Metrics Dashboard

**Custom Metrics to Track:**
- **LLM Cost:** Per-user, per-day, per-operation
- **Prediction Accuracy:** % within ±5 days
- **Override Rate:** % predictions manually changed
- **Parsing Success Rate:** % receipts parsed without errors
- **Sync Latency:** p50, p95, p99 sync delays
- **Cache Hit Rate:** LLM normalization cache efficiency
- **API Response Time:** p50, p95, p99 per endpoint
- **Error Rate:** 4xx, 5xx errors by endpoint
- **User Engagement:** WAU, DAU, retention cohorts

**Kusto Queries for Insights**
```kusto
// LLM cost per user (last 30 days)
customMetrics
| where name == "resource_cost"
| where customDimensions.resource == "gemini"
| where timestamp > ago(30d)
| summarize TotalCost = sum(value) by tostring(customDimensions.userId)
| order by TotalCost desc
| take 20
```

### 15.2 Parsing Quality Monitoring & Canaries

**Per-Retailer Success Metrics**

Track parsing success rate by retailer to detect regressions early:

```typescript
// functions/shared/parsingMetrics.ts
import { ApplicationInsights } from '@azure/monitor-opentelemetry-exporter';

export class ParsingMetrics {
  private static appInsights = new ApplicationInsights();
  
  static recordParsingAttempt(
    retailer: string,
    method: 'regex' | 'gemini' | 'queued',
    success: boolean,
    confidence: number,
    itemCount: number
  ): void {
    this.appInsights.trackEvent({
      name: 'parsing_attempt',
      properties: {
        retailer,
        method,
        success: success.toString(),
        confidence: confidence.toString(),
        itemCount: itemCount.toString(),
      },
      measurements: {
        confidence,
        itemCount,
      },
    });
    
    // Track per-retailer success rate
    this.appInsights.trackMetric({
      name: 'parsing_success_rate',
      value: success ? 1 : 0,
      dimensions: {
        retailer,
        method,
      },
    });
  }
}
```

**Automated Canary Receipts**

Run hourly synthetic receipt tests to catch regressions:

```typescript
// functions/monitoring/canaryTests.ts
import { app, Timer, InvocationContext } from '@azure/functions';
import { HybridParserWithFallback } from '../parsing/hybridParserWithFallback';

interface CanaryReceipt {
  retailer: string;
  blobUri: string; // Pre-loaded test receipt in Blob Storage
  expectedItems: number;
  expectedTotal: number;
}

const CANARY_RECEIPTS: CanaryReceipt[] = [
  { retailer: 'amazon', blobUri: 'https://...test-amazon-receipt.jpg', expectedItems: 15, expectedTotal: 87.43 },
  { retailer: 'costco', blobUri: 'https://...test-costco-receipt.jpg', expectedItems: 8, expectedTotal: 132.50 },
  { retailer: 'target', blobUri: 'https://...test-target-receipt.jpg', expectedItems: 12, expectedTotal: 64.28 },
];

export async function canaryTests(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Running hourly canary receipt tests');
  
  const parser = new HybridParserWithFallback();
  const results: Array<{ retailer: string; success: boolean; reason?: string }> = [];
  
  for (const canary of CANARY_RECEIPTS) {
    try {
      const result = await parser.parsePhotoReceipt(
        canary.blobUri,
        'canary-test-user',
        'canary-household',
        canary.retailer
      );
      
      const itemCountMatch = result.receipt.items.length === canary.expectedItems;
      const totalMatch = Math.abs(result.receipt.totalAmount - canary.expectedTotal) < 0.5;
      const success = itemCountMatch && totalMatch;
      
      results.push({
        retailer: canary.retailer,
        success,
        reason: !success ? `Items: ${result.receipt.items.length}/${canary.expectedItems}, Total: $${result.receipt.totalAmount}/$${canary.expectedTotal}` : undefined,
      });
      
      // Track metric
      context.log(`Canary test ${canary.retailer}: ${success ? 'PASS' : 'FAIL'}`);
      
    } catch (error: any) {
      context.error(`Canary test ${canary.retailer} FAILED:`, error.message);
      results.push({
        retailer: canary.retailer,
        success: false,
        reason: error.message,
      });
    }
  }
  
  // Alert if any canary failed
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    context.error(`⚠️ CANARY ALERT: ${failures.length}/${CANARY_RECEIPTS.length} tests failed`);
    // TODO: Send PagerDuty/Slack alert
  }
}

// Schedule hourly
app.timer('canaryTests', {
  schedule: '0 */1 * * * *', // Every hour
  handler: canaryTests,
});
```

**Alert Thresholds**

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| **Parsing success rate (per retailer)** | <80% for 4 hours | <70% for 1 hour | HIGH SEVERITY: Queue all receipts for batch retry; investigate Gemini API changes |
| **Canary test failure** | 1 failure | 2+ failures or same retailer 3x | CRITICAL: Disable photo parsing; switch to CSV/manual entry only |
| **Daily LLM cost** | >$35 (70% of $50) | >$50 (100% of budget) | AUTO-THROTTLE: Circuit breaker closes, queue receipts for batch processing |
| **Queue backlog** | >500 receipts | >1000 receipts | INVESTIGATE: Batch processor not keeping up; increase batch frequency or optimize Gemini calls |

### 15.3 Infrastructure Runbooks & Risk Mitigation

**Risk Table with Triggers and Automated Responses**

| Risk | Probability | Impact | Trigger | Automated Response | Manual Runbook |
|------|-------------|--------|---------|-------------------|----------------|
| **LLM Cost Spike** | Medium | Critical | Daily spend >$50 for 1 day OR Monthly user avg >$0.30 | Circuit breaker closes; queue receipts for overnight batch; notify users of delayed processing | 1. Investigate cause (API price change? Traffic spike?) 2. Review Cosmos costTracking logs 3. If sustained, reduce per-user cap to $0.15 |
| **Parsing Regression** | High | High | Per-retailer success <70% for 24h OR Canary failure 3x same retailer | Auto-queue affected retailer receipts; disable real-time Gemini for that retailer; alert on-call | 1. Check Gemini API status 2. Review recent receipt samples 3. Test deterministic parser 4. If Gemini issue, rollback to previous prompt version |
| **Privacy Incident** | Low | Critical | PII detected in logs OR Email body stored >7 days OR Unauthorized data access | Auto-delete affected records; revoke API keys; lock affected user accounts | 1. Assess scope of breach 2. Notify affected users within 72h 3. File incident report 4. Review data retention policies |
| **Prediction Trust Collapse** | Medium | High | Override rate >50% for 7 days OR Confidence:High <30% of predictions | Disable auto-add feature; show all predictions as "suggestions"; increase Teach Mode prompts | 1. Audit prediction algorithm with test data 2. Check for seasonal items causing variance 3. Tighten confidence thresholds 4. Add outlier detection |
| **Budget Exceeded (Azure)** | Low | High | Monthly Azure bill >$500 OR Anomaly detection triggered | Alert billing admin; review top resource consumers; consider scaling down | 1. Check Cosmos DB RU/s spike 2. Review Blob Storage egress 3. Check Functions execution count 4. Implement aggressive caching |

**Runbook: LLM Cost Spike Response**

1. **Detect:** Automated alert triggered when daily cost >$50 OR 70% threshold breached
2. **Immediate Action (Automated):**
   - Circuit breaker closes for new LLM calls
   - Queue all receipts with `status: 'queued_budget_exceeded'`
   - Display clear user messaging: "Processing delayed due to high demand"
3. **Investigation (Manual):**
   - Query Cosmos DB `costTracking` container for top spenders
   - Check Application Insights for anomalous traffic patterns
   - Review Gemini API pricing changes
4. **Resolution:**
   - If legitimate traffic spike: Increase daily cap temporarily
   - If single user abuse: Rate-limit or suspend account
   - If API price change: Re-evaluate cost model and user caps
5. **Post-Mortem:**
   - Document root cause
   - Update cost simulator with new scenarios
   - Revise alerting thresholds if needed

**Runbook: Parsing Regression (Gemini API Change)**

1. **Detect:** Per-retailer success rate drops >10% OR canary tests fail 2+ times
2. **Immediate Action:**
   - Auto-queue all receipts from affected retailer for batch processing
   - Disable real-time Gemini parsing for that retailer temporarily
   - Alert users of affected retailer: "Receipts will be processed overnight"
3. **Investigation:**
   - Test with sample receipts in isolation (bypass caching)
   - Check Gemini model version (2.0-flash-exp vs stable)
   - Review prompt templates for schema validation errors
4. **Resolution:**
   - If Gemini model updated: Adjust prompt template and retry in batch
   - If persistent: Enhance deterministic parser for affected retailer
   - If widespread: Consider rolling back to Gemini 1.5 Flash (stable)
5. **Communication:**
   - Notify affected users of delayed processing (<24h SLA)
   - Update status page if incident lasts >4 hours

### 15.4 Incident Response & Escalation (Cost-Effective)

**Alert Delivery (Free Solutions)**

- **Slack Integration:** Azure Monitor → Slack webhook (primary channel)
- **Email Alerts:** Azure Communication Services (100 free emails/day)
- **No PagerDuty:** Use Slack mobile notifications for on-call

**Alert Severity Levels**

| Severity | Definition | Response Time | Notification Method |
|----------|-----------|---------------|---------------------|
| **P0 - Critical** | System down or data loss | 15 minutes | Slack @channel + Email + SMS (manual) |
| **P1 - High** | Major feature degraded (>50% users affected) | 1 hour | Slack @here + Email |
| **P2 - Medium** | Minor feature degraded (<50% users) or warning threshold | 4 hours | Slack notification |
| **P3 - Low** | Informational, no immediate impact | Next business day | Slack notification only |

**P0 Critical Incidents:**
- Daily LLM cost >$50 (budget breach)
- >90% API error rate for >5 minutes
- Database unavailable (Cosmos DB down)
- Authentication system down (Entra ID unreachable)

**P1 High Incidents:**
- Parsing success rate <70% for any retailer for >1 hour
- Queue backlog >1000 receipts
- API error rate >20% for >15 minutes
- Prediction job failure (no predictions calculated for >24h)

**Escalation Matrix (Phase 1 - Small Team)**

```
P0 Critical → On-call Engineer (15 min) → Tech Lead (30 min) → Product/CTO (1 hour)
P1 High → On-call Engineer (1 hour) → Tech Lead (4 hours)
P2 Medium → On-call Engineer (4 hours) → Team standup next day
P3 Low → Queue for triage at next team meeting
```

**On-Call Rotation (Phase 1-2):**
- **Assumption:** 1-2 engineers during Phase 1
- **Rotation:** Weekly on-call (Mon 9 AM - Mon 9 AM)
- **Backup:** Product owner has read-only dashboard access
- **Handoff:** Friday EOD Slack message with week's highlights

**Incident Response Workflow**

```typescript
// functions/shared/alerting.ts
import { WebhookClient } from '@slack/webhook';

const slackWebhook = new WebhookClient(process.env.SLACK_WEBHOOK_URL!);

export async function sendAlert(
  severity: 'P0' | 'P1' | 'P2' | 'P3',
  title: string,
  details: string,
  runbook?: string
): Promise<void> {
  const color = {
    'P0': 'danger',
    'P1': 'warning',
    'P2': '#FFA500',
    'P3': '#808080',
  }[severity];
  
  const mention = severity === 'P0' ? '<!channel>' : (severity === 'P1' ? '<!here>' : '');
  
  await slackWebhook.send({
    text: `${mention} ${severity}: ${title}`,
    attachments: [{
      color,
      title,
      text: details,
      fields: [
        {
          title: 'Severity',
          value: severity,
          short: true,
        },
        {
          title: 'Response Time',
          value: severity === 'P0' ? '15 min' : severity === 'P1' ? '1 hour' : '4 hours',
          short: true,
        },
        ...(runbook ? [{
          title: 'Runbook',
          value: runbook,
          short: false,
        }] : []),
      ],
      footer: 'Kirana Monitoring',
      ts: Math.floor(Date.now() / 1000).toString(),
    }],
  });
  
  // Send email for P0/P1
  if (severity === 'P0' || severity === 'P1') {
    await sendEmailAlert(severity, title, details);
  }
}

async function sendEmailAlert(severity: string, title: string, details: string): Promise<void> {
  // Azure Communication Services: 100 free emails/day
  const { EmailClient } = require('@azure/communication-email');
  const emailClient = new EmailClient(process.env.ACS_CONNECTION_STRING!);
  
  const message = {
    senderAddress: 'DoNotReply@kirana.app',
    content: {
      subject: `${severity}: ${title}`,
      plainText: details,
    },
    recipients: {
      to: [{ address: process.env.ONCALL_EMAIL! }],
    },
  };
  
  await emailClient.beginSend(message);
}
```

**Post-Incident Process**

1. **Immediate (within 1 hour of resolution):**
   - Update Slack thread with resolution summary
   - Update status page if public-facing
   - Close alert in Azure Monitor

2. **Post-Mortem (within 3 business days for P0/P1):**
   - Document timeline in GitHub issue
   - Root cause analysis (5 Whys)
   - Action items with owners and deadlines
   - Share in team standup

3. **Follow-up (within 2 weeks):**
   - Implement preventive measures
   - Update runbooks if new insights
   - Review and adjust alert thresholds if needed

**Cost Breakdown:**

| Service | Tier | Cost | Usage |
|---------|------|------|-------|
| **Slack** | Free | $0 | Unlimited webhooks |
| **Azure Communication Services** | Free | $0 | 100 emails/day (sufficient for Phase 1) |
| **Azure Monitor Alerts** | Pay-per-use | ~$2-5/month | 50-100 alerts/month |
| **Total** | - | **$2-5/month** | No PagerDuty ($29/user/month saved) |

**Testing & Drills:**

```markdown
- [ ] Week 2: Test Slack webhook integration
- [ ] Week 4: Simulate P2 alert and verify Slack notification
- [ ] Week 6: Simulate P1 alert and verify email delivery
- [ ] Monthly: Fire drill - simulate P0 incident and measure response time
```

---

## 16. Phase 1 Implementation Plan

### 16.1 Sprint Breakdown (6 Weeks)

**Week 1-2: Foundation & Risk Mitigation**
- [ ] **LLM Cost Simulator** (CRITICAL): Build token estimation model for onboarding flows, CSV imports, photo parsing
- [ ] **Gmail OAuth Prep** (START NOW): Draft privacy policy, DPA, consent screens; prepare verification video (4-6 week approval)
- [ ] Azure resource provisioning (Cosmos DB, Functions, Blob Storage, Entra ID)
- [ ] Cosmos DB schema implementation (6 containers + costTracking container for LLM budget enforcement)
- [ ] Unit normalization library with SKU lookup table (top 5K items)
- [ ] **1,000 SKU Test Harness**: Dataset + automated validation (target: >90% normalization success)
- [ ] Authentication scaffolding (Entra ID integration)
- [ ] React app structure and routing
- [ ] CI/CD pipeline setup (GitHub Actions)

**Week 3-4: Core Features + Hardened Intelligence Layer**
- [ ] Items API (CRUD operations)
- [ ] Transactions API
- [ ] **Prediction model** (exponential smoothing + z-score outlier detection, ≥3 purchases for high confidence per PRD)
- [ ] **Deterministic parsers**: Amazon CSV, Costco CSV (regex-based, zero LLM cost)
- [ ] **Gemini Vision integration** with pre-flight budget checks and circuit breaker
- [ ] **Queue-based degradation system** for budget/confidence fallback (overnight batch processing)
- [ ] LLM cost tracking dashboard (real-time from Cosmos DB costTracking container)
- [ ] Demo mode UI component
- [ ] IndexedDB offline storage

**Week 5: Data Ingestion & UX**
- [ ] CSV upload flow with preview
- [ ] Photo capture/upload with compression
- [ ] **Queued receipt UI component** (banner with estimated completion time)
- [ ] Inline micro-review component (A/B test setup)
- [ ] Teach Mode (Smart Shopping Assistant)
- [ ] Item list with predictions display
- [ ] Service worker for offline caching
- [ ] Batch receipt processor (nightly 2 AM Azure Function)

**Week 6: Testing & Polish**
- [ ] Unit tests for prediction model
- [ ] Unit tests for unit normalizer
- [ ] Integration tests for APIs
- [ ] E2E tests for onboarding flow
- [ ] Performance optimization (bundle size, lazy loading)
- [ ] Security review (CORS, rate limiting, auth)
- [ ] Documentation (API docs, deployment guide)

### 16.2 Go-Live Checklist

**Infrastructure**
- [ ] All Azure resources provisioned in West US 2
- [ ] Entra ID app registration completed
- [ ] DNS configured (app.kirana.app → Azure Static Web Apps)
- [ ] SSL certificate installed
- [ ] Application Insights configured with custom dashboards
- [ ] Cost alerts configured ($35/day, $50/day thresholds)

**Security**
- [ ] Secrets migrated to Azure Key Vault
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled (100 req/min per user)
- [ ] TLS 1.2+ enforced
- [ ] Blob storage access restricted (private containers)

**Testing**
- [ ] 10 sample Amazon CSV files imported successfully
- [ ] 20 test receipts (Amazon, Costco) parsed with ≥70% success
- [ ] Prediction model validated on holdout test set (±5 days for 70% of items)
- [ ] Inline micro-review completion rate ≥70% in internal testing
- [ ] LLM costs <$0.25/user for 50 simulated users

**Monitoring**
- [ ] Application Insights dashboard live
- [ ] LLM cost tracking operational
- [ ] Error alerting configured (PagerDuty/Slack)
- [ ] Uptime monitoring (Azure Monitor)

**Documentation**
- [ ] API documentation published
- [ ] User onboarding guide
- [ ] Privacy policy and terms of service
- [ ] Incident response runbook

---

## 17. Open Questions & Design Decisions Needed

**Decision Deadline:** All questions must be resolved by **November 10, 2025** (before Week 1 implementation starts).

| # | Question | Category | Owner | Deadline | Status |
|---|----------|----------|-------|----------|--------|
| 1 | Gmail OAuth Priority: Start verification in Week 1 or defer to Phase 2B? | Product | Product Owner | Nov 8, 2025 | Open |
| 2 | Entra ID vs. Simpler Auth: Hard requirement or Auth0/Clerk acceptable? | Product | Product Owner | Nov 8, 2025 | Open |
| 3 | Demo Mode Data: Real anonymized data or synthetic data? | Product | Product Owner | Nov 8, 2025 | Open |
| 4 | Inline Micro-Review Default: 2-tap or 3-tap variant? | UX | UX Designer | Nov 9, 2025 | Open |
| 5 | Cosmos DB vs. PostgreSQL: Start with Cosmos or PostgreSQL + Supabase? | Engineering | Tech Lead | Nov 8, 2025 | Open |
| 6 | Redis for LLM Cache: Add Redis or use Cosmos DB + in-memory cache? | Engineering | Tech Lead | Nov 9, 2025 | Open |
| 7 | Gemini 2.0 vs. 1.5 Flash: Use 2.0 Flash or stick with 1.5? | Engineering | Tech Lead | Nov 9, 2025 | Open |
| 8 | Real-Time Sync: WebSockets/SignalR or polling? | Engineering | Tech Lead | Nov 9, 2025 | Open |
| 9 | Prediction Confidence UI: Badges, tooltips, progress bars, or text? | UX | UX Designer | Nov 9, 2025 | Open |
| 10 | Micro-Review Queue Limit: Cap at 3 items or unlimited? | UX | UX Designer | Nov 9, 2025 | Open |
| 11 | Demo Mode Exit: When to transition to real data? | UX | UX Designer | Nov 9, 2025 | Open |

### 17.1 Questions for Product/Business

1. **Gmail OAuth Priority:** Should we prioritize Gmail API verification in Week 1, or defer to Phase 2B?
   - **Owner:** Product Owner
   - **Deadline:** Nov 8, 2025
   - **Recommendation:** Start verification process immediately (4-6 week approval), but don't block Phase 1 launch.

2. **Entra ID vs. Simpler Auth:** Is Microsoft Entra ID a hard requirement, or would Auth0/Clerk/Firebase Auth be acceptable for faster iteration?
   - **Owner:** Product Owner
   - **Deadline:** Nov 8, 2025
   - **Trade-off:** Entra ID = enterprise-grade but slower setup; Clerk = faster but less enterprise features.

3. **Demo Mode Data:** Should demo mode use real anonymized user data or synthetic data?
   - **Owner:** Product Owner
   - **Deadline:** Nov 8, 2025
   - **Recommendation:** Synthetic data to avoid privacy concerns; easier to control messaging.

4. **Inline Micro-Review Default:** Should we default to 2-tap or 3-tap variant for all users?
   - **Owner:** UX Designer
   - **Deadline:** Nov 9, 2025
   - **Recommendation:** A/B test 50/50 split; measure completion rate and user feedback.

### 17.2 Questions for Engineering

1. **Cosmos DB vs. PostgreSQL:** Given cost concerns at scale, should we start with PostgreSQL + Supabase instead?
   - **Owner:** Tech Lead
   - **Deadline:** Nov 8, 2025
   - **Trade-off:** Cosmos DB = serverless, auto-scaling; PostgreSQL = cheaper at scale but more ops overhead.
   - **Recommendation:** Start with Cosmos DB (faster MVP), plan migration at 1K users if costs exceed $500/month.

2. **Redis for LLM Cache:** Should we add Redis for LLM normalization cache instead of Cosmos DB?
   - **Owner:** Tech Lead
   - **Deadline:** Nov 9, 2025
   - **Trade-off:** Redis = faster reads but adds $20-40/month; Cosmos DB = slower but no extra cost.
   - **Recommendation:** Use Cosmos DB with in-memory cache (Map) in function app; defer Redis to Phase 3.

3. **Gemini 2.0 Flash vs. 1.5 Flash:** Should we use the newer 2.0 Flash or stick with battle-tested 1.5?
   - **Owner:** Tech Lead
   - **Deadline:** Nov 9, 2025
   - **Trade-off:** 2.0 = better quality but experimental; 1.5 = proven but less accurate.
   - **Recommendation:** Start with 2.0 Flash; fallback to 1.5 if quality/reliability issues arise.

4. **Real-Time Sync:** Should we invest in WebSockets/SignalR for real-time sync instead of polling?
   - **Owner:** Tech Lead
   - **Deadline:** Nov 9, 2025
   - **Trade-off:** WebSockets = instant updates but higher costs; Polling = acceptable latency for MVP.
   - **Recommendation:** Stick with 5-15 min scheduled sync for Phase 1-2; revisit if user feedback demands it.

### 17.3 Questions for Design/UX

1. **Prediction Confidence UI:** How should we visualize Low/Medium/High confidence to users?
   - **Owner:** UX Designer
   - **Deadline:** Nov 9, 2025
   - **Options:** Color-coded badges, tooltip explanations, progress bars, textual descriptions.
   - **Recommendation:** Color-coded badges + tooltip with factors (e.g., "5 purchases, consistent pattern").

2. **Micro-Review Queue Limit:** Should we cap at 3 items or allow unlimited queue?
   - **Owner:** UX Designer
   - **Deadline:** Nov 9, 2025
   - **Trade-off:** Cap = less overwhelming but may require multiple sessions; Unlimited = faster but fatiguing.
   - **Recommendation:** Cap at 3, with "Review more items" CTA after completion.

3. **Demo Mode Exit:** When should we transition users from demo mode to real data?
   - **Owner:** UX Designer
   - **Deadline:** Nov 9, 2025
   - **Options:** After CSV upload, after 5 manual items, after 24 hours, never (keep demo items as reference).
   - **Recommendation:** Transition immediately after first real data input (CSV/photo/manual); keep demo items for 24h with "Example" badge.

---

## 18. Conclusion

This technical specification provides a comprehensive blueprint for building Kirana's MVP with the following key characteristics:

**✅ Cost-Effective**
- Serverless-first architecture minimizes idle costs
- Aggressive caching reduces LLM expenses to <$0.20/user/month
- Scheduled sync (5-15 min) balances UX and cost
- Clear migration paths if costs exceed thresholds

**✅ Scalable**
- Horizontal scaling via Cosmos DB partitioning by `householdId`
- Stateless Azure Functions auto-scale to 200 instances
- Multi-region expansion ready (Phase 4+)
- Database sharding plan for 100K+ users

**✅ Performant**
- <2s page load through offline-first PWA
- <500ms One-Tap Restock via optimized queries
- <5s photo OCR with async processing
- Multi-layer caching (browser, IndexedDB, service worker)

**✅ Secure & Private**
- Entra ID OAuth 2.0 authentication
- Encryption at rest and in transit (TLS 1.2+)
- User-controlled data retention policies
- One-click data deletion with anonymization

**✅ Maintainable**
- Clear separation of concerns (microservices)
- Comprehensive test coverage (60% unit, 30% integration, 10% E2E)
- Structured logging and observability
- Infrastructure as Code (Bicep templates)

**Next Steps:**
1. Review and approve open design questions (Section 17)
2. Provision Azure resources using Bicep templates
3. Begin Week 1-2 sprint (foundation work)
4. Schedule daily standups and weekly demos

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-01 | Engineering Team | Initial technical specification |

