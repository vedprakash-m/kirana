# Copilot Feedback Action Plan

**Date:** November 2, 2025  
**Review Source:** GitHub Copilot comprehensive review of Tasks_Kirana.md  
**Overall Assessment:** ✅ Valid and actionable feedback; significantly improves plan quality

---

## ✅ Critical Bugs Fixed Immediately

### 1. Cost Tracking Service Bug
**Issue:** `getSystemDailySpend()` called as free function instead of `this.getSystemDailySpend()`  
**Impact:** Budget enforcement would silently fail, allowing overspend  
**Status:** ✅ FIXED  
**Location:** Task 1A.5.1, line in `checkBudget()` method  

### 2. Unit Normalizer Async Bug
**Issue:** `calculateUnitPrice()` synchronous function uses `await this.normalize()`  
**Impact:** TypeScript compilation error, Promise type mismatch  
**Status:** ✅ FIXED  
**Action Taken:** Marked function as `async`, returns `Promise<number>`  
**Location:** Task 1A.6.1, `UnitNormalizer.calculateUnitPrice()`  

### 3. Cosmos DB Setup Script Bug
**Issue:** `database.database.containers.createIfNotExists` invalid path  
**Impact:** Infrastructure setup script doesn't run  
**Status:** ✅ FIXED  
**Action Taken:** Changed to `testDb.containers.createIfNotExists()` with correct partition key format  
**Location:** Task 1A.4.1, test setup code  

### 4. Auth Level Security Issue
**Issue:** HTTP functions use `authLevel: 'anonymous'` contradicting Tech Spec security requirements  
**Impact:** Data exposure; test traffic bypasses authentication  
**Status:** ✅ PARTIALLY FIXED  
**Action Taken:** Changed parseCSV to `authLevel: 'function'`, added NOTE about JWT validation  
**Remaining Work:** Implement full JWT validation middleware (see Action Items below)  

---

## 🔴 Critical Gaps to Address (Priority 1 - Week 1-2)

### Missing API Endpoints

#### 1. Parse Job Polling Endpoint
**What's Missing:** `GET /api/parse/jobs/:id`  
**Why Critical:** Frontend cannot poll for parsing progress, breaking UX flow  
**Action Required:**
```typescript
// backend/src/functions/parsing/getParseJob.ts
export async function getParseJob(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const { jobId } = request.params;
  const { userId, householdId } = await validateToken(request);
  
  const job = await cosmosDb.getItem('parseJobs', jobId, householdId);
  
  if (!job) {
    return { status: 404, jsonBody: { success: false, error: { code: 'JOB_NOT_FOUND' } } };
  }
  
  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: {
          totalLines: job.totalLines,
          parsed: job.parsed,
          autoAccepted: job.autoAccepted,
          needsReview: job.needsReview,
          failed: job.failed
        },
        results: job.status === 'completed' ? job.results : undefined,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }
    }
  };
}
```

**Acceptance Criteria:**
- Returns job status and progress
- Frontend can poll every 500ms
- Returns review queue when status = 'completed'

**Owner:** Backend Engineer  
**Deadline:** Week 1  

#### 2. Micro-Review Submission Endpoint
**What's Missing:** `POST /api/parse/review`  
**Why Critical:** Users cannot accept/edit/reject parsed items, breaking micro-review flow  
**Action Required:**
```typescript
// backend/src/functions/parsing/submitReview.ts
interface ReviewSubmission {
  jobId: string;
  itemIndex: number;
  action: 'accept' | 'edit' | 'reject';
  edits?: {
    canonicalName?: string;
    brand?: string;
    quantity?: number;
    unitOfMeasure?: string;
    unitSize?: number;
    totalPrice?: number;
  };
}

export async function submitReview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const { userId, householdId } = await validateToken(request);
  const body = await request.json() as ReviewSubmission;
  
  // Validate input
  if (!['accept', 'edit', 'reject'].includes(body.action)) {
    return { status: 400, jsonBody: { success: false, error: { code: 'INVALID_ACTION' } } };
  }
  
  // Get parse job
  const job = await cosmosDb.getItem('parseJobs', body.jobId, householdId);
  if (!job) {
    return { status: 404, jsonBody: { success: false, error: { code: 'JOB_NOT_FOUND' } } };
  }
  
  // Get item from results
  const item = job.results[body.itemIndex];
  if (!item) {
    return { status: 404, jsonBody: { success: false, error: { code: 'ITEM_NOT_FOUND' } } };
  }
  
  if (body.action === 'accept' || body.action === 'edit') {
    // Apply edits if provided
    const finalItem = body.action === 'edit' 
      ? { ...item, ...body.edits }
      : item;
    
    // Create Item in Cosmos DB
    const newItem = {
      id: uuidv4(),
      householdId,
      type: 'item',
      canonicalName: finalItem.canonicalName,
      brand: finalItem.brand,
      category: finalItem.category,
      unitOfMeasure: finalItem.unitOfMeasure,
      unitSize: finalItem.unitSize,
      preferredVendor: finalItem.retailer,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await cosmosDb.createItem('items', newItem);
    
    // Create Transaction
    const transaction = {
      id: uuidv4(),
      householdId,
      type: 'transaction',
      itemId: newItem.id,
      purchaseDate: finalItem.purchaseDate,
      retailer: finalItem.retailer,
      totalPrice: finalItem.totalPrice,
      quantity: finalItem.quantity,
      unitPrice: finalItem.totalPrice / finalItem.quantity,
      unitOfMeasure: finalItem.unitOfMeasure,
      sourceType: 'csv_import',
      sourceMetadata: finalItem.sourceMetadata,
      createdAt: new Date().toISOString()
    };
    
    await cosmosDb.createItem('transactions', transaction);
    
    // Update cache if high confidence
    if (finalItem.confidence >= 0.9) {
      await normalizationCache.set({
        rawText: finalItem.rawText,
        canonicalName: finalItem.canonicalName,
        brand: finalItem.brand,
        category: finalItem.category,
        unitOfMeasure: finalItem.unitOfMeasure,
        unitSize: finalItem.unitSize,
        retailer: finalItem.retailer,
        confidence: finalItem.confidence
      });
    }
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          itemId: newItem.id,
          remainingReviews: job.results.filter((_, i) => 
            i > body.itemIndex && job.results[i].needsReview
          ).length
        }
      }
    };
  } else {
    // Reject: log for analysis, don't create item
    context.log('Item rejected:', item);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          remainingReviews: job.results.filter((_, i) => 
            i > body.itemIndex && job.results[i].needsReview
          ).length
        }
      }
    };
  }
}
```

**Acceptance Criteria:**
- Accept creates Item + Transaction atomically
- Edit applies changes before creating Item
- Reject logs for analysis but doesn't create Item
- Returns remaining review count
- Updates normalization cache for high-confidence items

**Owner:** Backend Engineer  
**Deadline:** Week 2  

#### 3. Prediction Override Endpoint
**What's Missing:** `POST /api/predictions/override`  
**Why Critical:** Users cannot adjust predictions; no ground truth for model tuning  
**Action Required:**
```typescript
// backend/src/functions/predictions/override.ts
interface PredictionOverride {
  itemId: string;
  originalPrediction: string; // ISO date
  userPrediction: string; // ISO date
  reason?: 'going_on_vacation' | 'buying_elsewhere' | 'changed_habit' | 'other';
}

export async function overridePrediction(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const { userId, householdId } = await validateToken(request);
  const body = await request.json() as PredictionOverride;
  
  // Get item
  const item = await cosmosDb.getItem('items', body.itemId, householdId);
  if (!item) {
    return { status: 404, jsonBody: { success: false, error: { code: 'ITEM_NOT_FOUND' } } };
  }
  
  // Add override to history
  const override = {
    date: new Date().toISOString(),
    originalPrediction: body.originalPrediction,
    userPrediction: body.userPrediction,
    reason: body.reason || 'other'
  };
  
  const userOverrides = [...(item.userOverrides || []), override];
  
  // Update item with new prediction
  await cosmosDb.updateItem('items', body.itemId, householdId, {
    predictedRunOutDate: body.userPrediction,
    userOverrides,
    updatedAt: new Date().toISOString()
  });
  
  // Log override for model retraining
  await cosmosDb.createItem('events', {
    id: uuidv4(),
    householdId,
    userId,
    type: 'prediction_override',
    eventType: 'prediction_override',
    timestamp: new Date().toISOString(),
    metadata: {
      itemId: body.itemId,
      originalPrediction: body.originalPrediction,
      userPrediction: body.userPrediction,
      reason: body.reason,
      daysDifference: Math.round(
        (new Date(body.userPrediction).getTime() - new Date(body.originalPrediction).getTime()) / (1000 * 60 * 60 * 24)
      )
    },
    ttl: 90 * 24 * 60 * 60 // 90 days
  });
  
  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        itemId: body.itemId,
        newPrediction: body.userPrediction
      }
    }
  };
}
```

**Acceptance Criteria:**
- Stores override in item's `userOverrides` array
- Updates `predictedRunOutDate` immediately
- Logs event for analytics and model retraining
- Returns new prediction to frontend

**Owner:** Backend Engineer  
**Deadline:** Week 2  

---

## 🟡 Authentication & Security (Priority 1 - Week 1)

### JWT Validation Middleware
**Current State:** Stub function `validateToken(request)` returns mock data  
**Required Implementation:**
```typescript
// backend/src/middleware/auth.ts
import { HttpRequest } from '@azure/functions';
import { verify, JwtPayload } from 'jsonwebtoken';

interface AuthContext {
  userId: string;
  householdId: string;
  email: string;
  roles: string[];
}

export async function validateToken(request: HttpRequest): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  
  const token = authHeader.substring(7);
  
  try {
    // For Entra ID, verify JWT signature using public keys from Microsoft
    // https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys
    const decoded = verify(token, process.env.ENTRA_PUBLIC_KEY!, {
      audience: process.env.ENTRA_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`
    }) as JwtPayload;
    
    // Extract claims
    const userId = decoded.sub || decoded.oid; // Object ID from Entra
    const email = decoded.email || decoded.preferred_username;
    const roles = decoded.roles || ['member']; // Default to member if no roles
    
    // Get or create householdId
    // For Phase 1 (single-user), use userId as householdId
    // For Phase 2+, query households container
    const householdId = userId; // Simplified for Phase 1
    
    return {
      userId,
      householdId,
      email,
      roles
    };
    
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Error handler wrapper
export function withAuth(handler: Function) {
  return async (request: HttpRequest, context: InvocationContext) => {
    try {
      const authContext = await validateToken(request);
      // Inject authContext into request
      (request as any).auth = authContext;
      return await handler(request, context);
    } catch (error: any) {
      context.error('Auth error:', error);
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required'
          }
        }
      };
    }
  };
}
```

**Integration:**
```typescript
// Update all function registrations
app.http('parseCSV', {
  methods: ['POST'],
  authLevel: 'function',
  handler: withAuth(parseCSV)
});
```

**Acceptance Criteria:**
- Verifies JWT signature using Entra ID public keys
- Extracts userId, email, roles from token claims
- Returns 401 for invalid/missing tokens
- Injects auth context into request object
- All endpoints protected (no anonymous access)

**Owner:** Backend Engineer  
**Deadline:** Week 1 (blocks all other work)  

---

## 🟡 Cache Partition Key Fix (Priority 1 - Week 1)

### Issue
**Problem:** Normalization cache uses `householdId: 'global'` but containers partitioned by `/householdId`  
**Impact:** Cross-partition queries, cache misses, TTL issues  

**Solution:**
```typescript
// backend/src/services/normalizationCache.ts (REVISED)
export interface CacheEntry {
  id: string; // hash of rawText
  householdId: string; // FIX: Use 'global' for shared cache entries
  type: 'normalization' | 'sku_mapping'; // FIX: Add type discriminator
  rawText: string;
  canonicalName: string;
  brand?: string;
  category: string;
  unitOfMeasure: string;
  unitSize: number;
  retailer?: string;
  confidence: number;
  hitCount: number;
  lastAccessed: string;
  createdAt: string;
  ttl: number;
}

// Update queries to filter by type
async get(rawText: string, retailer?: string): Promise<CacheEntry | null> {
  const key = this.generateKey(rawText, retailer);
  
  // Memory cache first
  const memoryHit = this.memoryCache.get(key);
  if (memoryHit) return memoryHit;
  
  // Cosmos DB with correct partition key
  try {
    const dbHit = await cosmosDb.getItem<CacheEntry>('cache', key, 'global'); // Use 'global' partition
    if (dbHit && dbHit.type === 'normalization') { // FIX: Filter by type
      // ... rest of logic
    }
  } catch (error) {
    console.error('Cache lookup error:', error);
  }
  
  return null;
}

async set(entry: Omit<CacheEntry, 'id' | 'hitCount' | 'createdAt' | 'lastAccessed' | 'ttl' | 'householdId' | 'type'>): Promise<void> {
  const key = this.generateKey(entry.rawText, entry.retailer);
  
  const cacheEntry: CacheEntry = {
    ...entry,
    id: key,
    householdId: 'global', // FIX: All cache entries use 'global' partition
    type: 'normalization', // FIX: Add type
    hitCount: 1,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    ttl: this.CACHE_TTL
  };
  
  await cosmosDb.createItem('cache', cacheEntry);
  this.addToMemoryCache(key, cacheEntry);
}

async preloadTopItems(limit: number = 1000): Promise<void> {
  const query = `
    SELECT * FROM c
    WHERE c.householdId = @householdId
    AND c.type = @type
    ORDER BY c.hitCount DESC, c.lastAccessed DESC
    OFFSET 0 LIMIT @limit
  `;
  
  const entries = await cosmosDb.queryItems<CacheEntry>('cache', query, [
    { name: '@householdId', value: 'global' }, // FIX: Query global partition
    { name: '@type', value: 'normalization' },
    { name: '@limit', value: limit }
  ]);
  
  // ... rest of logic
}
```

**Acceptance Criteria:**
- All cache entries use `householdId: 'global'`
- All cache entries include `type: 'normalization'`
- Queries filter by both partition key and type
- No cross-partition queries
- TTL auto-deletes work correctly

**Owner:** Backend Engineer  
**Deadline:** Week 1  

---

## 🟠 Frontend UX Gaps (Priority 2 - Week 2-3)

### 1. CSV → Teach Mode Pivot Flow
**What's Missing:** "While you wait" Teach Mode screen after Amazon CSV request  
**UX Spec Reference:** Section 11.2 Onboarding Flow  

**Required Components:**
```typescript
// frontend/src/pages/onboarding/CSVWaitPivot.tsx
export function CSVWaitPivot() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Your report will arrive in 5-10 minutes</h2>
        <p className="text-gray-600">
          We'll notify you when it's ready to upload.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">
          ⚡ Get predictions now! Add your 3 most frequent items
        </h3>
        <TeachModeQuickEntry maxItems={3} onComplete={() => {
          // Show success + persistent banner for CSV upload
          toast.success('Great! You'll get predictions for these items immediately.');
        }} />
      </div>
      
      <div className="text-center">
        <button onClick={() => navigate('/home')} className="text-blue-600 underline">
          Skip for now, I'll wait for the CSV
        </button>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- Displayed immediately after "Open Amazon" → user requests CSV
- Chip-based Teach Mode for 3 items (milk, eggs, bread pre-suggested)
- Generates predictions immediately
- Adds persistent Home banner: "Your CSV is ready! Upload now →"
- User can skip and wait

**Owner:** Frontend Engineer  
**Deadline:** Week 2  

### 2. Micro-Review Pause/Resume
**What's Missing:** Pause button, progress persistence, resume banner  
**UX Spec Reference:** Section 3.4 Micro-Review (Pause/Resume Flow)  

**Required Changes:**
```typescript
// frontend/src/components/parsing/MicroReview.tsx
export function MicroReview({ jobId, onComplete }: MicroReviewProps) {
  const [isPaused, setIsPaused] = useState(false);
  const { data: job, refetch } = useParseJob(jobId);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const handlePause = () => {
    // Save progress to localStorage
    localStorage.setItem(`review_progress_${jobId}`, JSON.stringify({
      currentIndex,
      timestamp: Date.now()
    }));
    setIsPaused(true);
    onComplete?.();
  };
  
  const handleResume = () => {
    // Load progress from localStorage
    const saved = localStorage.getItem(`review_progress_${jobId}`);
    if (saved) {
      const { currentIndex } = JSON.parse(saved);
      setCurrentIndex(currentIndex);
    }
    setIsPaused(false);
  };
  
  if (isPaused) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <h3 className="font-semibold mb-2">Review paused</h3>
          <p className="text-sm text-gray-600 mb-4">
            {currentIndex} of {job.results.length} items reviewed and saved.
            You can finish the rest anytime.
          </p>
          <div className="flex gap-3">
            <button onClick={handleResume} className="btn-primary">Resume Review</button>
            <button onClick={onComplete} className="btn-outline">Finish Later</button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
      {/* Header with pause button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Review Item {currentIndex + 1} of {job.results.length}</h3>
        <button onClick={handlePause} className="text-sm text-gray-600 hover:text-gray-900">
          ⏸ Pause
        </button>
      </div>
      
      {/* Item review content */}
      {/* ... existing review UI ... */}
    </div>
  );
}

// Add persistent banner component
// frontend/src/components/home/ReviewBanner.tsx
export function ReviewReminderBanner() {
  const pendingReviews = usePendingReviews(); // Hook to check localStorage + API
  
  if (pendingReviews.length === 0) return null;
  
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">📋 {pendingReviews[0].remaining} items still need review</h4>
          <p className="text-sm text-gray-600">You paused the review for "{pendingReviews[0].source}"</p>
        </div>
        <button 
          onClick={() => navigate(`/import/review/${pendingReviews[0].jobId}`)}
          className="btn-primary"
        >
          Resume →
        </button>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- Pause button visible in review UI
- Progress saved to localStorage (survives page refresh)
- Banner appears on Home until queue completed
- Resume loads correct item index
- User can dismiss banner ("Finish Later")

**Owner:** Frontend Engineer  
**Deadline:** Week 3  

### 3. Confidence Coach Panel
**What's Missing:** Household prediction health widget  
**UX Spec Reference:** Section 3.1 Home Dashboard (Confidence Coach)  

**Implementation:** Add to Home dashboard (see UX Spec for full design)

**Owner:** Frontend Engineer  
**Deadline:** Week 3  

---

## 🟠 Testing & Quality Gates (Priority 2 - Week 3-4)

### 1. Coverage Thresholds
**Action Required:** Add to CI/CD pipeline
```yaml
# .github/workflows/ci.yml
- name: Run tests with coverage
  run: |
    npm test -- --coverage --coverageThreshold='{
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      },
      "src/services/costTracking.ts": {
        "functions": 90,
        "lines": 90
      },
      "src/utils/unitNormalizer.ts": {
        "functions": 90,
        "lines": 90
      },
      "src/services/predictionEngine.ts": {
        "functions": 90,
        "lines": 90
      }
    }'
```

**Acceptance Criteria:**
- Global coverage ≥80%
- Critical services ≥90%
- CI fails below thresholds

**Owner:** DevOps  
**Deadline:** Week 3  

### 2. Unit Normalization Test Harness Gate
**Action Required:** Add 1000 SKU test dataset and enforce pass rate
```typescript
// backend/tests/unit/unitNormalizer.1000SKUs.test.ts
import { testCases } from '../fixtures/1000-skus.json';

describe('Unit Normalizer - 1000 SKU Test Harness', () => {
  it('achieves >90% success rate on 1000 SKUs', async () => {
    let successes = 0;
    let failures = 0;
    
    for (const testCase of testCases) {
      const result = await unitNormalizer.normalize(
        testCase.quantity,
        testCase.unit,
        { rawText: testCase.rawText, retailer: testCase.retailer }
      );
      
      if (result.confidence >= 0.8) {
        successes++;
      } else {
        failures++;
        console.log(`Failed: ${testCase.rawText} (confidence: ${result.confidence})`);
      }
    }
    
    const successRate = successes / testCases.length;
    expect(successRate).toBeGreaterThanOrEqual(0.9);
  });
});
```

**Acceptance Criteria:**
- 1000 SKU dataset includes edge cases (family size, 2 for $5, oz vs fl oz)
- Test runs in CI
- >90% success rate required to pass
- Failures logged for analysis

**Owner:** AI/ML Engineer  
**Deadline:** Week 4  

---

## 🟢 Documentation & Constants (Priority 3 - Week 4)

### 1. Centralize Cost Model
**Action Required:** Create single source of truth for LLM pricing

```typescript
// shared/constants/llmPricing.ts
export const LLM_PRICING = {
  provider: 'Google Gemini',
  model: '2.0-flash-exp', // Update to match actual model used
  version: 'November 2025',
  pricing: {
    inputTokenCost: 0.35 / 1_000_000, // $0.35 per 1M tokens
    outputTokenCost: 1.05 / 1_000_000, // $1.05 per 1M tokens
    visionTokenCost: 0.25 / 1_000, // $0.25 per 1K images (258 tokens/image)
  },
  budgets: {
    userMonthly: 0.20, // Phase 1-2 target
    userMonthlyOptimized: 0.10, // Phase 3+ target
    systemDaily: 50.00, // Hard cap
    alertThreshold: 35.00, // 70% of daily cap
  },
  assumptions: {
    cacheHitRate: {
      phase1: 0.35, // 35% (conservative)
      phase2: 0.50, // 50% (with user corrections)
      phase3: 0.70, // 70% (mature cache)
    },
    avgOperationsPerUser: {
      csvImport: 2, // Per month
      photoOCR: 5, // Per month
      emailParsing: 10, // Per month
    },
  },
};

// Remove contradictory examples from docs
```

**Acceptance Criteria:**
- Single source of truth referenced by all code
- No conflicting pricing numbers in docs
- Versioned for auditing

**Owner:** Product Manager + AI/ML Engineer  
**Deadline:** Week 4  

### 2. Cost Simulator Spreadsheet
**Action Required:** Build Google Sheet with scenario modeling

**Columns:**
- User count
- Operations per user (CSV, photo, email)
- Cache hit rate (%)
- Tokens per operation
- Total cost
- Cost per user

**Scenarios:**
- Best case ($0.10/user)
- Expected ($0.20/user)
- Worst case ($0.30/user)
- Catastrophic (>$0.40/user)

**Owner:** Product Manager  
**Deadline:** Week 1 (before any dev work)  

---

## 📊 A/B Test Instrumentation (Priority 2 - Week 3)

### Micro-Review Variants
**Required Events:**
```typescript
// shared/types/analytics.ts
export type MicroReviewEvent = 
  | { type: 'micro_review_started', variant: '2-tap' | '3-tap', jobId: string, itemCount: number }
  | { type: 'micro_review_item_viewed', variant: string, itemIndex: number, confidence: number }
  | { type: 'micro_review_accepted', variant: string, timeSpent: number }
  | { type: 'micro_review_edited', variant: string, fieldsEdited: string[], timeSpent: number }
  | { type: 'micro_review_rejected', variant: string, timeSpent: number }
  | { type: 'micro_review_skipped', variant: string }
  | { type: 'micro_review_paused', variant: string, itemsCompleted: number, itemsRemaining: number }
  | { type: 'micro_review_completed', variant: string, totalTime: number, acceptRate: number };
```

**Feature Flag:**
```typescript
// frontend/src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  microReviewVariant: {
    enabled: true,
    variants: {
      '2-tap': 0.5, // 50% of users
      '3-tap': 0.5,
    },
  },
};

// Usage
export function useMicroReviewVariant() {
  const userId = useAuthStore(state => state.user?.id);
  const variant = useMemo(() => {
    // Deterministic assignment based on userId hash
    const hash = hashString(userId || '');
    return hash % 2 === 0 ? '2-tap' : '3-tap';
  }, [userId]);
  
  return variant;
}
```

**Success Metrics to Track:**
- Completion rate (items accepted + rejected / total items)
- Average time per item
- Edit rate (edits / total items)
- Drop-off rate (paused or abandoned / total)

**Decision Criteria:**
- Choose variant with higher completion rate AND lower average time
- Run for 2 weeks with ≥100 users per variant

**Owner:** Product Manager + Frontend Engineer  
**Deadline:** Week 3  

---

## 🔒 Privacy & Compliance (Priority 2 - Week 4-6)

### 1. Settings > Privacy UI
**Required Components:**
```typescript
// frontend/src/pages/settings/Privacy.tsx
export function PrivacySettings() {
  const [retentionPeriod, setRetentionPeriod] = useState<7 | 30 | 90 | 'never'>(7);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'Are you sure? This will permanently delete all your data within 48 hours. This cannot be undone.'
    );
    
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      await api.delete('/users/me/data');
      toast.success('Data deletion initiated. You will be logged out in 5 seconds.');
      setTimeout(() => {
        authStore.logout();
      }, 5000);
    } catch (error) {
      toast.error('Failed to initiate data deletion. Please contact support.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Privacy Settings</h1>
      
      <div className="space-y-6">
        {/* Retention Period */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Receipt Storage</h2>
          <p className="text-sm text-gray-600 mb-4">
            How long should we keep raw receipt photos and emails?
          </p>
          <select 
            value={retentionPeriod}
            onChange={(e) => setRetentionPeriod(e.target.value as any)}
            className="form-select"
          >
            <option value={7}>Delete after 7 days</option>
            <option value={30}>Delete after 30 days</option>
            <option value={90}>Delete after 90 days</option>
            <option value="never">Never delete (keep forever)</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Extracted data (items, prices) is always kept for predictions.
          </p>
        </div>
        
        {/* Gmail OAuth Control */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Gmail Receipt Scanning</h2>
          <p className="text-sm text-gray-600 mb-4">
            Status: {gmailConnected ? 'Connected' : 'Not connected'}
          </p>
          {gmailConnected && (
            <button onClick={handleDisconnectGmail} className="btn-outline-red">
              Disconnect Gmail
            </button>
          )}
        </div>
        
        {/* Data Export */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Export Your Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Download all your items, purchases, and predictions as CSV.
          </p>
          <button onClick={handleExport} className="btn-outline">
            Export Data
          </button>
        </div>
        
        {/* Delete All Data */}
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h2 className="font-semibold text-red-900 mb-2">Delete All Data</h2>
          <p className="text-sm text-gray-700 mb-4">
            Permanently delete your account and all associated data.
            This includes items, purchases, predictions, and receipts.
          </p>
          <button 
            onClick={handleDeleteAllData}
            disabled={isDeleting}
            className="btn-danger"
          >
            {isDeleting ? 'Deleting...' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Backend Endpoint:**
```typescript
// backend/src/functions/users/deleteAllData.ts
export async function deleteAllData(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const { userId, householdId } = await validateToken(request);
  
  // Soft delete all data (set deletedAt, actual deletion after 48h grace period)
  const deletionJob = {
    id: uuidv4(),
    householdId,
    userId,
    type: 'data_deletion',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
    ttl: 30 * 24 * 60 * 60 // 30 days retention for audit
  };
  
  await cosmosDb.createItem('jobs', deletionJob);
  
  // Revoke all sessions
  // ... invalidate tokens ...
  
  return {
    status: 202,
    jsonBody: {
      success: true,
      data: {
        message: 'Data deletion scheduled',
        scheduledAt: deletionJob.scheduledAt,
        gracePeriodHours: 48
      }
    }
  };
}

// Scheduled function to execute deletions
// Runs every 6 hours, checks for pending deletions past scheduledAt
export async function processDeletionQueue(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const query = `
    SELECT * FROM c
    WHERE c.type = @type
    AND c.status = @status
    AND c.scheduledAt <= @now
  `;
  
  const pendingDeletions = await cosmosDb.queryItems('jobs', query, [
    { name: '@type', value: 'data_deletion' },
    { name: '@status', value: 'pending' },
    { name: '@now', value: new Date().toISOString() }
  ]);
  
  for (const job of pendingDeletions) {
    try {
      // Delete from all containers
      await Promise.all([
        cosmosDb.deleteByHousehold('items', job.householdId),
        cosmosDb.deleteByHousehold('transactions', job.householdId),
        cosmosDb.deleteByHousehold('parseJobs', job.householdId),
        cosmosDb.deleteByHousehold('events', job.householdId),
      ]);
      
      // Delete Blobs
      await blobService.deleteContainerPrefix(`receipts/${job.householdId}`);
      await blobService.deleteContainerPrefix(`csv-imports/${job.householdId}`);
      
      // Mark job as completed
      await cosmosDb.updateItem('jobs', job.id, job.householdId, {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      
      context.log(`Deletion completed for household ${job.householdId}`);
      
    } catch (error) {
      context.error(`Deletion failed for household ${job.householdId}:`, error);
      await cosmosDb.updateItem('jobs', job.id, job.householdId, {
        status: 'failed',
        error: error.message
      });
    }
  }
}
```

**Acceptance Criteria:**
- Settings UI allows retention period selection
- One-click data deletion initiates 48h grace period
- Scheduled job executes cascading deletions
- User receives confirmation email
- Blobs and Cosmos records deleted

**Owner:** Full Stack Engineer + Legal review  
**Deadline:** Week 6  

---

## Summary Action Items for Next Week

### Week 1 Priorities (Blockers)
1. ✅ Fix critical bugs (completed above)
2. 🔴 Implement JWT validation middleware
3. 🔴 Fix cache partition key strategy
4. 🔴 Add parse job polling endpoint
5. 🔴 Create cost model constants document
6. 🔴 Build cost simulator spreadsheet

### Week 2 Priorities
1. Add micro-review submission endpoint
2. Add prediction override endpoint
3. Implement CSV → Teach Mode pivot UI
4. Add micro-review pause/resume
5. Set up A/B test instrumentation

### Week 3-4 Priorities
1. Add CI coverage thresholds
2. Create 1000 SKU test harness
3. Build Confidence Coach panel
4. Implement observability dashboards
5. Add operational runbooks

### Week 5-6 Priorities
1. Implement privacy settings UI
2. Build data deletion endpoint
3. Gmail OAuth verification collateral
4. Security audit preparation
5. Production deployment checklist

---

**Assessment:** Copilot's feedback is exceptionally thorough and actionable. Prioritizing authentication, cache fixes, and missing endpoints will unblock all subsequent work and prevent costly rework.
