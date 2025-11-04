# Kirana MVP PRD

## 1. Introduction & Core Loop
**Project Name:** Kirana
**Document Version:** 1.0 (Web-First, Engineering-Ready MVP)  

**Core Problem:**  
Households struggle with inventory management, resulting in run-outs, redundant purchases, and missed savings opportunities.

**Core Value Proposition (MVP):**  
Kirana provides the simplest path from “I’m running low” to “It’s reordered at the best time/price,” all accessible via web first.

**Kirana MVP Core Loop (P0):**  
- **Data Ingestion (P1):** CSV import (primary), demo mode with pre-populated predictions, photo receipt OCR, and manual item entry. Email forwarding available as opt-in for beta validation.  
- **Prediction (P1):** Quantity-aware Predicted Run-Out Dates using exponential smoothing with frequency and consumption signals. Smart Shopping Assistant (Teach Mode) enables immediate value before historical data accumulates.  
- **Action (P1.5):** Inline micro-reviews for data validation (2-tap vs. 3-tap A/B test); alerts deferred to Phase 2 after prediction trust is validated.

---

## 2. Success Metrics & Acceptance Criteria

### 2.1 Key Goals (Success Metrics)

| Metric   | Phase 1-2 Target (Beta) | Phase 3+ Target (Scale) | Measurement Method                         |
|----------|-------------------------|-------------------------|--------------------------------------------|
| Retention| 30% 30-day retention | 50% 30-day, 40% 90-day | User sign-in rate after 30/90 days from first use |
| Engagement | 40% weekly active users (WAU) | 60% WAU | Users who open app at least once per week |
| Utility  | ≥1 item prevented from running out per household/month | ≥2 items | Track prediction → item added to list → purchase logged |
| Savings  | N/A (Phase 2+ only) | $10+ average savings/month | Compare purchase price post-alert vs. 90-day rolling average price |
| Time-to-Value | <2 minutes to see demo predictions, <5 min to first real item | <3 minutes | Track: signup → demo mode (30 sec) → CSV upload → first item with prediction |
| Trust Score | <40% prediction override rate (Phase 2+ only) | <30% override rate | Users manually overriding predicted run-out dates |
| Prediction Coverage | ≥50% items with Medium/High confidence (Phase 2A) | ≥70% coverage | (# items with ≥Medium confidence) / (# total active items) |

### 2.2 Leading Indicators (Track Weekly)

**Phase 1-2 Core KPIs (Focus on these first):**

| KPI | Healthy Range | Red Flag Threshold | Action if Below |
|-----|---------------|--------------------|--------------------|
| **Time-to-Value** (signup → demo mode → first real item) | <2 min to demo, <5 min to first item | >8 min total | Simplify CSV import flow; improve demo mode; reduce friction |
| **Prediction Coverage** (% items with ≥Medium confidence) | ≥50% (Phase 2A), ≥70% (Phase 3) | <40% (Phase 2A), <60% (Phase 3) | Investigate data ingestion; relax thresholds; improve CSV import adoption |
| **Prediction Accuracy** (±5 days for 70% of items with ≥3 purchases) | ≥70% | <60% | Investigate data quality; adjust formula; improve exponential smoothing |
| **LLM Cost per User** | <$0.20/month (Phase 1-2), <$0.10/month (Phase 3+) | >$0.30/month | Switch to open-source model; expand cache; reduce parsing frequency; negotiate pricing |
| **30-Day Retention** | ≥30% (Phase 1-2), ≥50% (Phase 3+) | <25% (Phase 1-2), <40% (Phase 3+) | User interviews to find drop-off reasons; improve core value prop |
| **Operational LLM Budget** | <$50/day (dashboard monitored) | >$75/day | Automatic degradation to queue-based processing (NOT fuzzy matching); throttle per-user API calls |

**Phase 3+ Additional KPIs (Add after core loop validated):**

| KPI | Healthy Range | Red Flag Threshold | Action if Below |
|-----|---------------|--------------------|--------------------|
| **Inline micro-review completion rate** | ≥70% | <50% | A/B test: 2-tap (Accept/Reject) vs. 3-tap (Accept/Edit/Reject); limit queue to 3 items max |
| **Average time per micro-review** | <30 sec/item | >1 min | Simplify UI; pre-populate with high-confidence suggestions |
| **Receipt parsing success rate** (photo OCR) | ≥70% (Phase 1-2), ≥80% (Phase 3) | <60% | Add dedicated parser for problem retailer; surface errors to engineering team |
| **Prediction confidence distribution** | ≥30% High confidence (≥3 purchases) | <20% High | Investigate: Are users using CSV import? Is Smart Shopping Assistant (Teach Mode) working? |
| **Alert click-through rate** (Phase 2+ only) | ≥15% | <8% | Reduce alert frequency; improve notification copy; add price comparison context |

### 2.2 Acceptance Criteria (MVP Features)

| Feature                 | Acceptance Criteria                                                  |
|-------------------------|----------------------------------------------------------------------|
| Demo Mode (P0)          | Show 5-10 pre-populated items with sample predictions during onboarding; user sees value in <30 seconds; CTA prompts CSV upload |
| CSV Import (P0)         | Accept Amazon order history CSV format; parse item, price, quantity, date with ≥95% success rate; primary onboarding path |
| Smart Shopping Assistant (P0) | Users can set expected restock dates for items (Teach Mode); system converts to predictions; provides immediate value before historical data accumulates |
| Item Normalization (LLM)| ≥85% accuracy mapping raw receipt line items to canonical Master List on test set of 1,000 SKUs; ≥95% after crowdsourced corrections (Phase 2)|
| Prediction Accuracy     | ±5 days Predicted Run-Out Date for ≥70% of recurring items with **≥3 purchases** in holdout test set (relaxed from ≥5); show confidence scores with explanatory tooltips|
| Prediction Coverage     | ≥50% of active items have Medium/High confidence predictions by Phase 2A; ≥70% by Phase 3 |
| Family Sync             | List changes propagate to all devices within 5-15 minutes (scheduled background sync); acceptable latency for MVP cost optimization; deferred to Phase 2 if conflicts arise|
| Photo Receipt OCR       | Successfully parse ≥70% of receipts from 2 major retailers (Amazon, Costco) in Phase 1-2; ≥80% by Phase 3 using Gemini Vision; remaining items sent to inline micro-review |
| Gmail OAuth (Phase 2)   | Gmail API connection seeds inventory from last 90 days; explicit opt-in consent with plain-language privacy policy; requires Google verification completion |
| PWA Compliance          | Responsive web app works on desktop, tablet, mobile; service worker enables offline caching; push notifications (Phase 2+) |
| LLM Cost Containment    | Operational budget cap at $50/day with real-time dashboard; automatic degradation to queue-based processing (NOT fuzzy matching) if exceeded; per-user throttle at $0.20/month in Phase 1-2, $0.10/month in Phase 3+ |

---

## 3. Top User Stories

| Priority | User Role          | Goal                          | Rationale                      |
|----------|--------------------|-------------------------------|--------------------------------|
| P1       | New User           | Quickly seed shopping history | Cold start mitigation; immediate value |
| P1       | Shopper/Member     | Add items on-the-go via one-tap| Core loop / One-Tap Restock     |
| P2       | Budget Planner/Admin| Alerts for historic low prices| Smart Alerting / cost savings   |
| P2       | Shopper/Member     | Filter list for local store   | Vendor-Specific Quick-Trip      |
| P2       | Shopper/Member     | Access inventory offline      | Web-first PWA supports offline caching |

---

## 4. Feature Details & Requirements

### 4.1 Core Master List & Predictive Engine (P1)  
- **Item Normalization:** 
  - **Hybrid approach:** Deterministic regex parsing for structured retailers (Amazon, Costco) → fallback to Gemini 2.5 Flash for unstructured receipts
  - Cache common normalizations (top 1000 items: milk, eggs, bread, etc.) to reduce API calls; conservative cache hit rate assumption: 30-40% in early beta
  - **Confidence threshold:** Only auto-add items with ≥80% LLM confidence; lower confidence → inline micro-review
  - Crowdsourced correction system: users validate/fix mappings via inline micro-review (2-tap vs. 3-tap A/B test in Phase 1); corrections shared anonymously across all users
  - **Queue-based degradation (NOT fuzzy matching):** If LLM quota exceeded, items go to "Processing Queued" state with user notification: "Receipt queued for overnight processing due to high demand"; protects data quality by never falling back to low-quality fuzzy matching
  - **Per-user LLM budget cap:** $0.20/month in Phase 1-2 (≈400 API calls); $0.10/month target in Phase 3+; excess receipts queued for overnight batch processing
  - **Operational budget gate:** $50/day hard limit with automatic degradation to queue-based processing; real-time cost dashboard required
  
- **Prediction Model (Quantity-Aware with Exponential Smoothing):**

  **Base Formula:**
  \[
  \text{runOutEstimate} = \text{lastPurchaseDate} + \left(\text{smoothedDaysBetweenPurchases} \times \frac{\text{lastPurchaseQuantity}}{\text{smoothedPurchaseQuantity}}\right)
  \]

  **Exponential Smoothing (α = 0.3 for stability):**
  \[
  \text{smoothedDaysBetweenPurchases} = α \times \text{actualDays} + (1 - α) \times \text{previousSmoothedDays}
  \]

  - **Confidence Score Logic (Relaxed for Cold Start):**
    - **High (≥80%):** **≥3 purchases** (relaxed from ≥5), consistent frequency (std dev <20% of mean), recent purchase (<30 days)
    - **Medium (50-79%):** 2 purchases with moderate frequency variation
    - **Low (<50%):** 1 purchase or irregular pattern; show "Building history... Add more purchases to improve accuracy"
  - Show confidence score with tooltip explaining factors (e.g., "High confidence: 5 purchases over 4 months, consistent buying pattern")
  - User overrides are recorded as training data; if override frequency >30%, model recalibrates per-item
  - **Smart Shopping Assistant / "Teach Mode" (P0 — Critical for immediate value):** 
    - Reframed from "fallback" to "core feature" enabling cold start solution
    - Onboarding prompt: "How often do you buy milk? [Weekly / Bi-weekly / Monthly]"
    - System converts user input to predicted run-out dates
    - Provides immediate value (smart shopping list) before historical purchase data accumulates
    - User-set dates serve as ground truth for model training and accuracy benchmarking
  - **Holdout test set:** Reserve 20% of historical purchases for validation; do not expose predictions to users until ±5 day accuracy achieved on test set
  
- **One-Tap Restock:** Web PWA button or shortcut; supports 4–6 user-defined favorite items (auto-populated from most frequently purchased items).

### 4.2 Data Ingestion & Error Handling (P1)  
- **RetailerConnector Interface:** Abstract layer for CSV/photo/email parser plugins; enables adding new retailers without core code changes.

- **Phase 1 Input Methods (Priority Order — CRITICAL FOR COLD START):**
  
  0. **Demo Mode (P0 — FIRST touchpoint, <30 seconds to value):**
     - Show 5-10 pre-populated common items (milk, eggs, bread, butter, coffee) with SAMPLE predictions during onboarding
     - Display "High confidence: Next restock in 3 days" for milk, etc.
     - Purpose: User sees the "magic" immediately before committing any data
     - CTA: "Upload your Amazon order history to see real predictions" (big button)
     - Builds trust and motivates data entry
  
  1. **CSV Import (P0 — PRIMARY onboarding path, 2-minute time-to-value):**
     - **Prominent onboarding flow:** "Connect Amazon" (OAuth) or "Upload Amazon order history CSV" (first screen after demo)
     - Accept Amazon order history CSV format (downloadable from amazon.com/order-history)
     - Parse columns: Order Date, Item Name, Price, Quantity
     - ≥95% success rate required on test dataset before enabling
     - Preview UI shows parsed items before import
     - **Why primary:** Gives 50-200 items instantly; many with 2-5+ purchases for Medium/High confidence predictions
     - Amazon has 230M+ US customers; massive TAM
  
  2. **Smart Shopping Assistant / Teach Mode (P0 — SECONDARY path for immediate value):**
     - Onboarding prompt after demo mode: "Don't have Amazon? No problem! Tell us when you usually restock items"
     - For each common item: "How often do you buy [milk]? [Weekly / Bi-weekly / Monthly / Custom]"
     - System converts to predicted run-out dates (e.g., "Weekly" → run-out date = last purchase + 7 days)
     - User gets immediate value (smart shopping list with predictions) without historical data
     - Serves as ground truth training data for exponential smoothing model
  
  3. **Photo Receipt OCR (P1 — TERTIARY for power users):**
     - Gemini Vision API multimodal prompt: "Extract structured data from this receipt: items (with variants/brands), prices, quantities, date, and retailer name. Return JSON."
     - Start with 2 retailers (Amazon packing slips, Costco receipts) for validation
     - Confidence threshold: Only auto-add items with ≥80% LLM confidence; rest go to inline micro-review
     - Store raw photo in Azure Blob; structured data in Cosmos DB with Blob URI reference
     - Parsing success target: ≥70% in Phase 1-2, ≥80% in Phase 3
  
  4. **Manual Item Entry (P1 — LAST RESORT for one-offs):**
     - Single-item add with quantity, price, date, retailer fields
     - Auto-complete from canonical item list (cached top 1000 items)
     - De-emphasized in onboarding (not shown until user explicitly asks or completes CSV/Teach Mode)
  
  4. **Email Forwarding (P1 — Opt-in Beta Validation):**
     - User forwards receipts to `receipts@kirana.app` → Azure Functions → same OCR/LLM pipeline as photo upload
     - Dedicated regex parser per major retailer (Amazon, Costco) with fallback to generic LLM parser
     - **Explicit consent UI:** "Email forwarding is experimental. We'll extract purchase data and delete the original email within 30 days. [Learn more about privacy]"
     - **Silent Failure Detection (Critical):** 
       - Monitor parsing success rate per retailer in real-time (Azure Application Insights)
       - Alert engineering team if success rate drops >15% for any retailer within 24 hours
       - Automatic in-app notification to affected users: "We detected an issue with [Retailer] receipts. Use photo upload or manual entry until resolved."
       - Store raw email HTML for failed parses to enable rapid debugging
       - Quarterly "canary receipts" - automated testing with sample receipts from each major retailer

- **Inline Micro-Review UX (P1 — Replaces Batch Queue with A/B Test):**
  - **Design:** Single-item toast notification appears immediately after parsing: "Confirm 1 item: **Organic Whole Milk (365, 1 gal)**"
  - **A/B Test in Phase 1 Internal (choose winner for Phase 2):**
    - **Variant A (2-tap):** ✅ Accept / ❌ Reject (tap item name for inline quick-edit modal with quantity/price/date)
    - **Variant B (3-tap):** ✅ Accept / ✏️ Edit / ❌ Reject (explicit edit button)
  - **Hypothesis:** 2-tap reduces friction; edit is rare edge case that doesn't need prominent button
  - **Queue limit:** Max 3 unreviewed items; pause new receipt processing if exceeded
  - **Progressive disclosure:** Multi-item receipts show one toast at a time (not 20-40 consecutive notifications)
  - **No gamification:** Users are not incentivized to review; it's a natural part of data validation
  - User corrections are shared anonymously across platform (crowdsourced training data with explicit consent)
  - **Weekly surveys (Phase 2):** "Was the review process easy?" to validate UX

- **Gmail OAuth Integration (Phase 2A — Fast Follow-Up):**
  - **Prerequisites:** 
    - Gmail API verification completed (start process in Phase 1 Week 1)
    - Privacy policy and consent UI finalized
    - Phase 1 prediction model validated (override rate <40%)
  - **Scope:** `gmail.readonly` (scan only, no modification)
  - **Onboarding flow:**
    1. User clicks "Connect Gmail" → OAuth consent screen with plain-language privacy policy
    2. Explicit opt-in: "Scan my inbox for receipts from [Amazon, Costco, Walmart]? You can disconnect anytime."
    3. One-time historical scan (last 90 days) → extracted items sent to inline micro-review
    4. Ongoing: Check for new receipts every 24 hours (scheduled Azure Function)
  - **Privacy controls:**
    - User can filter which retailers to scan (granular consent)
    - "Delete raw emails after 7 days" (user-configurable: 7/30/90 days or never)
    - One-click disconnect with full data deletion option
  - **Fallback if OAuth delayed:** Continue with email forwarding as primary method

- **Unit Normalization Library (P1 — Critical for Price Tracking):**
  - Build standardized unit conversion logic before any price comparison features
  - Handle: oz, fl oz, lb, g, kg, count, pack, each, gal, qt, pt (start with top 20 most common)
  - Test on 1,000 SKU sample dataset across 5 retailers before Phase 2
  - **Edge case handling (explicitly defined):**
    - "Family size" (no units) → flag for manual review; don't attempt normalization
    - "2 for $5" promotions → calculate unit price as ($5 / 2 items) = $2.50/item; store promotion flag
    - "12 oz" vs. "12 fl oz" → maintain distinction (weight vs. volume); store unitType field
    - Missing units → flag for manual review; prompt user in inline micro-review
  - Build incrementally; prioritize most common units first (oz, lb, count)

### 4.3 Family Sync & Collaboration (Phase 2 — Deferred if Conflicts Arise)  
- **Authentication & Roles:** Microsoft Entra ID handles Admin/Member roles, households, and token issuance.  
- **Sync Strategy:** Scheduled background sync (every 5-15 minutes) using Cosmos DB Change Feed to minimize costs. Near-real-time sync deferred to Phase 3+ if user feedback demands it.
- **Offline Mode:** Local IndexedDB caching with Last-Write-Wins. Optional version history UI for conflict resolution.
- **Phase 1 Simplification:** Launch with single-user mode first; validate prediction model and UX before adding multi-user complexity. If Phase 1 beta shows no demand for family sharing, defer to Phase 3+.

### 4.4 Vendor-Specific List Generation (P2)  
- Auto-learn preferred vendor from purchase history or set manually.  
- Quick-Trip filter for active list based on selected vendor; offline filtering uses last cached sync.

### 4.5 Smart Alerting & Price Tracking (Phase 2 — After Prediction Validation)  
- **Prerequisites:** Phase 1 prediction model achieves <40% override rate and ≥70% accuracy on test set
- Track unit price trends over 12 months using unit normalization library (built in Phase 1)
- Buy/Stock-Up alerts triggered when price drops significantly and Predicted Run-Out Date is within threshold
- **Price Drop Threshold:** Alert when current price is ≤15% below 90-day rolling average
- **Unit Price Normalization:** Convert to common units (price per oz, per count) accounting for pack size variations
- **Alert Delivery:** Opt-in per item (not global); max 2 alerts/week per user to avoid fatigue
- **A/B Test (Phase 3):** Daily digest vs. instant notifications; 15% vs. 20% price drop threshold

---

## 5. Build vs. Buy Decision Framework

| Component | Build | Buy/Integrate | Decision Rationale | Contingency Plan |
|-----------|-------|---------------|-------------------|------------------|
| Authentication | ❌ | ✅ Microsoft Entra ID | Commodity; don't reinvent the wheel; enterprise-grade security | If Entra adds >2 weeks to launch, use Clerk or Auth0 |
| Real-time Sync | ❌ | ✅ Cosmos DB Change Feed | Proven at scale; self-managed CRDT would delay MVP by 4-6 weeks | If cost >$500/month at 1k users, evaluate PostgreSQL + Supabase |
| LLM Normalization | ✅ (Hybrid) | ⚠️ Hybrid | Core IP; fine-tuning control; cost optimization via caching; **hybrid approach with deterministic regex parsers for structured receipts (Amazon, Costco) + LLM fallback for unstructured** | Build open-source PoC (Llama 3.1) in Phase 2 if Gemini costs >$0.30/user |
| Email/Photo Parsing | ✅ (Hybrid) | ⚠️ Hybrid | **Reconsidered:** Use hybrid approach (regex for structured + Gemini Vision for unstructured); off-the-shelf parsers (Taggun, Veryfi) cost $0.05-0.15/receipt vs. Gemini ~$0.01; we need quantity extraction and brand normalization which generic parsers don't provide well | If hybrid approach fails (success <70%), consider Veryfi API for specific retailers as fallback |
| Prediction Model | ✅ | ❌ | Core differentiator; proprietary algorithm (exponential smoothing + quantity-awareness) enables competitive moat; this is our IP | No fallback; this is the core value proposition |
| Unit Normalization Library | ✅ | ❌ | Critical for price tracking; handles oz/fl oz/lb/g/pack variations; no good off-the-shelf solution for grocery-specific normalization | Build incrementally; start with top 20 unit types in Phase 1 |
| Price Tracking | ✅ | ❌ | No good API for multi-retailer historical pricing; scraping or user-generated data required; Phase 2+ feature | Defer to Phase 3+ if engineering bandwidth is constrained |
| PWA Framework | ❌ | ✅ React + Vite | Mature ecosystem; faster development; easy to hire for; offline-first capabilities | If SEO becomes important, migrate to Next.js (SSR) |
| Analytics | ❌ | ✅ Azure Application Insights | Pre-built dashboards; anomaly detection; reduces DevOps burden; **critical for LLM cost monitoring** | If cost >$200/month, evaluate Grafana + Prometheus (self-hosted) |
| Push Notifications | ❌ | ✅ Web Push API + Service Workers | Standard protocol; no need for custom infra; Phase 2+ feature | If adoption is low, consider email-only notifications |
| Photo OCR (P1) | ❌ | ✅ Gemini Vision API | Same model for email + photo parsing; unified pipeline; better accuracy than Azure Computer Vision for receipts; $0.25/1K images vs. Azure CV $1.50/1K (6x cheaper) | If Gemini Vision cost/quality degrades, evaluate Azure Document Intelligence (specialized for receipts) |
| Loyalty Card Integration (Phase 3+) | ❌ | ✅ Retailer APIs (partner contracts) | Reduces user friction; strategic partnerships unlock data access; alternative to OAuth if privacy concerns persist | If partnerships fail, continue with photo OCR as primary data source |
| Open-Source LLM Fallback (Phase 2 PoC) | ✅ | ❌ | **New:** Build proof-of-concept with Llama 3.1 or Mistral for cost control and vendor independence; not for production in Phase 1-2 but ready to deploy if Gemini costs spike or API reliability degrades | Deploy OSS model if Gemini cost >$0.30/user for 2 months OR if Google changes pricing/terms unfavorably |

**Key Principle:** Build only what provides competitive differentiation (prediction model, normalization logic, unit library). Buy/integrate everything else to accelerate time-to-market. **New principle:** Maintain contingency plans and decision triggers for all critical dependencies to avoid vendor lock-in risks.

---

## 6. Technical Architecture (Web-First)

**Key Architectural Decision: Unified LLM Pipeline**
- Use **Gemini Vision API** for photo receipt OCR instead of Azure Computer Vision
- **Why:** Gemini can extract structured data (items, prices, quantities) in one pass; Azure CV requires OCR → text extraction → separate parsing step
- **Cost:** Gemini Vision ~$0.25/1K images vs. Azure CV ~$1.50/1K images (6x cheaper)
- **Consistency:** Same normalization logic for email and photo receipts (unified "Needs Review" queue)
- **Accuracy:** Gemini understands context (e.g., "2x" means quantity 2) better than raw OCR + parsing

| Component               | Azure Service / Dependency | Notes                                             | Fallback Option | Contingency Trigger |
|-------------------------|----------------------------|---------------------------------------------------|-----------------|---------------------|
| Backend & Sync          | Cosmos DB (NoSQL) + Change Feed | Scheduled background sync (5-15 min intervals); all structured data (items, transactions, households) stored in Cosmos DB | PostgreSQL + Supabase Realtime if cost is concern | If Cosmos DB costs >$500/month at 1k users, evaluate PostgreSQL |
| Intelligence Layer      | Gemini 2.5 Flash API (direct calls) | Item normalization from photo receipts; $0.05/1M tokens (text), $0.25/1M tokens (vision); hybrid approach with deterministic regex parsers; in-memory cache (no Redis) | Gemini 1.5 Flash (cheaper fallback); **Phase 2: Build open-source PoC (Llama 3.1/Mistral) for cost control** | **If LLM cost >$0.30/user for 2 months OR parsing success <70% after 500 users → switch critical path to hybrid/OSS model** |
| File Storage            | Azure Blob Storage         | Raw email HTML/images, receipt photos; Cosmos DB stores structured metadata + Blob URI references | Azure Files or Amazon S3 | If Blob costs exceed $100/month, evaluate lifecycle policies or S3 |
| Authentication & Identity| Microsoft Entra ID        | OAuth login, roles, multi-device auth; single-user mode in Phase 1 | Auth0, Firebase Auth, or Clerk | If Entra adds >2 weeks to launch, use Clerk for rapid iteration |
| Serverless Functions    | Azure Functions (HTTP + Timer triggers) | Photo OCR, LLM calls, batch processing, scheduled sync jobs; microservices architecture (separate functions per domain: parsing, prediction, sync) | AWS Lambda, Cloudflare Workers | If Azure Functions cold start >3s, evaluate warm instances or Cloudflare |
| Client                  | Web PWA (React + TypeScript + Vite)| Responsive, offline caching via IndexedDB, service worker for future push notifications | Next.js for SSR/SEO if marketing/blog needed later | If PWA adoption <60%, consider React Native wrapper for app store presence |
| Analytics & Monitoring  | Azure Application Insights | Real-time dashboards, error tracking, performance monitoring; **required for LLM cost tracking** | Datadog, New Relic, or self-hosted Grafana | If Application Insights costs >$200/month, evaluate Grafana + Prometheus |
| Azure Region            | West US 2 or West US 3 | All resources co-located in single US West region for lowest latency and data transfer costs | East US 2 if West unavailable | N/A |

---

## 6. Data Schema (MVP Core)

### 6.1 Inventory Item (Master List)

| Field              | Type    | Description                      |
|--------------------|---------|---------------------------------|
| itemId             | String (PK) | Unique identifier           |
| householdId        | String  | FK to household                 |
| canonicalName      | String  | Normalized name                 |
| category           | String  | System category                 |
| preferredVendor    | String  | Learned or manual               |
| avgFrequencyDays   | Float   | Average interval                |
| avgPurchaseQuantity| Float   | For quantity-aware prediction   |
| lastPurchaseQuantity| Float  | Last purchase quantity          |
| predictedRunOutDate| Date    | Next predicted need             |
| unitOfMeasure      | String  | e.g., oz, count, gal            |
| priceHistory       | Array   | Unit prices and dates           |

### 6.2 Transaction History

| Field           | Type        | Description                 |
|-----------------|-------------|-----------------------------|
| transactionId   | String (PK) | Unique transaction          |
| householdId     | String      | FK to household              |
| itemId         | String      | FK to InventoryItem          |
| purchaseDate    | Date        | From receipt/OAuth           |
| retailer        | String      | Vendor name                  |
| totalPrice     | Float       | Paid cost                   |
| quantity        | Float       | Purchased quantity          |
| unitPrice      | Float       | Calculated unit price       |
| sourceType     | String      | Email Forward, OAuth Sync   |

---

## 7. Non-Functional Requirements
- **Performance:** Page load <2s, One-Tap Restock <500ms, Photo OCR processing <5s user-perceived latency (async background processing with progress indicator).  
- **Battery & Network:** Minimize background network & LLM calls (server-side processing); scheduled sync every 5-15 minutes reduces battery drain.  
- **LLM Usage & Costs:** 
  - Direct Gemini API calls (no Redis caching layer to minimize infra costs)
  - Rate limiting with fallback to cached/fuzzy matching if operational budget exceeded ($50/day hard limit)
  - In-memory cache for top 1000 items; expand to 2000 if cache hit rate <30%
  - Real-time cost dashboard (Azure Application Insights) with automated alerts at $35/day (70% threshold)
  - Conservative cost modeling: 30-40% cache hit rate in Phase 1-2, 60-70% in Phase 3+
- **Analytics & Feedback:** Track prediction overrides, inline micro-review completion rates, parsing success rates, time-to-value, CTR for iterative improvement.  
- **Privacy & Data Governance (Phase 1 Baseline):**
  - **Not excluding compliance** — implementing baseline privacy controls from Day 1:
    - Explicit opt-in consent for email scanning and crowdsourced corrections
    - Plain-language privacy policy accessible during onboarding
    - User-controlled retention: "Delete raw receipts after X days" (7/30/90 days or never)
    - One-click data deletion flow: "Delete all my data" → removes from Cosmos DB + Blob Storage within 48 hours
    - PII minimization: Store only essential transaction data (item, price, quantity, date, retailer); no names, addresses, payment info
    - Anonymization: Crowdsourced corrections shared without user identifiers
  - **Deferred to Phase 3+:** Full GDPR/CCPA audit, SOC2 certification, Data Processing Agreements (DPAs), third-party penetration testing
  - **Legal review:** Consult legal counsel before Phase 2 public beta (recommended by Week 10)
- **PWA Compliance:** Works offline (IndexedDB caching), responsive design for desktop/mobile/tablet; push notifications deferred to Phase 2 after prediction validation.
- **Architecture:** Microservices pattern using Azure Functions (separate functions for photo OCR, CSV parsing, email parsing, prediction recalculation, scheduled sync) for modularity and independent scaling.

---

## 8. MVP Validation & Phased Rollout

### 8.1 Phase 1: Core MVP Build (Weeks 1-6) - CONSERVATIVE SCOPE (COLD START OPTIMIZED)

**P0 (Blocking Launch — Must Have):**

1. **Demo Mode (FIRST user touchpoint):**
   - Show 5-10 pre-populated items (milk, eggs, bread, butter, coffee) with sample predictions
   - Display "High confidence: Next restock in 3 days" for milk; "Medium confidence: 5 days" for eggs
   - User sees value in <30 seconds before committing data
   - CTA: "Upload your Amazon order history CSV to see real predictions" (prominent button)

2. **CSV Import (PRIMARY onboarding path):**
   - Accept Amazon order history CSV format (downloadable from amazon.com/order-history)
   - Parse item, price, quantity, date with ≥95% success rate
   - Preview UI before import confirmation
   - **Prominent onboarding:** "Connect Amazon" or "Upload CSV" as first screen after demo
   - Goal: 50-200 items instantly populated; many with 2-5+ purchases for predictions

3. **Smart Shopping Assistant / Teach Mode (SECONDARY path for immediate value):**
   - Onboarding prompt: "How often do you buy [item]? [Weekly / Bi-weekly / Monthly / Custom]"
   - System converts user input to predicted run-out dates
   - Provides immediate value (smart shopping list) without historical data
   - Serves as ground truth for model training
   - **Tutorial:** "Set restock dates for 5 items to unlock full predictions"

4. **Prediction Model with Exponential Smoothing:**
   - Quantity-aware formula with **relaxed confidence thresholds** (≥3 purchases for High, ≥2 for Medium)
   - Show confidence scores with explanatory tooltips
   - Integrate Smart Shopping Assistant data as initial predictions

5. **Cosmos DB Sync + Microsoft Entra ID Auth:**
   - Single-user mode (family sharing deferred to Phase 2)
   - Scheduled background sync (5-15 min intervals)
   - IndexedDB offline caching with Last-Write-Wins

6. **Unit Normalization Library:**
   - Handle top 20 common units: oz, fl oz, lb, g, kg, count, pack, gal, qt, pt
   - Test on 1,000 SKU sample before Phase 2 price tracking
   - Edge case handling defined (see Section 4.2)

7. **LLM Cost Dashboard:**
   - Real-time cost monitoring via Azure Application Insights
   - Automated alerts at $35/day (70% of $50/day budget)
   - Per-user throttle at $0.20/month
   - Queue-based degradation (NOT fuzzy matching) if quota exceeded

**P1 (Launch with, but non-blocking if delayed):**

8. **Photo Receipt OCR:**
   - Gemini Vision API for 2 retailers (Amazon packing slips, Costco receipts)
   - Inline micro-review for items with <80% confidence
   - Store raw photo in Azure Blob; structured data in Cosmos DB
   - Parsing success target: ≥70% (relaxed from ≥80%)

9. **Manual Item Entry (for one-offs):**
   - Single-item add form with quantity, price, date, retailer fields
   - Auto-complete from canonical item list (top 1000 cached items)
   - **De-emphasized in onboarding:** Not shown until user completes CSV/Teach Mode

10. **Inline Micro-Review A/B Test:**
    - Test 2-tap (Accept/Reject) vs. 3-tap (Accept/Edit/Reject)
    - Measure completion rate, time per review, user feedback
    - Choose winner for Phase 2 beta

**Deliverables (Optional - if ahead of schedule):**
- Email forwarding endpoint → Azure Functions → hybrid regex/LLM parsing
- 1000-item normalization cache (milk, eggs, bread, etc.)
- Gmail API verification process initiated (for Phase 2A fast follow-up)
- Lightweight security review (before full audit in Phase 4)

**Explicitly Deferred to Phase 2:**
- ❌ Gmail OAuth parsing (requires verification completion + privacy policy finalization)
- ❌ Smart alerts and price tracking (validate predictions first; requires unit normalization testing)
- ❌ Vendor-specific filtering (P2 feature)
- ❌ Family sync (multi-user mode deferred if conflicts arise)
- ❌ Push notifications (PWA service worker only for offline caching in Phase 1)

**Exit Criteria (Go/No-Go Gate for Phase 2):**
- ✅ **Demo Mode:** Users see sample predictions in <30 seconds; CTA prompts CSV upload
- ✅ **CSV Import:** Flow achieves <5 min time-to-first-value (signup → CSV upload → first item with prediction)
- ✅ **CSV Import:** Succeeds on 10 sample Amazon order history files with ≥95% accuracy
- ✅ **Smart Shopping Assistant:** Users can set expected restock dates; system converts to predictions correctly
- ✅ **Prediction Coverage:** ≥50% of items in internal testing have Medium/High confidence (with CSV or Teach Mode data)
- ✅ **Prediction Model:** Shows confidence scores correctly with explanatory tooltips
- ✅ **Photo OCR (if launched):** Successfully parses ≥70% of items from 20 test receipts (Amazon, Costco)
- ✅ **Inline Micro-Review:** A/B test winner chosen; completion rate ≥70% in internal testing
- ✅ **LLM Costs:** <$0.25/user in internal testing (with 50 simulated users, varied input methods)
- ✅ **Queue Degradation:** Works correctly when LLM quota exceeded (no fuzzy matching fallback)

**Testing Strategy (Phase 1):**
- Manual testing for core flows (onboarding, item entry, CSV import, photo OCR)
- Unit tests for prediction model logic (exponential smoothing, confidence scores)
- Cost simulation: Run 50 synthetic users with varied receipt formats to validate LLM budget
- Holdout test set: Reserve 20% of internal team purchase data for prediction accuracy validation
- Comprehensive automated E2E testing deferred to Phase 2+ (avoid over-engineering during rapid iteration)

**Pivot Decision (Week 6):**
- **If demo mode ineffective (users skip CSV upload after demo):** Add social proof ("10,000+ items tracked"); improve CTA copy
- **If CSV import friction too high (time-to-value >8 min):** Add Amazon OAuth for one-click import; simplify preview UI
- **If CSV import fails (success rate <90%):** Focus on photo OCR as primary input method; de-emphasize CSV
- **If Smart Shopping Assistant adoption <60%:** Simplify frequency options (just Weekly/Monthly); add onboarding tutorial
- **If Prediction Coverage <40% (Phase 1 internal testing):** Investigate: Are users providing enough data? Relax thresholds further to ≥2 for High, ≥1 for Medium
- **If photo OCR costs excessive (>$0.15/receipt):** Switch to email forwarding with deterministic regex parsers
- **If predictions untrusted (override rate >50% in internal testing):** Double down on Smart Shopping Assistant; delay Phase 2 by 2 weeks to improve model
- **If LLM costs >$0.30/user:** Immediately expand cache to 2000 items; reduce parsing frequency; switch to Gemini 1.5 Flash
- **If inline micro-review completion <60%:** Choose 2-tap variant; simplify UI further
- **If sync issues:** Simplify to local-only mode; defer Cosmos DB to Phase 2

### 8.2 Phase 2: Closed Beta (Weeks 7-12)
- **Goal:** Validate prediction model trust and core UX; add Gmail OAuth if Phase 1 successful
- **Participants:** 20-50 power users (active grocery shoppers, tech-savvy, willing to provide feedback)
- **Recruitment:** Target budgeting/grocery communities on Reddit (r/Frugal, r/EatCheapAndHealthy), Discord, personal networks

**Phase 2A (Weeks 7-9): Prediction Validation + Smart Alerts**
- **Focus:** Validate prediction accuracy and user trust before scaling
- Users add 10-20 items from recent purchases (manual/CSV/photo)
- Track prediction accuracy (±5 days) and user override rates
- Test confidence score UX comprehension via user interviews
- **New feature:** Smart alerts (opt-in per item) when predicted run-out date approaches
- A/B test alert timing: 3 days before vs. 7 days before run-out

**Success Criteria (Phase 2A):**
  - **Prediction Coverage:** ≥50% of active items have Medium/High confidence (critical new metric)
  - ≥5 items per user with prediction confidence ≥Medium within 2 weeks (increased from ≥3)
  - <5 minutes average time-to-first-value (demo mode → CSV/Teach Mode → first item with prediction)
  - ≥40% weekly active users (WAU)
  - **Prediction override rate <40%** (critical gate for Phase 2B; only measurable if Prediction Coverage >40%)
  - Inline micro-review completion rate ≥70% (using A/B test winner from Phase 1)
  - LLM costs <$0.25/user/month (with conservative cache hit rate assumptions)

**Phase 2B (Weeks 10-12): Gmail OAuth Integration (if Phase 2A successful)**
- **Prerequisites:**
  - Gmail API verification completed (should be in progress since Phase 1 Week 1)
  - Prediction override rate <40% in Phase 2A
  - Privacy policy and consent UI finalized (legal review recommended)
- **Launch:** Gmail OAuth with explicit opt-in consent
- One-time historical scan (last 90 days) → items sent to inline micro-review
- Track parsing success rates by retailer (Amazon, Costco, Walmart)
- User privacy controls: filter retailers, set retention period, one-click disconnect

**Success Criteria (Phase 2B):**
  - **IF Gmail OAuth enabled:** ≥70% of receipts parsed without manual intervention
  - **IF Gmail OAuth enabled:** Inline micro-review completion rate ≥70%
  - OAuth adoption ≥30% of beta users within 2 weeks of launch
  - No privacy complaints or data deletion requests exceeding 10% of OAuth users

**Learning Focus:** 
  - **Onboarding path adoption:** What % use CSV vs. Smart Shopping Assistant vs. photo OCR vs. manual entry?
  - **Demo mode effectiveness:** Does seeing sample predictions motivate data entry? What's the conversion rate from demo → CSV upload?
  - **Prediction Coverage blockers:** Why isn't coverage hitting 50%? Not enough purchases per item? Users not using CSV import?
  - Which retailers have problematic receipt formats (build parsing priority list for Phase 3)
  - Common normalization failures requiring expanded caching (e.g., "org milk" → "organic milk")
  - User tolerance for inline micro-review frequency (if >3 items queued, do users abandon?)
  - Confidence score UX: Do users understand Low/Medium/High? Are tooltips helpful?
  - Alert timing preference: Do users want 3-day or 7-day advance notice?
  - **Smart Shopping Assistant usage:** Are users setting restock dates? Does it provide sufficient immediate value?

**Feedback Loops:**
- Weekly 1-on-1 user interviews (5-10 users)
- In-app feedback widget for every prediction and inline micro-review
- Post-OAuth survey: "How comfortable are you with Gmail scanning?"
- Analytics: Track drop-off points, feature usage heatmaps, parsing error rates, LLM costs per user

**Go/No-Go Gate for Phase 3 (Week 12):**
- ✅ **Prediction Coverage ≥50%** (users have enough items with predictions; prerequisite for measuring trust)
- ✅ Prediction override rate <40% (users trust the model; only valid if Coverage >40%)
- ✅ 30-day retention ≥30% (users return after initial week)
- ✅ WAU ≥40%
- ✅ LLM costs <$0.25/user/month
- ✅ No critical privacy incidents or legal concerns
- ✅ **IF Gmail OAuth launched:** Parsing success rate ≥70%

**Pivot Decision (Week 12):**
- **If Prediction Coverage <40%:** CRITICAL BLOCKER; investigate root cause (CSV adoption? Teach Mode usage? Threshold too strict?); delay Phase 3 until fixed
- **If prediction trust <50% (override rate >50%) BUT Coverage >50%:** Delay Phase 3 by 2 weeks; improve exponential smoothing model; add seasonal adjustment logic
- **If inline micro-review abandonment >40%:** Already using A/B test winner; simplify further or make fully optional
- **If Gmail OAuth adoption <20%:** Pivot to loyalty card integration (Target Circle, Costco) as alternative data source
- **If LLM costs >$0.30/user:** Immediately switch to Gemini 1.5 Flash or build open-source PoC (Llama 3.1)
- **If 30-day retention <25%:** Conduct exit interviews; investigate: Is demo mode ineffective? CSV import friction? Teach Mode not providing value?

### 8.3 Phase 3: Expanded Beta (Weeks 13-20)
- **Goal:** Scale validation, introduce price tracking, measure retention and unit economics
- **Participants:** 200-500 households
- **Prerequisites:** All Phase 2 exit criteria met (especially prediction override rate <40%)

**New Features (Phase 3):**
1. **Price Tracking with Unit Normalization:**
   - Track unit price trends over time using library built in Phase 1
   - Show price history chart per item (12-month rolling window)
   - Alert when current price ≤15% below 90-day rolling average
2. **Vendor-Specific Filtering:**
   - Auto-learn preferred vendor from purchase history
   - Quick-Trip filter for shopping list
3. **Family Sync (if no conflicts in Phase 2):**
   - Multi-user households with Admin/Member roles
   - Scheduled background sync (5-15 min intervals)
   - Last-Write-Wins conflict resolution

**Success Criteria (Phase 3):**
  - **Retention:** 50% 30-day retention, 40% 90-day retention
  - **Engagement:** 60% weekly active users (WAU)
  - **Utility:** ≥2 items prevented from running out per household/month
  - **Trust:** Prediction override rate <30% (improvement from Phase 2's <40%)
  - **Economics:** LLM cost <$0.15/user/month (target: <$0.10/month by end of Phase 3)
  - **Parsing:** Receipt parsing ≥85% success rate (up from 70% in Phase 2)
  - **Infrastructure:** Load testing validates 1000+ concurrent users, 100 req/sec
  - **Quality:** <1 critical bug per 100 user-weeks
  - **Satisfaction:** Net Promoter Score (NPS) ≥40

**Feature Flags / A/B Tests:**
  - **Price alert threshold:** 15% vs. 20% price drop (which drives more conversions?)
  - **Alert frequency:** Daily digest (all alerts at 8am) vs. instant notifications
  - **Alert opt-in default:** Opt-in per item vs. global opt-in with per-item opt-out
  - **Vendor filtering prominence:** Prominent top-bar filter vs. hidden in settings
  - **Family sync:** Enable for 50% of multi-user households; track conflict rates

**Go/No-Go Gate for Public Launch (Week 20):**
- ✅ 50% 30-day retention achieved
- ✅ 60% WAU achieved
- ✅ Prediction override rate <30%
- ✅ LLM cost <$0.15/user/month with clear path to <$0.10/month at scale
- ✅ NPS ≥40
- ✅ Privacy policy and terms of service finalized (legal review completed)
- ✅ Customer support plan in place (email, in-app chat, FAQ)
- ✅ Incident response playbook for outages, data breaches, LLM failures
- ✅ Infrastructure load testing passed (1000+ users, 100 req/sec)
- ✅ Security audit completed (external review recommended)

**Pivot Decision (Week 20):**
- **If alert click-through <10%:** Make alerts fully opt-in (not default); reduce to max 1 alert/week; add "Why am I getting this alert?" explanation
- **If retention <40%:** Investigate via exit interviews; consider pivoting to "smart shopping list only" without predictions; focus on vendor optimization and price tracking
- **If LLM cost >$0.20/user:** Immediately switch critical path to open-source model (Llama 3.1 PoC should be ready from Phase 2); negotiate enterprise Gemini pricing
- **If family sync conflict rate >20%:** Disable family sync; focus on single-user optimization
- **If NPS <30:** Conduct comprehensive UX audit; delay public launch by 4 weeks; iterate on core value proposition

### 8.4 Phase 4: Public Launch (Week 21+)
- **Prerequisites (All Must Be Met):**
  - All Phase 3 exit criteria met (50% 30-day retention, 60% WAU, <30% override rate, <$0.15/user LLM cost)
  - Privacy policy and terms of service finalized (legal review completed)
  - Baseline privacy controls implemented (opt-in consent, data deletion, retention policies)
  - Customer support plan in place (email support@kirana.app, in-app chat widget, comprehensive FAQ)
  - Incident response playbook for outages, data breaches, LLM failures, silent parsing failures
  - Infrastructure load testing passed (1000+ concurrent users, 100 req/sec)
  - Security audit completed (external review recommended; TLS encryption, access logs, secure Blob storage)
  - LLM cost dashboard with real-time alerts operational
  - Open-source LLM fallback PoC validated (ready to deploy if costs spike)

- **Marketing Strategy:**
  - **Week 21-24:** Soft launch with grocery/budgeting communities
    - Reddit: r/Frugal, r/EatCheapAndHealthy, r/BuyItForLife, r/Costco, r/amazonprime
    - Discord: Budgeting and personal finance servers
    - Product Hunt launch (prepare demo video + screenshots)
  - **Week 25+:** Content marketing
    - Blog posts: "How to Never Run Out of Groceries Again", "Save $10/Month with Smart Inventory Management"
    - YouTube: Demo videos, comparison with manual shopping lists
    - Partnerships: Reach out to budgeting influencers, grocery delivery apps

- **Growth Target:** 1,000 households in first 90 days
- **Monitoring (Real-Time Dashboards Required):**
  - Error rates (parsing failures, prediction errors, sync failures)
  - LLM costs (per-user, per-day, per-feature)
  - Sync latency (should remain <15 min)
  - User engagement (WAU, DAU, retention cohorts)
  - Prediction trust (override rates, confidence distribution)
  - Inline micro-review completion rates
  - Alert click-through rates (if enabled)

- **Support Plan:**
  - Email: support@kirana.app (response time <24 hours)
  - In-app chat widget (link to FAQ and email support)
  - Comprehensive FAQ covering: onboarding, privacy, Gmail OAuth, data deletion, prediction accuracy
  - Community forum (consider Discord or Reddit for user-to-user support)

- **Post-Launch Iteration (Ongoing):**
  - Weekly review of analytics and user feedback
  - Monthly NPS surveys
  - Quarterly security audits
  - Continuous LLM cost optimization (expand cache, improve parsers, negotiate pricing)

---

## 9. Risk Mitigation Plan

| Risk | Likelihood | Impact | Mitigation Strategy | Pivot/Fallback Plan | Decision Trigger |
|------|------------|--------|---------------------|---------------------|------------------|
| **LLM costs exceed budget** | High | High | Pre-cache top 1000 items (expandable to 2000); implement per-user monthly cap ($0.20 Phase 1-2, $0.10 Phase 3+) with graceful degradation to fuzzy matching; batch process non-urgent receipts overnight; operational budget cap at $50/day with real-time alerts | Switch to smaller model (Gemini 1.5 Flash) or open-source alternative (Llama 3.1, Mistral); negotiate enterprise pricing at 500+ users; **build open-source PoC in Phase 2 for pricing resilience** | **If cost >$0.30/user for 2 consecutive months OR >$75/day → switch critical path to hybrid/OSS model within 1 week** |
| **Low Gmail OAuth adoption (privacy concerns)** | Medium | Medium | Transparent data policy with plain-language explanations; option to auto-delete raw receipts after 7/30/90 days (user-configurable); emphasize email forward/CSV/photo as primary paths; explicit opt-in consent with privacy controls | Pivot to loyalty card integration (Target Circle, Costco membership API) or continue with photo receipt OCR as primary method; OAuth becomes optional enhancement | **If OAuth adoption <20% after 4 weeks in Phase 2B → deprioritize Gmail integration; focus on photo OCR and loyalty cards for Phase 3** |
| **Poor prediction accuracy damages trust** | High | Critical | Always show confidence scores (Low/Medium/High) with explanatory tooltips; let users override predictions and record as training data; "Teach Mode" in Phase 1 where users set expected dates; exponential smoothing for stability; require ≥5 purchases for High confidence | Pivot to "smart shopping list" without predictions; focus on price alerts and vendor filtering as primary value; use predictions as secondary "nice to have" feature | **If override rate >50% after Phase 2A → delay Phase 2B by 2 weeks; improve model; if still >40% after Phase 3 → pivot to shopping list + price tracking focus** |
| **Receipt parsing <80% success rate** | Medium | High | Start with 2 retailers (Amazon, Costco) with stable formats; hybrid regex + LLM approach; dedicated parser per retailer; crowdsource corrections via inline micro-review; silent failure detection with real-time engineering alerts; quarterly canary receipt testing | Prioritize photo receipt OCR (already in Phase 1) as primary method; reduce reliance on email parsing; partner with retailers for direct API access (CSV export, loyalty card data) | **If parsing success <70% for any major retailer after 500 beta users → pause new OAuth onboarding; direct users to photo OCR; dedicate engineering sprint to fix parser** |
| **Family sync conflicts frustrate users** | Low | Medium | Launch Phase 1 with single-user mode; add family sync in Phase 2 only if no conflicts observed; implement conflict detection UI with "Keep Both" option; educate users on Last-Write-Wins via onboarding tooltips; version history UI for power users | Keep single-user mode indefinitely; defer family features to Phase 3+ or abandon if not critical to retention; most users may prefer individual accounts | **If conflict rate >20% in Phase 3 testing → disable family sync; focus on single-user optimization** |
| **Competitor with deeper retailer integration launches (Instacart, Amazon, Walmart)** | Medium | High | Focus on multi-retailer aggregation as differentiator; build strong prediction model IP (exponential smoothing + quantity-awareness); emphasize privacy (no data sold to retailers); partner with 2-3 regional grocers for direct API access; become "intelligence layer" | Pivot to B2B2C white-label model for regional grocery delivery services; sell anonymized market intelligence to CPG companies (price trends, consumption patterns); integrate affiliate APIs for commission-based revenue (Phase 2+) | **If major competitor launches similar feature → evaluate differentiation; if cannot compete on convenience, pivot to B2B2C within 8 weeks** |
| **Users don't see value within 5 minutes (cold start problem)** | High | Critical | 10-item quick-add with pre-populated common items; CSV import for instant bulk add; "Teach Mode" provides immediate control; show sample predictions with demo data during onboarding; emphasize time-to-first-value in UX | Reduce onboarding friction to 1-tap: "Import last 10 Amazon orders via CSV" or "Upload receipt photo"; provide instant value with price comparison even without predictions (show historical prices for added items) | **If time-to-value >8 min after Phase 1 → simplify to 5-item quick-add; remove optional fields; add bulk import prominently in onboarding** |
| **Alert fatigue (too many notifications)** | Medium | Medium | Make alerts opt-in per item (not global); use learned preferences (e.g., only alert for >20% price drops); daily digest option instead of instant notifications; limit to 2 alerts/week per user; A/B test frequency in Phase 3 | Pivot to passive dashboard (no push notifications); users check app when planning shopping trips; alerts become email-only (weekly digest) | **If alert click-through <8% after Phase 3 A/B testing → disable instant notifications; switch to weekly email digest or fully opt-in only** |
| **Privacy incident or regulatory scrutiny** | Low | Critical | Implement baseline privacy controls from Day 1 (opt-in consent, data deletion, retention policies, PII minimization); legal review before Phase 2 public beta; external security audit before Phase 4; transparent privacy policy; user-facing privacy dashboard | Immediately pause new user onboarding; conduct full security audit; engage legal counsel; notify affected users within 72 hours (GDPR requirement); implement remediation plan; consider shutting down if liability is unmanageable | **If privacy complaint or data breach occurs → immediate incident response; external audit within 1 week; legal counsel engaged; public communication within 72 hours** |

---

## 10. Roadmap for Native Apps (Phase 2)
- Reuse PWA logic/UI in React Native mobile apps.  
- Add OS-native widgets for One-Tap Restock.  
- Full push notifications and background task support.  
- App Store release after adoption validation.

### Phase 2+ Enhancements (Post-MVP)
**Only pursue after MVP achieves 40%+ 90-day retention and 60%+ WAU**

#### Product Enhancements
- **Seasonal adjustment:** Detect purchase pattern changes for holidays, weather (ML model trained on historical data)
- **Photo receipt capture:** OCR for paper receipts via mobile camera (Gemini Vision API - same model as email parsing for consistency)
- **Smart home integration:** Connect to smart fridge/pantry sensors for real consumption signals (Samsung Family Hub, LG ThinQ)
- **Loyalty card sync:** Auto-import from major retailer loyalty programs (Target Circle, Costco, Safeway)
- **Recipe integration:** Generate shopping lists from meal plans (integrate with Paprika, Mealime APIs)
- **Community features:** Share lists with neighbors, bulk buying coordination (Nextdoor-style local groups)
- **Price prediction:** ML model forecasting future price drops (buy now vs. wait 2 weeks)
- **Multi-vendor optimization:** Route items to cheapest vendor considering travel cost/time/minimum order
- **Sustainability tracking:** Carbon footprint, food waste reduction metrics (gamified badges)

#### Monetization & Business Model Expansion
- **Affiliate Revenue (Phase 2.5):** Integrate with Instacart, Amazon, Walmart APIs to enable one-tap purchase; earn 2-5% commission on completed orders
- **B2B Market Intelligence (Phase 3):** Sell anonymized, aggregated purchase cycle data to CPG companies, hedge funds, and market research firms (high-margin revenue stream)
- **B2B2C White-Label (Phase 3):** License prediction engine to regional grocery delivery services as a "smart reordering" feature; recurring SaaS revenue
- **Vertical Expansion (Phase 3+):** Apply prediction model to pet supplies, cleaning products, personal care, prescription refills (expand TAM beyond groceries)

---

---

## 11. Team Composition & Timeline

### 11.1 Minimum Viable Team (Phase 1-3)

| Role | Time Commitment | Key Responsibilities |
|------|-----------------|---------------------|
| Full-Stack Engineer | Full-time (40h/week) | React PWA frontend, Azure Functions backend, Cosmos DB integration, deployment |
| AI/ML Engineer | Part-time (20h/week) | LLM integration, prediction model, normalization logic, cost optimization |
| Product Manager | Part-time (10h/week) | User interviews, roadmap prioritization, beta program management, analytics review |
| UX/UI Designer | Part-time (10h/week, Weeks 1-6 then 5h/week) | Onboarding flow, "Needs Review" queue UX, mobile-responsive design, user testing |
| DevOps/SRE | Part-time (5h/week) | Azure infrastructure, CI/CD pipelines, monitoring/alerting, security hardening |

**Total:** ~85 hours/week (~2 FTE)

### 11.2 Phase Timeline (21-Week MVP to Public Launch)

| Phase | Duration | Milestones | Team Focus | Go/No-Go Criteria |
|-------|----------|------------|------------|-------------------|
| **Phase 1: Core Build** | Weeks 1-6 | Manual/CSV/photo entry, basic prediction with exponential smoothing, unit normalization library, LLM cost dashboard, single-user sync | Full-stack + AI engineer building foundation | Time-to-value <5 min; prediction model shows confidence scores; LLM cost <$0.25/user; photo OCR ≥80% success |
| **Phase 2A: Prediction Validation** | Weeks 7-9 | 20-50 user validation, smart alerts (opt-in), override rate tracking | Full team; PM leads user interviews; AI engineer tunes model | Override rate <40%; 30-day retention ≥30%; WAU ≥40%; inline micro-review completion ≥70% |
| **Phase 2B: Gmail OAuth (Fast Follow)** | Weeks 10-12 | Gmail integration with explicit consent, privacy controls, parsing validation | Full team; legal review; PM monitors privacy feedback | IF enabled: parsing ≥70%; OAuth adoption ≥30%; no critical privacy incidents |
| **Phase 3: Expanded Beta** | Weeks 13-20 | 200-500 users, price tracking, vendor filtering, family sync (optional), retention measurement | Full team; DevOps scales infrastructure; PM conducts NPS surveys | 50% 30-day retention; 60% WAU; override <30%; LLM cost <$0.15/user; NPS ≥40; security audit passed |
| **Phase 4: Public Launch** | Week 21+ | Marketing, customer support, monitoring, growth to 1k households | Full team + consider adding customer success role | All Phase 3 criteria met; privacy policy finalized; incident response plan ready; support infrastructure operational |

### 11.3 Budget Estimate (21 Weeks to Public Launch)

| Category | Estimated Cost | Notes |
|----------|----------------|-------|
| Engineering Labor (2 FTE × 21 weeks × $2500/week avg) | $105,000 | Assumes mix of senior/mid-level rates; includes AI/ML engineer part-time |
| Azure Infrastructure (21 weeks × $250/week avg) | $5,250 | Cosmos DB, Functions, Blob Storage, Entra ID, Application Insights for <1000 users; increased from $200 to account for production load |
| Gemini API Costs (500 beta users × $0.20/month × 5 months) | $500 | **Conservative estimate:** $0.20/user/month in early phases; assumes 30-40% cache hit rate; may decrease to $0.10/user by Phase 3 |
| Design Tools (Figma, Miro, etc.) | $500 | One-time setup + collaboration tools |
| Testing & QA Tools | $300 | Browser testing (BrowserStack), analytics tools |
| Security Audit (external) | $5,000 | Before public launch (Week 20); includes penetration testing |
| Legal Review (privacy policy, terms) | $2,500 | Before Phase 2 public beta; essential for Gmail OAuth compliance |
| Customer Support Tools (Zendesk, Intercom) | $500 | Email support + in-app chat widget for Phase 4 |
| Marketing (Phase 4 launch) | $2,000 | Product Hunt, Reddit ads, budgeting influencer outreach |
| Contingency (20% — increased for risk mitigation) | $24,310 | Buffer for unknowns, LLM cost spikes, engineering delays |
| **Total MVP Budget** | **$145,860** | ~$6,945/week burn rate |

**Cost Optimization Opportunities:**
- **Azure for Startups credits:** Apply for $1,000-$5,000 free credits (can offset first 6-12 months of infra costs)
- **Gemini enterprise pricing:** Negotiate at 500+ users (target 30-50% discount on API costs)
- **Open-source fallback:** Build Llama 3.1 PoC in Phase 2 to maintain negotiating leverage with Google
- **Legal:** Use templates for initial privacy policy; paid review only for Gmail OAuth-specific clauses
- **Support:** Start with email-only support; add Intercom only if volume exceeds 50 tickets/week

**LLM Cost Risk Analysis (Built-In Budget Flexibility):**
- **Best case ($0.10/user):** Total API cost $250 over 5 months → $250 savings vs. budget
- **Expected case ($0.20/user):** Total API cost $500 over 5 months → on budget
- **Worst case ($0.30/user):** Total API cost $750 over 5 months → $250 overrun (covered by contingency)
- **Catastrophic case (>$0.40/user):** Trigger open-source model switch; halt new user onboarding until costs stabilize

---

## 12. Success Definition & Exit Criteria

### ✅ **MVP is Successful If (by Week 28 — 90 days post-launch):**
1. **Retention:** 40%+ users return after 90 days (50%+ 30-day retention validated in Phase 3)
2. **Engagement:** 60%+ weekly active users (WAU)
3. **Utility:** 2+ items prevented from running out per household/month (tracked via prediction → alert → purchase flow)
4. **Trust:** <30% prediction override rate (users trust the model enough to act on predictions)
5. **Economics:** <$0.15 LLM cost per user per month with clear path to <$0.10 at scale (through cache expansion, parser optimization, volume pricing)
6. **Satisfaction:** Net Promoter Score (NPS) ≥40 (users recommend to friends/family)
7. **Growth:** 1,000+ active households by Week 28 (validates product-market fit and scalability)

### ⚠️ **Warning Signs (Investigate & Iterate If):**
1. **Retention 25-35%** after 90 days (marginal value; conduct exit interviews to identify friction)
2. **WAU 40-50%** (below target but not fatal; improve engagement hooks)
3. **Inline micro-review completion 50-60%** (users finding it tedious; simplify to 2-tap Accept/Reject)
4. **LLM costs $0.15-0.25/user** (higher than target; expand cache, optimize parsers, or negotiate pricing)
5. **Alert click-through 8-12%** (below expectations; A/B test messaging, frequency, timing)

### ❌ **Pivot/Shut Down If (Hard Thresholds):**
1. **Retention <25%** after 90 days (users don't find sufficient value to return)
2. **WAU <40%** (no habit formation; product is not sticky)
3. **Inline micro-review abandonment >50%** (too much friction; users hate data validation)
4. **LLM costs >$0.30/user for 2 consecutive months** and not trending down (unit economics broken; open-source switch failed)
5. **Alert click-through <5%** after multiple iterations (users ignore notifications; alerts are not valuable)
6. **Prediction override rate >50%** after Phase 3 (users don't trust the model; core value prop failed)
7. **Critical privacy incident or regulatory action** (unrecoverable reputational damage)
8. **Growth <500 households by Week 28** (no product-market fit; insufficient organic growth)

**Decision Point (Week 28 — 90 Days Post-Launch):**
- ✅ **If successful:** Continue investing in Phase 5+ features (native apps, seasonal adjustment, recipe integration, monetization experiments)
- ⚠️ **If marginal:** Pivot to B2B2C partnerships (white-label prediction engine for grocery delivery services; SaaS licensing to regional grocers)
- ❌ **If failed:** Shut down gracefully (notify users 30 days in advance; offer data export; release anonymized dataset as open-source contribution; conduct post-mortem analysis)

---

## 13. Immediate Action Items (Next 7 Days)

**Based on critical feedback review, prioritize these tasks before starting Phase 1 development:**

### 🔴 **Critical (Must Complete Before Week 1):**
1. **Build LLM Cost Simulator Spreadsheet**
   - Model per-user API calls across onboarding, weekly receipts, inline reviews, batch jobs
   - Use conservative assumptions (30-40% cache hit rate, 2-3 retries per failed parse)
   - Scenario analysis: Best case ($0.10/user), Expected ($0.20/user), Worst ($0.30/user), Catastrophic (>$0.40/user)
   - Output: Per-day budget caps, per-user throttles, degradation triggers
   - **Owner:** AI/ML Engineer + Product Manager

2. **Draft Privacy Policy & Consent UI Text**
   - Plain-language explanation of email scanning, photo storage, crowdsourced corrections
   - Explicit opt-in flows (not opt-out): "Scan my inbox for receipts from [Amazon, Costco, Walmart]?"
   - User-controlled retention: "Delete raw receipts after [7/30/90 days/never]"
   - One-click data deletion flow: "Delete all my data" → removes from Cosmos DB + Blob Storage
   - **Owner:** Product Manager + Legal Counsel (if available)

3. **Initiate Gmail API Verification Process**
   - Submit OAuth consent screen for Google review (even if not using in Phase 1)
   - Prepare security questionnaire responses
   - Record demo video showing data flow and privacy controls
   - **Timeline:** 2-4 weeks for approval (may extend to 6-8 weeks with back-and-forth)
   - **Owner:** Full-Stack Engineer + Product Manager

### 🟡 **High Priority (Complete During Week 1):**
4. **Mock Inline Micro-Review UX in Figma**
   - Design 3-tap flow: Accept / Edit / Reject for single-item review
   - Toast notification design with item name, confidence score, retailer
   - Progressive disclosure for multi-item receipts
   - Test with 5 users (can be friends/family) to validate UX comprehension
   - **Owner:** UX/UI Designer

5. **Build Unit Normalization Test Harness**
   - Create dataset of 1,000 SKUs across 5 retailers (Amazon, Costco, Walmart, Target, Safeway)
   - Include edge cases: "Family size", "2 for $5", "12 oz" vs. "12 fl oz", missing units
   - Write unit conversion logic for: oz, fl oz, lb, g, kg, count, pack, gal, qt, pt
   - Measure accuracy: % of SKUs successfully normalized to price-per-unit
   - **Owner:** AI/ML Engineer

6. **Create Real-Time LLM Cost Dashboard**
   - Set up Azure Application Insights with custom metrics for Gemini API calls
   - Build dashboard: Cost per user, cost per day, cache hit rate, parsing success rate
   - Configure automated alerts: $35/day (70% threshold), $50/day (hard limit)
   - **Owner:** DevOps/SRE + Full-Stack Engineer

### 🟢 **Medium Priority (Complete During Week 2):**
7. **Write Prediction Model Unit Tests**
   - Test exponential smoothing formula with synthetic purchase data
   - Validate confidence score logic (≥5 purchases = High, 3-4 = Medium, <3 = Low)
   - Create holdout test set with 100 items (reserve 20% for validation)
   - Measure ±5 day accuracy on test set before exposing to users
   - **Owner:** AI/ML Engineer

8. **Set Up Multi-Cloud Contingency Planning**
   - Document migration path from Gemini to Llama 3.1 or Mistral (open-source PoC plan for Phase 2)
   - Document migration path from Cosmos DB to PostgreSQL + Supabase (cost trigger: >$500/month at 1k users)
   - Create decision triggers for all critical dependencies
   - **Owner:** Full-Stack Engineer + DevOps/SRE

9. **Conduct Normalization A/B Test Experiment**
   - Collect 5,000 real receipt line items (can use personal receipts, friends/family, or purchase sample datasets)
   - Run LLM normalization vs. deterministic fuzzy matching (Levenshtein distance)
   - Measure: Accuracy, latency, cost per item
   - Output: Hybrid approach thresholds (when to use LLM vs. fuzzy match)
   - **Owner:** AI/ML Engineer

### 📋 **Deliverable Checklist (Week 1-2):**
- [ ] LLM cost simulator spreadsheet with scenario analysis
- [ ] Privacy policy draft and consent UI text
- [ ] Gmail API verification submitted to Google
- [ ] Inline micro-review UX mockup tested with 5 users
- [ ] Unit normalization library with 1,000 SKU test dataset
- [ ] Real-time LLM cost dashboard operational
- [ ] Prediction model unit tests with holdout validation
- [ ] Multi-cloud contingency plan documented
- [ ] Normalization A/B test experiment results

**Gate for Phase 1 Development (Week 3):** All Critical + High Priority items completed. Medium Priority items can run in parallel with development but must be completed by Week 6 (Phase 1 exit criteria).

---

**This PRD aligns with:**  
- Web-first PWA MVP with conservative scope (manual/CSV/photo input prioritized over OAuth)
- Microsoft Entra ID for authentication  
- Quantity-aware prediction engine with exponential smoothing and strict confidence thresholds (≥5 purchases for High)
- Baseline privacy controls from Day 1 (opt-in consent, data deletion, retention policies)
- Inline micro-review UX (not batch queue) to reduce friction
- Real-time LLM cost monitoring with hard budget caps and automatic degradation
- Phased validation with clear go/no-go gates and decision triggers
- Realistic budget ($145,860 over 21 weeks) with 20% contingency for LLM cost risk
- Multi-cloud contingency planning to avoid vendor lock-in
- Future-proofing for native mobile apps, seasonal adjustment, and B2B2C monetization
