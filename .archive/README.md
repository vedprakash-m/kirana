# Kirana MVP Documentation

This directory contains the consolidated product documentation for the Kirana MVP.

---

## 📚 Core Documentation (Single Source of Truth)

### 📋 [PRD_Kirana.md](./PRD_Kirana.md)
**Audience:** Engineering, Product, and Design teams  
**Purpose:** Product Requirements Document - Complete feature specifications, success metrics, and business logic

**Key Sections:**
- Core Loop & Value Proposition
- Success Metrics & KPIs with Acceptance Criteria
- Feature Details (Prediction Model, Data Ingestion, Smart Alerts)
- User Experience & Onboarding Flows
- Technical Architecture Overview
- Phased Rollout Strategy (19-week timeline)
- Risk Mitigation & Pivot Plans
- Open Questions & Decision Log

**What's Included from External Reviews:**
- Silent failure detection for email parsing (Gemini feedback)
- Quantified "Needs Review" chore threshold (<2 min/session)
- Simplified Phase 1 scope (6→3 features, ChatGPT feedback)
- B2B revenue expansion opportunities
- Photo OCR parallel path for resilience

---

### 🔧 [Tech_Spec_Kirana.md](./Tech_Spec_Kirana.md)
**Audience:** Engineering team  
**Purpose:** Technical Design Specification - Complete implementation details for developers

**Key Sections:**
- System Architecture & Technology Stack
- Data Model & Schema Design (Cosmos DB containers)
- API Design (RESTful endpoints with request/response specs)
- Frontend Architecture (React + TypeScript + PWA)
- Backend Services (Azure Functions implementation)
- Intelligence Layer (Gemini API integration, cost controls)
- Authentication & Authorization (Entra ID)
- Offline Strategy & Data Sync
- Security & Privacy Implementation
- Performance & Scalability Patterns
- Testing Strategy & Coverage Requirements
- Observability & Monitoring
- Deployment & DevOps Pipeline

**What's Included from External Reviews:**
- LLM cost control with circuit breaker (Cosmos DB tracking)
- Hybrid parsing strategy (deterministic + Gemini + queue fallback)
- Prediction algorithm with Z-score outlier detection
- Gemini Vision API integration rationale (vs Azure CV)
- Rate limiting configuration (Azure Functions host.json)

---

### � [UNIT_NORMALIZATION_LIBRARY.md](./UNIT_NORMALIZATION_LIBRARY.md)
**Audience:** Engineers implementing normalization logic  
**Purpose:** Reference implementation for unit conversion and item name canonicalization

**Key Sections:**
- Multi-strategy normalization (SKU lookup, multi-pack parsing, fractions)
- Complete conversion tables (volume, weight, count)
- Edge case handling (12 oz vs 12 fl oz, promotional formats)
- TypeScript implementation with zero dependencies
- Test harness requirements (1,000 SKU coverage)

---

## 🗂️ Archived Documentation

Historical documents have been moved to `/.archive/` to prevent knowledge fragmentation. These contain valuable context but **all key decisions are now incorporated into PRD and Tech Spec above**.

**Archived files:**
- `EXECUTIVE_SUMMARY.md` - Stakeholder presentation (business case, budget, financial projections)
- `GEMINI_FEEDBACK_RESPONSE.md` - External PRD review feedback (Oct 2025)
- `CHATGPT_FEEDBACK_RESPONSE.md` - External PRD review feedback (Oct 2025)
- `GEMINI_VISION_OCR_DECISION.md` - Architecture decision record for OCR choice
- `Tech_Spec_Kirana_backup_20251102_002011.md` - Pre-consolidation backup

**Why archived:** All feedback and decisions have been incorporated into the current PRD and Tech Spec. These files are preserved for historical reference but are no longer needed for day-to-day development.

---

## 🔍 Quick Reference

| Question | Document | Section |
|----------|----------|---------|
| **What features are we building?** | PRD_Kirana.md | Section 4 (Feature Details) |
| **How does the prediction model work?** | Tech_Spec_Kirana.md | Section 6.3 (Predictions Function) |
| **What's the budget and timeline?** | PRD_Kirana.md | Section 6 (Resource Requirements) |
| **What are the success metrics?** | PRD_Kirana.md | Section 3 (Success Metrics) |
| **What if email parsing fails?** | PRD_Kirana.md | Section 9 (Risk Mitigation), Tech_Spec Section 7.2 (Hybrid Parsing) |
| **How does offline sync work?** | Tech_Spec_Kirana.md | Section 9 (Data Sync & Offline Strategy) |
| **When do we make go/no-go decisions?** | PRD_Kirana.md | Section 8 (Phased Rollout & Timeline) |
| **What's the data schema?** | Tech_Spec_Kirana.md | Section 3 (Data Model & Schema Design) |
| **How do we control LLM costs?** | Tech_Spec_Kirana.md | Section 7.1 (Gemini API Integration), Section 10 (Cost Optimization) |
| **What's our security model?** | Tech_Spec_Kirana.md | Section 11 (Security & Privacy) |

---

## 📖 Reading Order

### For Engineering Teams:
1. **PRD_Kirana.md** - Understand product requirements, features, and acceptance criteria
2. **Tech_Spec_Kirana.md** - Implementation details, APIs, architecture patterns
3. **UNIT_NORMALIZATION_LIBRARY.md** - Reference when implementing parsing/normalization

### For Product Teams:
1. **PRD_Kirana.md** - Complete product context, metrics, and rollout strategy
2. **Tech_Spec_Kirana.md** (Sections 1-2 only) - High-level architecture overview

### For Stakeholders/Leadership:
1. **PRD_Kirana.md** (Sections 1-3, 6, 8-9) - Business case, metrics, timeline, risks
2. **/.archive/EXECUTIVE_SUMMARY.md** - Stakeholder-friendly overview with financial projections (if needed)

---

## 📝 Version History

| Version | Date | Changes | Confidence |
|---------|------|---------|------------|
| 1.0 | Oct 2025 | Initial PRD (web-first MVP) | 7.5/10 |
| 1.1 | Oct 2025 | Phased rollout, risk mitigation, cost controls | 9.0/10 |
| 1.2 | Oct 2025 | Gemini review: silent failure detection, B2B streams, chore threshold | 9.5/10 |
| 1.3 | Oct 2025 | ChatGPT review: simplified Phase 1 (6→3 features), tiered KPIs, LLM backup | 9.7/10 |
| **1.4** | **Nov 2025** | **Tech Spec v1.1: Hardened cost controls, parsing reliability, consolidated docs** | **9.7/10** |

---

## 🔄 Document Maintenance

**Single Source of Truth:** PRD and Tech Spec are the authoritative documents. All other documentation derives from these.

- **PRD_Kirana.md:** Update when product requirements, features, or success criteria change
- **Tech_Spec_Kirana.md:** Update when technical decisions are finalized (APIs, schemas, architecture)
- **UNIT_NORMALIZATION_LIBRARY.md:** Update when adding new conversion rules or edge cases
- **README.md (this file):** Update when document structure changes

**After Each Phase Gate (Week 6, 10, 18, 24):**
- Update PRD Section 8 (Timeline) with actual progress vs. plan
- Update Tech Spec observability sections with real-world learnings
- Document any pivots or scope changes in both PRD and Tech Spec

---

## 🔗 Related Resources

- **Design Files:** [Figma link - TBD]
- **Engineering Wiki:** [Confluence/Notion link - TBD]
- **Project Board:** [Jira/Linear link - TBD]
- **Slack Channel:** `#kirana-mvp`
- **Archived Documentation:** `/.archive/` (historical context, external reviews, pre-consolidation backups)

---

## 📊 Documentation Stats

| File | Lines | Size | Purpose |
|------|-------|------|---------|
| PRD_Kirana.md | ~2,500 | ~85KB | Product requirements |
| Tech_Spec_Kirana.md | 3,285 | 112KB | Technical implementation |
| UNIT_NORMALIZATION_LIBRARY.md | ~250 | ~12KB | Reference code |
| **Total Active Docs** | **~6,035** | **~209KB** | **Single source of truth** |

**Consolidation Impact (Nov 2, 2025):**
- Reduced from 9 files → 4 files (56% reduction)
- Archived 5 files (211KB) containing redundant/historical content
- Tech Spec consolidated from 4,737 → 3,285 lines (31% reduction)
- All external feedback and decisions now incorporated into PRD/Tech Spec

---

**Last Updated:** November 2, 2025  
**Document Owner:** Product & Engineering Teams  
**Status:** Ready for Implementation (v1.4 - Hardened)
