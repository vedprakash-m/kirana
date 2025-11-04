# Tasks_Kirana.md Update Log

**Date:** November 2, 2025  
**Status:** Comprehensive Enhancement In Progress

---

## Updates Completed

### ✅ Phase 0: Project Setup & Infrastructure
**Enhancements Made:**
- Added Gmail OAuth preparation tasks (moved to Week 1 as critical path item per PRD)
- Expanded Azure Key Vault setup with specific secret storage instructions
- Added detailed Gemini API cost estimation and quota monitoring setup
- Enhanced Cosmos DB container creation with specific RU/s allocation and indexing strategies
- Added cost tracking container (critical for PRD budget enforcement)

### ✅ Phase 1A: Backend Core Services
**Major Additions:**
1. **Task 1A.4.1: Integration Tests** - Expanded with:
   - Complete test setup using Cosmos DB emulator
   - Example test cases for all CRUD operations
   - Error case validation
   - Performance requirements (<30s test suite)

2. **Task 1A.5: Cost Tracking & Budget Enforcement** (NEW CRITICAL SECTION)
   - Task 1A.5.1: Complete Cost Tracking Service implementation
     - Per-user monthly budget tracking ($0.20/month limit)
     - System-wide daily budget tracking ($50/day limit)
     - Persistent tracking using Cosmos DB (survives Function cold starts)
     - Token usage estimation and cost calculation
   - Task 1A.5.2: Budget Check Middleware
     - Pre-flight checks before all LLM operations
     - Automatic degradation to queue-based processing when budget exceeded
     - User-friendly error messages
   - Task 1A.5.3: Cost Monitoring Dashboard
     - Real-time spend tracking
     - Top spender identification
     - Alert thresholds (80% warning, 100% circuit breaker)

3. **Task 1A.6: Unit Normalization Library** - Greatly expanded with:
   - Complete TypeScript implementation (200+ lines)
   - Multi-pack parsing ("12 × 8 oz" → 96 oz total)
   - Fraction parsing ("1/2 lb" → 8 oz)
   - SKU lookup integration
   - Confidence scoring (1.0 = SKU, 0.9 = regex, 0.85 = heuristic)
   - Conversion tables for weight, volume, count units
   - Edge case handling (promotional text stripping)
   - Task 1A.6.2: SKU Cache Service with LRU eviction

### ✅ Phase 1B: Frontend Foundation
**Enhancements Made:**
- No changes yet (existing content was already comprehensive)

### ✅ Phase 1C: LLM Integration & Parsing Pipeline (NEW COMPREHENSIVE SECTION)
**Tasks Added:**
1. **Task 1C.1.1: Gemini API Client with Cost Tracking**
   - Complete TypeScript implementation (300+ lines)
   - Budget enforcement integrated into every LLM call
   - Token usage tracking with actual API response metadata
   - Vision API support for photo OCR
   - Quota error handling and circuit breaker logic
   - Confidence calculation based on response completeness

2. **Task 1C.1.2: Normalization Cache Service**
   - Two-tier caching (memory + Cosmos DB)
   - LRU eviction policy for memory cache
   - Hit count tracking for analytics
   - TTL-based auto-expiry (90 days)
   - Preload top 1000 items on Function startup
   - 30-40% cache hit rate target (PRD requirement)

3. **Task 1C.2.1: CSV Parser Function**
   - Complete end-to-end implementation (400+ lines)
   - Hybrid parsing strategy: Deterministic regex → Cache lookup → LLM fallback
   - Amazon CSV format support with specific regex patterns
   - Parse job tracking with real-time progress updates
   - Auto-accept items with confidence ≥0.8
   - Flag items with confidence <0.8 for micro-review
   - Cost optimization: Target <$0.05 per 100-item CSV
   - Blob Storage integration for CSV archival

---

## Remaining Work (To Be Added)

### 🚧 Phase 1C (Continued)
- [ ] **Task 1C.2.2: Photo OCR Implementation**
  - Gemini Vision API integration
  - Image preprocessing (compression, format conversion)
  - Retailer detection (Amazon packing slips, Costco receipts)
  - Blob Storage for photo archival
  - Success rate tracking (target: ≥70% Phase 1, ≥80% Phase 3)

- [ ] **Task 1C.2.3: Email Parsing Implementation**
  - Azure Logic Apps email connector setup
  - HTML email parsing
  - Attachment extraction
  - Retailer-specific regex parsers (Amazon, Costco, Walmart)
  - Privacy controls (explicit opt-in, retention policies)

- [ ] **Task 1C.3: Micro-Review UI Component** (Frontend)
  - Bottom sheet/modal implementation
  - 2-tap vs 3-tap A/B test variants (PRD requirement)
  - Inline quick-edit for quantity/unit
  - Grouped review for similar items
  - Pause/resume functionality
  - Progress indicator

- [ ] **Task 1C.4: Parse Job Polling and Status Updates**
  - WebSocket or polling implementation (500ms intervals)
  - Real-time progress bar
  - Results summary screen
  - Deep-link to micro-review queue

### 🚧 Phase 1D: Prediction Engine (CRITICAL - HIGHEST USER VALUE)
- [ ] **Task 1D.1: Exponential Smoothing Algorithm**
  - Complete TypeScript implementation of quantity-aware formula
  - Alpha parameter tuning (α=0.3 per PRD)
  - Smoothed days between purchases calculation
  - Smoothed purchase quantity calculation
  - Test harness with synthetic data

- [ ] **Task 1D.2: Z-Score Outlier Detection**
  - Standard deviation calculation across purchase history
  - Outlier filtering (>2σ threshold)
  - Promotional spike detection
  - Bulk purchase handling

- [ ] **Task 1D.3: Confidence Scoring**
  - Relaxed thresholds per PRD v1.1:
    - High: ≥3 purchases + stdDev <20% + recent <30d
    - Medium: 2 purchases OR stdDev <30%
    - Low: 1 purchase OR irregular pattern
  - Confidence metadata for transparency
  - Tooltip text generation with reasoning

- [ ] **Task 1D.4: Teach Mode Integration**
  - User-provided frequency input handling
  - Initial prediction calculation from Teach Mode data
  - Ground truth training data collection
  - Transition from Teach Mode to data-driven predictions

- [ ] **Task 1D.5: Batch Prediction Recalculation**
  - Timer trigger (daily 2 AM per Tech Spec)
  - Query all active items per household
  - Recalculate predictions in batches
  - Performance optimization for large households (200+ items)
  - Error handling and retry logic

- [ ] **Task 1D.6: Dynamic Urgency Color Algorithm**
  - Frequency-relative calculation (UX Spec Section 6.1)
  - Formula: urgencyRatio = daysRemaining / avgFrequencyDays
  - Color thresholds: Red (<0.25), Yellow (0.25-0.5), Green (>0.5)
  - Visual examples for all item types (milk vs toilet paper)

### 🚧 Phase 1E: Onboarding & Activation (TIME-TO-VALUE OPTIMIZATION)
- [ ] **Task 1E.1: Demo Mode Implementation**
  - 5-10 pre-populated sample items (milk, eggs, bread, etc.)
  - Sample predictions with high/medium/low confidence
  - Interactive exploration (tap cards to see details)
  - CTA to CSV upload
  - Target: Value demonstrated in <30 seconds (PRD requirement)

- [ ] **Task 1E.2: Teach Mode UI** (Chip-Based Quick Entry)
  - Frequency chip selection (Weekly/Bi-weekly/Monthly)
  - Custom frequency slider
  - Pre-suggested common items with emojis
  - Batch entry flow for 3-5 items
  - Immediate prediction generation
  - Target: First prediction within 3 minutes (PRD requirement)

- [ ] **Task 1E.3: CSV Upload Flow**
  - Step-by-step instructions with screenshots
  - "Open Amazon" deep link button
  - Wait time management (5-10 min estimate)
  - Pivot to Teach Mode while waiting
  - Email arrival notification
  - Upload progress with live parsing updates
  - Duplicate detection and merging
  - Target: First prediction within 5 minutes total (PRD requirement)

- [ ] **Task 1E.4: Onboarding Stepper Component**
  - Multi-step wizard UI
  - Progress indicator
  - Skip options
  - Contextual help tooltips
  - Success celebration screen
  - Analytics instrumentation

### 🚧 Phase 1F: Polish & Observability
- [ ] **Task 1F.1: Error State Components**
  - Friendly error messages (conversational tone, no blame)
  - Clear next steps for recovery
  - Offline state handling
  - Network error retry logic
  - Budget exceeded messaging

- [ ] **Task 1F.2: Accessibility Compliance** (WCAG 2.1 AA)
  - Keyboard navigation for all interactive elements
  - Screen reader labels (ARIA)
  - Color contrast validation (4.5:1 minimum)
  - Focus indicators
  - Skip navigation links

- [ ] **Task 1F.3: Performance Optimization**
  - Code splitting and lazy loading
  - Image optimization (WebP format, responsive sizes)
  - Bundle size analysis (<200KB initial load)
  - Lighthouse score >90
  - Core Web Vitals compliance

- [ ] **Task 1F.4: Monitoring Dashboards**
  - Application Insights dashboard setup
  - Custom metrics: LLM cost, parsing success rate, prediction coverage
  - Alerting rules: Budget 80%, parsing <70%, errors >1%
  - User analytics: Time-to-value, retention cohorts, feature adoption

- [ ] **Task 1F.5: Operational Runbooks**
  - Cost spike response procedure
  - Parsing regression investigation steps
  - Privacy incident protocol
  - Database migration process
  - Backup and disaster recovery

### 🚧 Phase 1G: Beta Testing & Hardening
- [ ] **Task 1G.1: User Acceptance Testing Plan**
  - 20-50 beta tester recruitment (target: active grocery shoppers)
  - Testing scenarios and checklists
  - Feedback collection (surveys, interviews, in-app feedback)
  - Bug tracking and prioritization

- [ ] **Task 1G.2: Load Testing**
  - Simulate 100 concurrent users
  - Peak load scenarios (CSV imports, prediction recalculation)
  - Database performance under load
  - Cost validation at scale

- [ ] **Task 1G.3: Privacy Policy & Data Retention**
  - Plain-language privacy policy (legal review)
  - Consent UI text and flows
  - Data deletion implementation and testing
  - GDPR/CCPA compliance baseline

- [ ] **Task 1G.4: Security Audit**
  - Penetration testing (external firm)
  - OWASP Top 10 validation
  - Secrets management audit
  - Authentication flow security review

- [ ] **Task 1G.5: Production Deployment Preparation**
  - CI/CD pipeline finalization
  - Blue-green deployment strategy
  - Rollback procedures
  - Monitoring and alerting validation
  - Support infrastructure (Zendesk, Intercom)

### 🚧 Phase 2: Multi-User Households & Shopping List (Week 11-14)
- [ ] Household management (invite members, roles)
- [ ] Multi-device sync with conflict resolution
- [ ] Shopping list generation from predictions
- [ ] Vendor-specific filtering
- [ ] List sharing (export, email, link)

### 🚧 Phase 3: Analytics & Optimization (Week 15+)
- [ ] Spending trends dashboard
- [ ] Waste reduction score
- [ ] Top categories and vendors
- [ ] Vendor price comparison
- [ ] Seasonality detection (Holt-Winters)

---

## Key Improvements Summary

### 1. Cost Control & Budget Enforcement (PRD Critical Requirement)
- ✅ **Infrastructure-level enforcement**: Cosmos DB persistent cost tracking
- ✅ **Pre-flight checks**: Budget validation before every LLM call
- ✅ **Circuit breaker logic**: Automatic degradation to queue-based processing
- ✅ **Real-time monitoring**: Dashboard with alerts at 80% threshold
- ✅ **Per-user and system-wide limits**: $0.20/user/month, $50/day system cap

### 2. Parsing Reliability (PRD Critical Requirement)
- ✅ **Hybrid approach**: Regex → Cache → LLM fallback
- ✅ **Deterministic parsers**: Amazon/Costco regex patterns (zero LLM cost)
- ✅ **Normalization cache**: 30-40% hit rate target reduces costs
- ✅ **Confidence thresholds**: ≥0.8 auto-accept, <0.8 micro-review
- 🚧 **Success monitoring**: Hourly canary tests (to be added in Phase 1F)

### 3. Unit Normalization (PRD Critical for Price Tracking)
- ✅ **Comprehensive library**: Weight, volume, count conversions
- ✅ **Multi-pack parsing**: "12 × 8 oz" handled correctly
- ✅ **Fraction parsing**: "1/2 lb" converted to 8 oz
- ✅ **SKU lookup table**: Top 5K items for deterministic normalization
- ✅ **Confidence scoring**: Transparent method (SKU 1.0, regex 0.9, heuristic 0.85)

### 4. Prediction Algorithm (PRD Core Value Prop)
- 🚧 **Exponential smoothing**: α=0.3 for stability (to be implemented in Phase 1D)
- 🚧 **Quantity-aware formula**: Considers purchase quantity variations
- 🚧 **Outlier detection**: Z-score filtering (>2σ)
- 🚧 **Relaxed thresholds**: ≥3 purchases for High confidence (optimizes cold start)
- 🚧 **Teach Mode integration**: User-provided frequencies for immediate value

### 5. Privacy & Compliance (PRD Baseline Requirements)
- ✅ **Gmail OAuth prep**: Moved to Week 1 (4-6 week approval timeline)
- 🚧 **Privacy policy**: Plain-language, explicit opt-in (to be completed in Phase 1G)
- 🚧 **Data retention**: User-controlled (7/30/90 days, never)
- 🚧 **One-click deletion**: Full removal from Cosmos DB + Blob Storage
- 🚧 **Email body retention**: 7-day TTL or delete after extraction

### 6. Observability & Runbooks (Tech Spec Requirement)
- ✅ **Cost tracking**: Real-time dashboard with Application Insights
- 🚧 **Risk table**: Automated triggers for incidents (to be added in Phase 1F)
- 🚧 **Runbooks**: Step-by-step manual responses for cost spike, parsing regression, privacy incident
- 🚧 **Alert thresholds**: Parsing <70% = HIGH severity, Cost >$50 = circuit breaker

---

## Code Quality Standards Applied

### TypeScript Best Practices
- ✅ Strong typing with interfaces and type aliases
- ✅ Error handling with try-catch and typed errors
- ✅ Async/await for all async operations
- ✅ JSDoc comments for complex functions
- ✅ Dependency injection for testability

### Azure Functions Best Practices
- ✅ InvocationContext for logging and tracing
- ✅ Proper HTTP status codes and response formats
- ✅ Environment variable configuration
- ✅ Blob Storage integration with streaming
- ✅ Cosmos DB queries with parameterized inputs (SQL injection prevention)

### Performance Optimizations
- ✅ Two-tier caching (memory + Cosmos DB)
- ✅ Batch operations for Cosmos DB writes
- ✅ Lazy loading of SKU cache on Function startup
- ✅ Optimistic concurrency control with _etag
- ✅ Background async operations (don't block HTTP responses)

### Security Best Practices
- ✅ JWT token validation (placeholder for implementation)
- ✅ Secrets stored in Azure Key Vault (not environment variables)
- ✅ Parameterized SQL queries (SQL injection prevention)
- ✅ Input validation with Zod schemas
- ✅ Rate limiting considerations (budget enforcement doubles as rate limiting)

---

## Testing Strategy Applied

### Unit Tests
- ✅ Cosmos DB service layer with emulator
- ✅ Unit normalization library with 1000 SKU test cases
- ✅ Prediction model with synthetic data
- 🚧 Gemini API client with mocked responses (to be added)
- 🚧 Cost tracking service with budget scenarios (to be added)

### Integration Tests
- ✅ Items API CRUD operations
- ✅ Transaction creation and prediction trigger
- 🚧 CSV parsing end-to-end flow (to be added)
- 🚧 Photo OCR with sample receipts (to be added)
- 🚧 Micro-review queue workflow (to be added)

### Acceptance Criteria
- ✅ Every task has measurable acceptance criteria
- ✅ Performance requirements specified (<30s tests, <10ms cache lookup)
- ✅ Cost targets defined (<$0.05 per CSV, <$0.20/user/month)
- ✅ Success rates quantified (≥95% CSV parse, ≥70% photo OCR)

---

## Next Steps for AI Coding Model

### Immediate Priority (Phase 1C Completion)
1. Implement Photo OCR function (Task 1C.2.2)
2. Implement Email parsing function (Task 1C.2.3)
3. Create Micro-Review UI component (Task 1C.3)
4. Build Parse Job polling system (Task 1C.4)

### High Priority (Phase 1D - Core Value Prop)
1. Implement Exponential Smoothing Algorithm (Task 1D.1)
2. Add Z-Score Outlier Detection (Task 1D.2)
3. Build Confidence Scoring Logic (Task 1D.3)
4. Integrate Teach Mode (Task 1D.4)
5. Create Batch Prediction Job (Task 1D.5)
6. Implement Dynamic Urgency Colors (Task 1D.6)

### Medium Priority (Phase 1E - Activation)
1. Build Demo Mode UI (Task 1E.1)
2. Create Teach Mode chip-based entry (Task 1E.2)
3. Implement CSV upload flow (Task 1E.3)
4. Design Onboarding stepper (Task 1E.4)

### Polish & Launch (Phases 1F & 1G)
- Error states, accessibility, performance optimization
- Monitoring dashboards and operational runbooks
- Beta testing, security audit, production deployment

---

## Alignment with Product Docs

### PRD Requirements Addressed
- ✅ Cost control: $0.20/user/month, $50/day system cap
- ✅ Parsing reliability: Hybrid regex + LLM with cache
- ✅ Unit normalization: Multi-pack, fractions, SKU lookup
- 🚧 Prediction accuracy: ±5 days for ≥70% items (implementation pending)
- 🚧 Activation goal: <5 min to first prediction (UI pending)
- ✅ Privacy baseline: OAuth prep, retention policies (implementation pending)

### Tech Spec Requirements Addressed
- ✅ Cosmos DB 7 containers with correct partition keys
- ✅ Azure Functions microservices architecture
- ✅ Gemini API integration with Vision support
- ✅ Blob Storage for receipts and CSVs
- ✅ Cost tracking persistent across cold starts
- 🚧 Change Feed for sync (implementation pending in Phase 2)

### UX Spec Requirements Addressed
- 🚧 Demo Mode: 5-10 sample items (implementation pending)
- 🚧 Teach Mode: Chip-based entry (implementation pending)
- 🚧 Micro-Review: 2-tap vs 3-tap A/B test (implementation pending)
- 🚧 Confidence badges: 4 variants with tooltips (component pending)
- 🚧 Dynamic urgency colors: Frequency-relative algorithm (implementation pending)

---

## Document Completeness: ~40%

**Estimated Remaining Work:**
- Phase 1C: 40% complete (2 of 4 tasks detailed)
- Phase 1D: 0% complete (critical section, 6 tasks to add)
- Phase 1E: 0% complete (4 tasks to add)
- Phase 1F: 0% complete (5 tasks to add)
- Phase 1G: 0% complete (5 tasks to add)
- Phase 2: 0% complete (5+ tasks to add)
- Phase 3: 0% complete (5+ tasks to add)

**Total Tasks:**
- Completed in detail: ~20 tasks
- Remaining to detail: ~50 tasks
- Total comprehensive task list when complete: ~70 tasks

---

**Last Updated:** November 2, 2025, 11:45 PM PST  
**Next Update:** Continue with Phase 1C (Tasks 1C.2.2-1C.4) and Phase 1D (all 6 tasks)
