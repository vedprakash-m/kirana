# Kirana UX Design Specification

**Document Version:** 1.3 (Production-Ready Polish)  
**Last Updated:** November 2, 2025  
**Status:** Ready for Design & Development  
**Author(s):** Design Team  

---

## 🎨 Document Overview

This UX Design Specification defines the user experience, interaction patterns, visual design, and information architecture for Kirana's web application (Phase 1-3). It translates the PRD requirements and technical architecture into concrete, implementable user interfaces optimized for usability, accessibility, and the **"activate users within 5 minutes" goal** (PRD requirement: see first personalized prediction within 5 minutes).

### Key Revisions

**v1.1 (Gemini Review):**
- **Dynamic urgency colors**: Color-coding now relative to item's purchase frequency (not static thresholds)
- **Onboarding redesigned**: CSV wait time now productive with Teach Mode fallback
- **Confidence transparency**: Tooltips show prediction reasoning (builds trust)
- **Micro-review A/B test**: Both 2-tap and 3-tap variants documented

**v1.2 (Copilot Review):**
- **Chip-based Teach Mode**: Pre-suggested items with frequency chips (reduces typing)
- **CSV pending banner**: Persistent Home banner with deep-link upload when ready
- **Confidence Coach panel**: Household trust meter with actionable improvement tips
- **Grouped micro-review**: Accept-all for similar items from same receipt
- **Inline quick-edit**: Quantity/unit editing without modal (80/20 optimization)
- **Demo → Real transition**: Clear interstitial when first real item added
- **Urgency ratio labels**: "Critical · 14% of cycle left" for auditability
- **Retailer quality labels**: Amazon "Best Start", Costco "Supported", Instacart "Experimental"
- **Analytics instrumentation**: Comprehensive event tracking for activation, trust, review efficacy

**v1.3 (Perplexity Review - Final Polish):**
- **Pause/resume micro-review**: Reduces fatigue for large imports, saves progress
- **Friendlier error messages**: Conversational tone, avoids blame, offers clear next steps
- **Proactive conflict warnings**: Real-time presence detection prevents edit collisions
- **Mobile summary views**: Collapsible sections for complex screens (Item Detail, Prediction Timeline)
- **Onboarding simplification**: Single primary CTA reduces decision paralysis, progressive disclosure for advanced options

### Design Principles

1. **Friction Minimization**: Every screen should have a clear primary action completable in ≤2 taps
2. **Progressive Disclosure**: Show core value immediately, reveal complexity only when needed
3. **Intelligent Defaults**: Pre-fill forms with smart guesses from LLM/history to reduce typing
4. **Forgiveness**: Make all actions reversible with undo or soft deletes
5. **Offline Resilience**: Every interaction should work offline with clear sync status indicators
6. **Accessibility First**: WCAG 2.1 AA compliance from day one, not retrofitted

---

## Table of Contents

1. [Information Architecture](#1-information-architecture)
2. [Navigation System](#2-navigation-system)
3. [Screen-by-Screen Design](#3-screen-by-screen-design)
4. [Component Library](#4-component-library)
5. [Interaction Patterns](#5-interaction-patterns)
6. [Visual Design System](#6-visual-design-system)
7. [Responsive Design Strategy](#7-responsive-design-strategy)
8. [Accessibility Guidelines](#8-accessibility-guidelines)
9. [Error States & Edge Cases](#9-error-states--edge-cases)
10. [Animation & Micro-interactions](#10-animation--micro-interactions)
11. [Onboarding Flow](#11-onboarding-flow)
12. [Multi-User Household UX](#12-multi-user-household-ux)

---

## 1. Information Architecture

### 1.1 Site Map (Phase 1-2)

```
Kirana Web App
│
├── 🏠 Home (Dashboard)
│   ├── Running Out Soon (≤7 days)
│   ├── Needs Attention (low confidence predictions)
│   ├── Quick Actions (Add Item, Upload Receipt, Take Photo)
│   └── Recent Activity Feed
│
├── 📦 My Inventory
│   ├── All Items (default view)
│   ├── Filter by Category
│   ├── Filter by Vendor
│   ├── Sort by Run-out Date / Name / Last Purchased
│   └── Item Detail View
│       ├── Prediction Graph
│       ├── Purchase History
│       ├── Price Trends
│       └── Edit / Delete / One-Tap Restock
│
├── 🛒 Shopping List (Phase 2)
│   ├── Auto-generated from predictions
│   ├── Grouped by Vendor
│   ├── Manual additions
│   └── Share List (export, email)
│
├── 📥 Import
│   ├── Upload CSV (Amazon, Instacart)
│   ├── Take Photo (receipt)
│   ├── Forward Email (setup instructions)
│   └── Import History (past jobs)
│
├── 📊 Insights (Phase 3)
│   ├── Spending Trends
│   ├── Waste Reduction Score
│   ├── Top Categories
│   └── Vendor Comparison
│
└── ⚙️ Settings
    ├── Profile & Household
    ├── Notification Preferences
    ├── Data & Privacy
    ├── Help & Support
    └── Logout
```

### 1.2 User Flow: First-Time User (Activation Goal: <5 minutes)

```
Landing Page
    ↓
[Sign In with Microsoft] ← Entra ID OAuth (~15 seconds)
    ↓
Welcome Screen (Demo Mode) → Value demonstrated in <30 seconds
    ├─→ [View Sample Items] (3-5 pre-populated demos)
    │       ↓
    │   Explore Demo Inventory → CTA: "Try with your data"
    │
    ├─→ [Start Amazon Import] ← Primary CTA
    │       ↓
    │   Instructions (open Amazon, request CSV) → 5-10 min email wait
    │       ↓
    │   PIVOT: "While you wait, let's get your first predictions"
    │       ↓
    │   Teach Mode: Add 3-5 frequent items → Immediate predictions!
    │       ↓
    │   (Later) CSV email arrives → Upload → Merge with existing items
    │
    └─→ [Skip, Add Manually] ← Secondary option
            ↓
        Teach Mode Flow → Add 3-5 Items → Predictions Generated
```

**Success Criteria**: 
- **Primary path (CSV + Teach Mode)**: User sees first personalized prediction within 5 minutes (via Teach Mode while waiting for CSV)
- **Secondary path (Manual only)**: User sees first prediction within 3 minutes (Teach Mode for 3 items)
- **Demo path**: User understands value proposition within 30 seconds (interactive demo)

### 1.3 Core User Journeys

**Journey 1: Restock a Running-Out Item (Target: <10 seconds)**
1. User opens app → Home dashboard shows "Milk running out in 2 days" (red badge)
2. User taps [One-Tap Restock] button on Milk card
3. Optimistic UI update: Badge turns green "Predicted run-out: 9 days"
4. Toast notification: "Milk restocked. Added $4.99 purchase."
5. Background: API call creates transaction, recalculates prediction

**Journey 2: Upload Amazon Order History (Target: <5 minutes total, including wait time)**
1. User taps [Import] → [Start Amazon Import]
2. Step-by-step instructions with [Open Amazon] button → New tab opens
3. User requests CSV on Amazon → System shows: "Report will arrive via email in 5-10 minutes"
4. **PIVOT**: "While you wait, add your 3 most frequent items for instant predictions"
5. User adds items via Teach Mode (Milk: 7 days, Eggs: 14 days, Bread: 5 days)
6. Predictions generated immediately: "Milk runs out in 7 days (Low confidence - Teach Mode)"
7. **Achievement unlocked**: User activated with personalized predictions in <3 minutes
8. (10 minutes later) Push notification: "Your Amazon report is ready to upload"
9. User returns → Upload CSV → Parsing progress (real-time updates every 500ms)
10. System detects duplicates: "Found Milk in your CSV. Merging with existing item."
11. Results summary: "45 items parsed, 42 auto-added, 3 duplicates merged, 3 need review"
12. Micro-review bottom sheet for ambiguous items (if needed)
13. Success screen: "Your inventory is complete! 45 items tracking with high-confidence predictions."

**Journey 3: Manual Item Entry with Teach Mode (Target: <30 seconds)**
1. User taps [+ Add Item] FAB
2. Form pre-filled with cursor in "Item name" field
3. User types "Almond Milk" → LLM suggests: "Almond Milk, Unsweetened" + brand dropdown
4. User selects brand, quantity (1), unit (carton), size (64 fl oz)
5. Teach Mode toggle ON → Slider: "How often do you buy this?" → 14 days
6. Tap [Save] → Item card appears with prediction "Run out in 14 days (Low confidence)"
7. Tooltip: "Record your next purchase to improve accuracy"

---

## 2. Navigation System

### 2.1 Primary Navigation (Desktop: Left Sidebar, Mobile: Bottom Tab Bar)

**Desktop (≥1024px width)**
- Fixed left sidebar (240px wide, collapsible to 64px icon-only)
- Logo + household name at top
- Navigation items with icons + labels
- Settings at bottom
- Sync status indicator (animated icon when syncing)

**Mobile (<1024px width)**
- Fixed bottom tab bar (60px height)
- 5 tabs maximum (Home, Inventory, Import, Shopping List, More)
- Active tab highlighted with color + icon fill
- Badge indicators for notifications (e.g., "3 items need review")

### 2.2 Navigation Items

| Icon | Label | Priority | Desktop | Mobile | Keyboard Shortcut |
|------|-------|----------|---------|--------|-------------------|
| 🏠 | Home | P0 | Always | Tab 1 | `Ctrl/Cmd + H` |
| 📦 | Inventory | P0 | Always | Tab 2 | `Ctrl/Cmd + I` |
| 📥 | Import | P0 | Always | Tab 3 | `Ctrl/Cmd + U` |
| 🛒 | Shopping List | P1 (Phase 2) | Always | Tab 4 | `Ctrl/Cmd + L` |
| 📊 | Insights | P2 (Phase 3) | Collapsible | "More" menu | `Ctrl/Cmd + D` |
| ⚙️ | Settings | P1 | Bottom | Tab 5 "More" | `Ctrl/Cmd + ,` |

### 2.3 Context-Specific Navigation

**Item Detail View**
- Back button (top-left) → Returns to previous view
- Breadcrumb (desktop): Home > Inventory > Milk
- Action menu (top-right): Edit, Delete, Share, Export history

**Micro-Review Modal**
- Progress indicator: "Review 2 of 3"
- Skip button (top-right) → Defers review, marks item for later
- Dismiss (X) button → Returns to parsing progress, queue persists

---

## 3. Screen-by-Screen Design

### 3.1 Home Dashboard

**Layout Structure** (Desktop: 3-column, Mobile: Single column)

```
┌────────────────────────────────────────────────────────────┐
│  Header: "Welcome back, Ved" | [🔔] [👤] [⚙️]            │
├────────────────────────────────────────────────────────────┤
│  Quick Stats Bar                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 47 Items │ │ 5 Running│ │ 3 Need   │ │ $142     │    │
│  │ Tracked  │ │ Out Soon │ │ Review   │ │ This Week│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├────────────────────────────────────────────────────────────┤
│  Running Out Soon (≤7 days)                    [View All] │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ 🥛 Milk             │  │ 🥚 Eggs              │        │
│  │ Organic Valley      │  │ Happy Egg Co.        │        │
│  │ ⚠️ 2 days left      │  │ ⚠️ 4 days left       │        │
│  │ High confidence     │  │ Medium confidence    │        │
│  │ [One-Tap Restock]   │  │ [One-Tap Restock]    │        │
│  └─────────────────────┘  └─────────────────────┘        │
├────────────────────────────────────────────────────────────┤
│  Confidence Coach                              [View All] │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Your Household Prediction Health: 73%           │   │
│  │ ████████████████████░░░░░░                         │   │
│  │                                                    │   │
│  │ High confidence: 15 items                          │   │
│  │ Medium confidence: 8 items                         │   │
│  │ Low confidence: 3 items (🍞 Bread, 🫒 Olive Oil…) │   │
│  │                                                    │   │
│  │ 💡 Improve low-confidence items:                   │   │
│  │ • Record 2 more purchases for Bread [+ Restock]   │   │
│  │ • Set frequency for Olive Oil [🎓 Teach Mode]     │   │
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────┤
│  Needs Your Attention                          [View All] │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ 📥 CSV Upload       │  │ 🔄 Sync Conflict     │        │
│  │ 3 items need review │  │ 1 item edited on     │        │
│  │ [Review Now]        │  │ another device       │        │
│  │                     │  │ [Resolve]            │        │
│  └─────────────────────┘  └─────────────────────┘        │
├────────────────────────────────────────────────────────────┤
│  Quick Actions                                             │
│  [+ Add Item] [📤 Upload CSV] [📷 Take Photo]            │
├────────────────────────────────────────────────────────────┤
│  Recent Activity (last 7 days)                [View All] │
│  • Milk restocked (today)                                 │
│  • Eggs added to inventory (2 days ago)                   │
│  • Amazon CSV imported: 15 items (3 days ago)             │
└────────────────────────────────────────────────────────────┘
```

**Component Details**

**Quick Stats Bar**
- 4 metric cards (responsive: 2×2 grid on mobile)
- Each card: Icon, large number, small label
- Clickable → Filters relevant view (e.g., "5 Running Out Soon" → Inventory filtered <7 days)
- Color-coded: Red (urgent), Yellow (attention), Green (healthy), Gray (neutral)

**Running Out Soon Section**
- Horizontal scrollable card list (mobile) or 2-3 column grid (desktop)
- Maximum 6 items shown, sorted by urgency score (ascending)
- **Urgency score** = daysRemaining / avgFrequencyDays (lower = more urgent)
- Each card shows: Icon/emoji, canonical name, brand, days left with dynamic color (red/yellow/green), confidence badge, CTA button
- Color coding is item-specific (see Section 6.1 for algorithm)
- Empty state: "You're all stocked up! 🎉" with illustration

**Needs Your Attention Section**
- Cards for: Low confidence predictions, pending reviews, failed imports
- Each card has primary action button
- Dismissible (swipe or X button) → Snoozed for 3 days

**Quick Actions**
- Large touch targets (min 48×48px)
- Icon + label for clarity
- Disabled states when offline (with explanatory tooltip)

### 3.2 My Inventory (List View)

**Layout Structure**

```
┌────────────────────────────────────────────────────────────┐
│  My Inventory (47 items)                  [+ Add] [Filter]│
├────────────────────────────────────────────────────────────┤
│  Search: [🔍 Search items...]                   [Sort ▾]  │
├────────────────────────────────────────────────────────────┤
│  Active Filters: [Dairy ×] [Running Out ×]    [Clear All] │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🥛 Milk · Organic Valley                   [⋮]      │ │
│  │ Runs out in 2 days · High confidence                │ │
│  │ Last purchase: Oct 29 · $4.99/64 fl oz              │ │
│  │ [One-Tap Restock]              [View Details →]     │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🥚 Eggs · Happy Egg Co.                    [⋮]      │ │
│  │ Runs out in 4 days · Medium confidence              │ │
│  │ Last purchase: Oct 25 · $6.99/dozen                 │ │
│  │ [One-Tap Restock]              [View Details →]     │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🍞 Bread · Dave's Killer Bread             [⋮]      │ │
│  │ Runs out in 5 days · Low confidence ⚠️              │ │
│  │ Last purchase: Oct 20 · $5.49/loaf                  │ │
│  │ [One-Tap Restock]              [View Details →]     │ │
│  └──────────────────────────────────────────────────────┘ │
│  ... (44 more items, infinite scroll/pagination)          │
└────────────────────────────────────────────────────────────┘
```

**Interaction Patterns**

**Search**
- Instant filter as user types (debounced 300ms)
- Searches: canonical name, brand, category, vendor
- Keyboard shortcut: `/` focuses search
- Clear button (X) appears when text entered

**Sort Options** (Dropdown menu)
- Run-out Date (soonest first) ← Default
- Name (A-Z)
- Last Purchased (newest first)
- Recently Added
- Price (low to high)

**Filter Options** (Modal or slide-out panel)
- Category (multi-select checkboxes)
- Vendor (multi-select checkboxes)
- Confidence Level (High/Medium/Low)
- Status (Running Out/Healthy/Low Confidence)
- Date Range (custom picker)
- Apply/Reset buttons

**Item Card Actions** (Three-dot menu)
- Edit Item
- View Purchase History
- Delete Item (with confirmation)
- Exclude from Shopping List
- Share (copy link to item)

**Empty States**
- No items: "Start by importing your order history or adding items manually" + CTA buttons
- No search results: "No items match 'query'" + [Clear Search] button
- All filtered out: "No items match these filters" + [Reset Filters] button

### 3.3 Item Detail View

**Layout Structure (Desktop)**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Milk · Organic Valley              [Edit] [⋮]  │
├────────────────────────────────────────────────────────────┤
│  Status: Runs out in 2 days (Nov 4, 2025)                 │
│  Confidence: High (95%)                                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │         📊 Prediction Timeline (12 months)         │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │   ⚫────⚫────⚫────⚫────⚫────⚫ (purchases) │  │   │
│  │  │     \_____\_____\_____\_____\_____\         │  │   │
│  │  │       Avg 7.2 days between purchases        │  │   │
│  │  │                                             │  │   │
│  │  │   Today ↑         Predicted run-out ↓      │  │   │
│  │  │   Nov 2            Nov 4 (2 days)           │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │  [Override Prediction] (advanced users)          │   │
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────┤
│  Item Details                                              │
│  Category: Dairy                                           │
│  Unit: 64 fl oz carton                                     │
│  Preferred Vendor: Whole Foods                             │
│  Average Price: $4.99 (last 6 purchases)                   │
│  Price Trend: ↓ $0.20 cheaper than 3 months ago           │
├────────────────────────────────────────────────────────────┤
│  Purchase History (last 10)                   [View All]  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Oct 29, 2025 · $4.99 · Whole Foods · 1× 64 fl oz  │   │
│  │ Oct 22, 2025 · $5.19 · Safeway · 1× 64 fl oz      │   │
│  │ Oct 15, 2025 · $4.99 · Whole Foods · 1× 64 fl oz  │   │
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────┤
│  Actions                                                   │
│  [One-Tap Restock]  [Record Custom Purchase]  [Delete]   │
└────────────────────────────────────────────────────────────┘
```

**Layout Structure (Mobile <640px) - Optimized Summary View**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Milk                               [Edit] [⋮]  │
├────────────────────────────────────────────────────────────┤
│  🥛 Organic Valley · Dairy                                 │
│  Runs out in 2 days (Nov 4)                                │
│  High confidence · Critical · 29% left                     │
├────────────────────────────────────────────────────────────┤
│  Quick Summary                                 [▼ Details] │
│  • Last purchase: Oct 29 at Whole Foods ($4.99)            │
│  • Avg frequency: Every 7 days                             │
│  • Price trend: ↓ Cheaper than usual                       │
├────────────────────────────────────────────────────────────┤
│  📊 Prediction Pattern                         [▼ Graph]   │
│  ⚫──⚫──⚫──⚫──⚫  (last 5 purchases)                       │
│  Consistent 7-day cycle                                    │
│                                                            │
│  (Expandable accordion shows full 12-month timeline)       │
├────────────────────────────────────────────────────────────┤
│  Recent Purchases                         [▼ View All 12]  │
│  Oct 29 · $4.99 · Whole Foods                              │
│  Oct 22 · $5.19 · Safeway                                  │
│  Oct 15 · $4.99 · Whole Foods                              │
│                                                            │
│  (Collapsed by default, expands on tap)                    │
├────────────────────────────────────────────────────────────┤
│  Actions                                                   │
│  [One-Tap Restock]                                         │
│  [Record Custom Purchase]                                  │
│  [Delete Item]                                             │
└────────────────────────────────────────────────────────────┘
```

**Mobile Optimization Strategy**
- **Summary-first**: Key info (run-out date, confidence, last purchase) above fold
- **Collapsible sections**: Graph, full history, detailed stats hidden by default
- **Simplified graph**: Sparkline with last 5 purchases instead of 12-month timeline
- **Stacked actions**: Full-width buttons for easy thumb access
- **Progressive disclosure**: Tap [▼ Details] to expand sections as needed
- **Reduces scroll**: Mobile view ~2 screen heights vs desktop 1 screen

**Component Details**

**Prediction Timeline (Interactive Chart)**
- X-axis: Last 12 months of purchase dates
- Y-axis: Quantity (if variable)
- Data points: Purchase events (dots)
- Trend line: Exponential smoothing curve (dashed)
- Confidence interval: Shaded area (wider = lower confidence)
- Hover/tap on data point → Tooltip: "Oct 29: $4.99 at Whole Foods"
- Responsive: Full chart on desktop, simplified sparkline on mobile

**Override Prediction** (Advanced Feature, Phase 2)
- Collapsed by default (expandable accordion)
- Shows: "Algorithm says: Nov 4" vs "You say: [Date picker]"
- Records override in `userOverrides` array
- Future predictions weighted toward user input

**Actions**
- **One-Tap Restock**: Pre-fills last quantity/price/vendor, records transaction immediately
- **Record Custom Purchase**: Opens form with date/vendor/price/quantity fields (for backdating or different store)
- **Delete**: Soft delete with confirmation modal: "This will remove Milk and its 12-month history. Undo available for 30 days."

### 3.4 Import: Upload CSV Flow

**Layout Structure**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Import from CSV                                 │
├────────────────────────────────────────────────────────────┤
│  Step 1: Choose Your Retailer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Amazon     │  │   Costco     │  │   Instacart  │     │
│  │   [Logo]     │  │   [Logo]     │  │   [Logo]     │     │
│  │ 🌟 Best Start│  │ ✓ Supported  │  │ 🧪 Experimental│   │
│  │ (12-mo data) │  │ (Receipts)   │  │ (Beta)       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐                                          │
│  │   Other      │  (AI parsing - may be slower)            │
│  │   [Generic]  │                                          │
│  └──────────────┘                                          │
├────────────────────────────────────────────────────────────┤
│  Step 2: Upload File                                       │
│  ┌────────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │         📁 Drag and drop CSV file here            │   │
│  │              or [Browse Files]                    │   │
│  │                                                    │   │
│  │     Supported formats: .csv, .xlsx, .txt          │   │
│  │     Max size: 10 MB                               │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  💡 How to get your CSV:                                   │
│  [Show instructions for selected retailer ▼]              │
└────────────────────────────────────────────────────────────┘
```

**After File Upload: Parsing Progress**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Parsing Amazon Order History                   │
├────────────────────────────────────────────────────────────┤
│  Processing...                                             │
│  ████████████████████░░░░░░░ 72% (45 of 62 items)         │
│                                                            │
│  Status:                                                   │
│  ✓ 42 items auto-added to inventory                       │
│  ⚠️ 3 items need your review                              │
│  ✗ 0 items failed to parse                                │
│                                                            │
│  [Cancel Import]                                           │
└────────────────────────────────────────────────────────────┘
```

**Parsing Complete: Results Summary**

```
┌────────────────────────────────────────────────────────────┐
│  Import Complete! 🎉                                       │
├────────────────────────────────────────────────────────────┤
│  Summary:                                                  │
│  ✓ 42 items successfully added                            │
│  ⚠️ 3 items need review (low confidence parsing)          │
│  ✗ 0 items failed                                         │
│                                                            │
│  📊 Predictions are being calculated (1-2 minutes)         │
│  You'll get a notification when ready.                     │
│                                                            │
│  What's next?                                              │
│  [Review 3 Items]  [View My Inventory]  [Import More]    │
└────────────────────────────────────────────────────────────┘
```

**Micro-Review Bottom Sheet** (Slides up when user taps "Review 3 Items")

```
┌────────────────────────────────────────────────────────────┐
│  Review Item 1 of 3                               [Skip] │
├────────────────────────────────────────────────────────────┤
│  We parsed this from your receipt:                         │
│                                                            │
│  Item: Organic Whole Milk                                  │
│  Brand: Horizon                                            │
│  Quantity: 1                                               │
│  Unit: 64 fl oz                                            │
│  Price: $5.99                                              │
│  Confidence: 65% (Low) ⚠️                                  │
│                                                            │
│  Original text: "Horizon Org Milk 1/2gal $5.99"           │
│                                                            │
│  Does this look correct?                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   ✓ Accept   │  │   ✏️ Edit    │  │   ✗ Reject   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────────────────────────────────────────────────┘
```

**Micro-Review: Edit Mode** (After tapping Edit)

```
┌────────────────────────────────────────────────────────────┐
│  Edit Item 1 of 3                        [Cancel] [Save] │
├────────────────────────────────────────────────────────────┤
│  Item Name: [Organic Whole Milk________________________]  │
│  Brand: [Horizon__________________________________]        │
│  Quantity: [1___] Unit: [64 fl oz ▼]                      │
│  Price: [$5.99___]                                         │
│                                                            │
│  Original: "Horizon Org Milk 1/2gal $5.99"                │
└────────────────────────────────────────────────────────────┘
```

**Component Details**

**Retailer Selection Cards**
- Large touch targets (desktop: 150×120px, mobile: full-width)
- Visual hierarchy: Logo prominent, "✓ Tested" badge for confidence
- Hover state: Border highlight, subtle elevation
- Selection: Blue border, checkmark icon
- "Other" option shows info tooltip: "We'll use AI to parse your file. May take longer and cost more."

**Drag-and-Drop Zone**
- Dashed border, light background
- Animated on hover (pulsing border)
- On file drag: Solid border, darker background, "Drop here" text
- On file drop: Loading spinner replaces zone
- On error: Red border, error message below

**Parsing Progress**
- Real-time updates via WebSocket or polling (500ms interval)
- Animated progress bar with percentage
- Live status updates: "Parsing item 45 of 62..."
- Cancel button triggers confirmation: "Are you sure? Parsed items will be saved, but remaining items will be skipped."

**Micro-Review Bottom Sheet**
- Persistent bottom position (mobile) or modal overlay (desktop)
- Swipe down to minimize (mobile only)
- Progress indicator: "1 of 3" with dots (● ● ○)
- Skip button: Defers item to manual review queue, auto-advances to next
- Reject button: Marks item as unparseable, excludes from inventory, logs for analysis

### 3.5 Import: Take Photo Flow

**Layout Structure**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Scan Receipt                                    │
├────────────────────────────────────────────────────────────┤
│  Position your receipt in the frame                        │
│  ┌────────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │         📷 [Camera Preview]                        │   │
│  │                                                    │   │
│  │     ┌────────────────────────────────┐            │   │
│  │     │                                │            │   │
│  │     │   [Receipt alignment guide]    │            │   │
│  │     │                                │            │   │
│  │     └────────────────────────────────┘            │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Tips for best results:                                    │
│  ✓ Good lighting, avoid shadows                           │
│  ✓ Flatten receipt, all text visible                      │
│  ✓ High contrast background                               │
│                                                            │
│  [🌟 Flash] [🔄 Flip Camera]        [📷 Capture]         │
│                                                            │
│  Or upload existing photo: [📁 Browse Gallery]            │
└────────────────────────────────────────────────────────────┘
```

**After Capture: Preview & Confirm**

```
┌────────────────────────────────────────────────────────────┐
│  [← Retake]  Confirm Receipt                    [✓ Use]   │
├────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │         [Captured receipt preview]                 │   │
│  │                                                    │   │
│  │         Zoom/pan enabled                           │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Detected: Whole Foods receipt                             │
│  Date: Nov 1, 2025                                         │
│                                                            │
│  [Crop/Rotate] [Enhance Contrast]                         │
└────────────────────────────────────────────────────────────┘
```

**Processing & Results** (Same as CSV flow)
- Parsing progress with live updates
- Results summary with review count
- Micro-review bottom sheet for low-confidence items

**Component Details**

**Camera Interface**
- Native camera access via WebRTC (desktop) or `<input type="file" capture="environment">` (mobile)
- Alignment guide: Semi-transparent overlay showing optimal receipt position
- Auto-focus on center of guide
- Capture button: Large (80×80px), bottom-center, high contrast
- Flash toggle: Only shown if device has flash capability
- Gallery fallback: For users who already photographed receipt

**Image Enhancement**
- Auto-crop to detected receipt boundaries (ML model or edge detection)
- Auto-contrast adjustment for readability
- Manual tools: Rotate 90°, crop drag handles, brightness slider
- Preview shows before/after comparison

### 3.6 Add Item Manually

**Layout Structure**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Add Item                         [Save] [✓]    │
├────────────────────────────────────────────────────────────┤
│  Item Name *                                               │
│  [_________________________________________________]       │
│  💡 Start typing for suggestions (e.g., "Milk")            │
│                                                            │
│  Brand                                                     │
│  [Select brand ▼___________________________________]       │
│                                                            │
│  Category *                                                │
│  [Select category ▼________________________________]       │
│                                                            │
│  Quantity & Unit *                                         │
│  [1_____] [Select unit ▼_______________]                  │
│                                                            │
│  Unit Size                                                 │
│  [64_____] [fl oz ▼_________]                             │
│                                                            │
│  Preferred Vendor                                          │
│  [Select vendor ▼__________________________________]       │
│                                                            │
│  ──────────────────────────────────────────────────────    │
│  🎓 Teach Mode (Optional)                      [Toggle ○] │
│  Help us predict when you'll run out                       │
│                                                            │
│  (Collapsed by default, expands when toggled ON)           │
│                                                            │
│  [Cancel]                                       [Save]     │
└────────────────────────────────────────────────────────────┘
```

**Teach Mode Expanded**

```
│  🎓 Teach Mode                                 [Toggle ●] │
│  Help us predict when you'll run out                       │
│                                                            │
│  How often do you buy this item?                           │
│  [Slider: 1──●────────────────30 days]  14 days          │
│                                                            │
│  How much do you typically buy?                            │
│  [1_____] [64 fl oz ▼_________]                           │
│                                                            │
│  💡 We'll use this to make initial predictions. They'll    │
│     improve automatically as you record purchases.         │
```

**Smart Suggestions Dropdown** (Appears as user types in "Item Name")

```
│  Item Name *                                               │
│  [Milk_____________________________________________]       │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🥛 Milk, Whole (commonly purchased)              →│   │
│  │ 🥛 Milk, Almond Unsweetened                       →│   │
│  │ 🥛 Milk, Oat                                      →│   │
│  │ 🥛 Milk, 2% Reduced Fat                           →│   │
│  └────────────────────────────────────────────────────┘   │
```

**Component Details**

**Form Validation**
- Required fields marked with `*` and red border if empty on submit
- Inline validation: "Item name must be 1-200 characters"
- Smart defaults: Quantity defaults to 1, Unit defaults to "each/count"
- Unit dropdown grouped: Weight (oz, lb, kg) | Volume (fl oz, gal, L) | Count (each, pack)

**Smart Suggestions**
- Triggered after 2 characters typed
- Sources: Previously added items, LLM cache, common grocery items
- Arrow keys navigate, Enter selects, Esc closes
- Selecting suggestion auto-fills: Name, Brand (if known), Category, common unit

**Teach Mode**
- Collapsed by default (reduce cognitive load)
- Toggle with animated expand/collapse
- Slider with live value display, snaps to common intervals (7, 14, 30 days)
- Pre-fills "How much" from main form's quantity/unit
- Help text explains: "This gives you accurate predictions from day one"

**Save Behavior**
- Disabled until required fields valid
- On success: Toast "Milk added to inventory" + CTA "View item" or "Add another"
- On error: Inline error messages, form persists user input
- Keyboard shortcut: `Ctrl/Cmd + Enter` to save

---

## 4. Component Library

### 4.1 Item Card (Reusable Component)

**Variants**

**Compact Card** (List view)
```
┌──────────────────────────────────────────────────────┐
│ 🥛 Milk · Organic Valley                   [⋮]      │
│ Runs out in 2 days · High confidence                │
│ Last purchase: Oct 29 · $4.99/64 fl oz              │
│ [One-Tap Restock]              [View Details →]     │
└──────────────────────────────────────────────────────┘
```
- Height: Auto (min 120px)
- Padding: 16px
- Border: 1px solid gray-200, rounded-lg
- Hover: Elevation shadow, border color accent
- Touch: Ripple effect

**Dashboard Card** (Featured view)
```
┌─────────────────────┐
│ 🥛 Milk             │
│ Organic Valley      │
│ ⚠️ 2 days left      │
│ High confidence     │
│ [One-Tap Restock]   │
└─────────────────────┘
```
- Width: 200px (desktop), 160px (mobile)
- Height: 240px
- Padding: 20px
- Border: 2px solid (red/yellow/green based on urgency)
- Card background: Subtle gradient matching urgency color

**Grid Card** (Shopping list view)
```
┌───────────────┐
│ 🥛            │
│ Milk          │
│ 2 days        │
│ [✓ Add]       │
└───────────────┘
```
- Width: 120px × 140px (mobile), 160px × 180px (desktop)
- Minimal text, large icon/emoji
- Checkbox or add button

### 4.2 Confidence Badge

**Visual Design**
- Pill shape, 8px padding horizontal, 4px vertical
- Font: 11px, semibold, uppercase
- Position: Inline after prediction text or top-right corner of card

**Variants** (aligned with Tech Spec prediction model)

| Confidence | Color | Icon | Text | Criteria (from Tech Spec) | Tooltip (shows prediction reasoning) |
|------------|-------|------|------|---------|---------|
| High | Green-100 bg, Green-700 text | ✓ | HIGH | ≥3 purchases + stdDev <20% + recent <30d | "Based on {N} purchases with consistent pattern (±{stdDev} days) and recent purchase ({lastPurchase} days ago)" |
| Medium | Yellow-100 bg, Yellow-700 text | ~ | MEDIUM | 2 purchases OR stdDev <30% | "Based on {N} purchases. Pattern is forming—add {X} more for high confidence" |
| Low | Gray-100 bg, Gray-700 text | ? | LOW | 1 purchase OR irregular pattern | "Based on {N} purchase(s) with variable timing. Record {X} more to improve predictions" |
| Teach Mode | Blue-100 bg, Blue-700 text | 🎓 | LEARNING | User-provided frequency estimate | "Using your estimated frequency ({N} days). Record actual purchases to upgrade to data-driven predictions" |

**Examples (with actual data from Tech Spec):**
- High: "Based on 8 purchases with consistent pattern (±1.2 days) and recent purchase (12 days ago)"
- Medium: "Based on 4 purchases. Pattern is forming—add 2 more for high confidence"
- Low: "Based on 2 purchases with variable timing. Record 1 more to improve predictions"
- Teach Mode: "Using your estimated frequency (7 days). Record actual purchases to upgrade to data-driven predictions"

**Critical Fix**: Removed percentage-based thresholds (≥70%, 50-69%, <50%) which don't match the model. Confidence is now based on **purchase count + consistency + recency** per Tech Spec's `calculateConfidence()` function.

**Why show reasoning?** Transparency builds trust. Users understand WHY confidence is low and WHAT they can do to improve it (actionable guidance).

### 4.3 One-Tap Restock Button

**Visual Design**
- Primary button style (high contrast, filled)
- Desktop: 140px × 40px, "One-Tap Restock" label
- Mobile: 48px × 48px, "↻" icon only (space-constrained)
- Color: Accent brand color (blue-600)

**States**
- Default: Blue-600 background, white text
- Hover: Blue-700, subtle scale (1.02)
- Active: Blue-800, scale (0.98)
- Loading: Spinner replaces icon/text, disabled
- Success: Green-600 for 500ms, checkmark icon, "Restocked!" text
- Error: Red-600, "Failed - Retry?" text

**Interaction**
1. User taps button → Immediate optimistic UI update
2. Item card shows "Restocked!" success state
3. Predicted run-out date updates (e.g., 2 days → 9 days)
4. Toast notification: "Milk restocked. $4.99 added to purchases"
5. Background: POST /api/transactions → Triggers prediction recalc
6. If API fails: Rollback UI, show error toast with retry button

### 4.4 Micro-Review Bottom Sheet

**Technical Implementation**
- Component: Modal (desktop) or Bottom Sheet (mobile)
- Animation: Slide up from bottom (300ms ease-out)
- Dismissal: Swipe down (mobile), click backdrop (desktop), Esc key
- State management: Queue stored in Zustand + IndexedDB (offline persistence)
- Progress: "Item X of Y" with dot indicators
- **A/B Test**: Two variants (per PRD requirement)

**Variant A: 2-Tap (Hypothesis: Faster for majority case)**
```
┌────────────────────────────────────────────────────────────┐
│  ═══ (Drag handle)                                         │
│  Review Item 1 of 3                         [Skip] [✏️]   │
│  ────────────────────────────────────────────────────────  │
│  We parsed: Organic Whole Milk                             │
│  Brand: Horizon | Qty: 1 | Unit: 64 fl oz | $5.99         │
│  Confidence: 65% (Low) ⚠️                                  │
│  ────────────────────────────────────────────────────────  │
│  Original: "Horizon Org Milk 1/2gal $5.99"                │
│  ────────────────────────────────────────────────────────  │
│  [✓ Accept]                            [✗ Reject]         │
│   (primary)                             (outline)          │
└────────────────────────────────────────────────────────────┘
```
- Edit icon (✏️) in top-right, less prominent
- Optimizes for most common action (Accept)
- Reject is secondary (outline button)

**Variant B: 3-Tap (Hypothesis: Better discoverability)**
```
┌────────────────────────────────────────────────────────────┐
│  ═══ (Drag handle)                                         │
│  Review Item 1 of 3                               [Skip] │
│  ────────────────────────────────────────────────────────  │
│  We parsed: Organic Whole Milk                             │
│  Brand: Horizon | Qty: 1 | Unit: 64 fl oz | $5.99         │
│  Confidence: 65% (Low) ⚠️                                  │
│  ────────────────────────────────────────────────────────  │
│  Original: "Horizon Org Milk 1/2gal $5.99"                │
│  ────────────────────────────────────────────────────────  │
│  [✓ Accept]        [✏️ Edit]        [✗ Reject]           │
│   (primary)        (outline)         (outline)             │
└────────────────────────────────────────────────────────────┘
```
- All three actions equal prominence
- Accept is primary (filled button)
- Edit and Reject are secondary (outline buttons)

**Variant C: Grouped Review (For receipts with multiple similar items)**
```
┌────────────────────────────────────────────────────────────┐
│  ═══ (Drag handle)                                         │
│  Review 3 similar items from Whole Foods       [Skip All]│
│  Progress: 3 of 8 items reviewed                  [⏸ Pause]│
│  ────────────────────────────────────────────────────────  │
│  ✓ Organic Whole Milk | 1× 64 fl oz | $5.99               │
│  ✓ Organic Eggs | 1× dozen | $6.49                        │
│  ✓ Organic Bread | 1× loaf | $5.49                        │
│                                                            │
│  [▼ Expand to edit individually]                           │
│                                                            │
│  [✓ Accept All 3]                          [✗ Reject All] │
└────────────────────────────────────────────────────────────┘
```
- Groups items from same receipt/retailer with high confidence (≥80%)
- One-tap "Accept All" for fast processing
- Expandable for per-item review if needed
- **Pause button**: Saves progress, returns user to Home (prevents fatigue)
- Progress indicator shows "X of Y items reviewed"
- Reduces perceived review burden

**Pause/Resume Flow**
```
(After tapping Pause)
┌─────────────────────────────────────────────┐
│  Review paused                              │
│                                             │
│  3 of 8 items reviewed and saved.           │
│  You can finish the rest anytime.           │
│                                             │
│  [Resume Review]  [Finish Later]            │
└─────────────────────────────────────────────┘

(Banner on Home after pausing)
┌────────────────────────────────────────────────────────────┐
│  📋 5 items still need review [Resume →]              [×]│
└────────────────────────────────────────────────────────────┘
```
- User can pause at any point without losing progress
- Banner reminder persists until queue completed or dismissed
- Reduces review fatigue for large imports

**Inline Quick-Edit** (for Variant A & B - 80/20 optimization)
```
│  We parsed: Organic Whole Milk                             │
│  Brand: Horizon | Qty: [1__] [64 fl oz ▼] | $5.99        │
│  ↑ Tap quantity or unit to edit inline (no modal)         │
│  Confidence: 65% (Low) ⚠️                                  │
│                                                            │
│  Original: "Horizon Org Milk 1/2gal $5.99"                │
│                                                            │
│  [✓ Accept]        [✏️ Edit Full]        [✗ Reject]      │
```
- Most edits are quantity/unit corrections (not name changes)
- Inline editing for common fields avoids modal friction
- "Edit Full" button opens modal for complex changes (name, brand, category)

**A/B Test Metrics**
- Primary: Time to complete review queue
- Secondary: Edit rate (if >30% in Variant A, Variant B wins)
- Tertiary: Reject rate, skip rate, grouped vs individual preference
- Post-review: "Was this correct?" micro-poll 24h later for downstream quality

**Accessibility** (All variants)
- Focus trap: Tab cycles through action buttons only
- Keyboard shortcuts: `A` accept, `E` edit, `R` reject, `S` skip
- Screen reader announces: "Review item 1 of 3. Organic Whole Milk, confidence 65%. Accept, Edit, or Reject?"
- Skip button: aria-label "Defer review, continue to next item"

### 4.5 Empty States

**Inventory Empty State**
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                    📦 [Illustration]                       │
│                                                            │
│           Your inventory is empty                          │
│     Start tracking groceries to get smart predictions      │
│                                                            │
│  [📤 Upload CSV]  [📷 Take Photo]  [+ Add Manually]      │
│                                                            │
│              or [Try Demo Mode] to explore                 │
└────────────────────────────────────────────────────────────┘
```

**No Running-Out Items**
```
│                    🎉 [Illustration]                       │
│                                                            │
│              You're all stocked up!                        │
│         No items running out in the next 7 days            │
```

**Search No Results**
```
│                    🔍 [Illustration]                       │
│                                                            │
│           No items match "organic bread"                   │
│                                                            │
│  [Clear Search]  or  [Add "Organic Bread" to inventory]   │
```

**Parsing Failed**
```
│                    ⚠️ [Illustration]                       │
│                                                            │
│      We couldn't parse this receipt                        │
│  The file format wasn't recognized or data is corrupted    │
│                                                            │
│  [Try Again]  [Upload Different File]  [Get Help]         │
```

---

## 5. Interaction Patterns

### 5.1 Primary Actions

**Principle**: Every screen must have one obvious primary action, visually distinct from secondary actions.

**Visual Hierarchy**
1. **Primary Action**: Solid button, accent color, high contrast
   - Examples: "Save", "One-Tap Restock", "Accept", "Upload CSV"
2. **Secondary Action**: Outline button or text link, neutral color
   - Examples: "Cancel", "Skip", "View Details"
3. **Destructive Action**: Red outline or red text
   - Examples: "Delete", "Reject"

**Placement**
- **Mobile**: Primary action bottom-right (thumb-friendly), secondary top-left or inline
- **Desktop**: Primary action bottom-right or top-right of form/modal
- **Forms**: Primary action right-aligned, secondary left-aligned (Western reading order)

### 5.2 Gestures & Touch Interactions

**Mobile-Specific Gestures**

| Gesture | Action | Context | Visual Feedback |
|---------|--------|---------|-----------------|
| **Swipe Right** (on item card) | Quick restock | Inventory list | Card slides right, green background revealed with "↻" icon |
| **Swipe Left** (on item card) | Delete item | Inventory list | Card slides left, red background with trash icon |
| **Long Press** (on item card) | Open context menu | Inventory list | Haptic feedback, menu overlay appears |
| **Pull to Refresh** | Sync inventory | Any list view | Spinning sync icon at top, "Syncing..." text |
| **Swipe Down** (on bottom sheet) | Dismiss sheet | Micro-review, modals | Sheet slides down with spring animation |
| **Pinch to Zoom** | Zoom receipt image | Photo preview | Smooth scale with boundaries |

**Desktop-Specific Interactions**

| Interaction | Action | Visual Feedback |
|-------------|--------|-----------------|
| **Hover on item card** | Show quick actions | Elevation shadow, "Edit" and "Delete" icons appear |
| **Click-and-hold** (500ms) | Start One-Tap Restock | Progress ring around button, releases to confirm |
| **Drag item card** | Reorder (future feature) | Card follows cursor, other cards shift |
| **Double-click item name** | Open item details | Smooth transition, no flash |

### 5.3 Loading States

**Principle**: Never show blank screens. Always provide context during waits.

**Skeleton Screens** (Preferred for content loading)
```
┌──────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓                       [⋮]     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓                          │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓                     │
│ [▓▓▓▓▓▓▓▓▓▓▓▓]              [▓▓▓▓▓▓▓▓▓ →]         │
└──────────────────────────────────────────────────────┘
```
- Mimics layout of actual content
- Animated shimmer effect (left-to-right gradient)
- Duration: Show immediately, no delay
- Used for: Inventory lists, item details, dashboard cards

**Spinners** (For actions and indeterminate waits)
- Small inline spinners (16px) for button actions
- Large centered spinners (48px) for full-page loads
- Always with descriptive text: "Loading inventory...", "Parsing receipt..."
- Timeout: Show error after 30 seconds

**Progress Bars** (For determinate operations)
- Horizontal bar with percentage: "Parsing 45 of 62 items (72%)"
- Color: Accent blue, fills left-to-right
- Used for: CSV parsing, bulk operations, file uploads

**Optimistic UI** (Instant feedback)
- Action appears successful immediately, API call happens in background
- If API fails: Revert UI, show error toast with undo option
- Used for: One-Tap Restock, item edits, simple deletions

### 5.4 Error Handling

**Error Types & Responses**

| Error Type | User Impact | UI Response | Recovery Action |
|------------|-------------|-------------|-----------------|
| **Network Offline** | No sync | Yellow banner: "You're offline. Changes will sync when connected" | Auto-sync when online, no action needed |
| **API Timeout** | Failed action | Toast: "Request timed out. Please try again" | [Retry] button, or auto-retry 3 times |
| **Validation Error** | Form rejected | Inline red text below field: "Item name required" | Fix field, auto-validates on change |
| **LLM Budget Exceeded** | Can't parse receipt | Modal: "Daily parsing limit reached. Try again tomorrow or review queue" | [View Queue] or [Try Manual Entry] |
| **Authentication Expired** | API calls fail | Modal: "Session expired. Please sign in again" | [Sign In] redirects to auth flow |
| **Server Error (500)** | Operation failed | Toast: "Something went wrong. Our team has been notified" | [Retry] button, logs error to monitoring |
| **Conflict (409)** | Concurrent edit | Modal: "This item was updated by another device. Merge changes?" | Show diff, [Keep Mine] or [Use Theirs] |

**Error Message Principles**
1. **Human language**: "We couldn't parse this receipt" not "Error 422: Unprocessable Entity"
2. **Explain impact**: "Your changes weren't saved" not just "Error"
3. **Offer solution**: "Try uploading a different file" not dead end
4. **Be honest but reassuring**: "We're experiencing high traffic right now" not vague "Try again later"
5. **Show empathy**: "We're sorry, this shouldn't have happened"
6. **Avoid blame**: "We had trouble reading this file" not "You uploaded an invalid file"
7. **Be conversational**: "Let's try that again" not "Retry operation"

**Before/After Examples:**

| Before (Technical) | After (Friendly & Reassuring) |
|-------------------|-------------------------------|
| "Parsing failed: File format not recognized" | "We had trouble reading this file. Try a .csv or .xlsx format, or take a photo of your receipt instead." |
| "Network timeout after 30000ms" | "This is taking longer than usual. Check your connection and we'll try again." |
| "Invalid item name: Must be 1-200 characters" | "Item names should be between 1-200 characters. Could you shorten this a bit?" |
| "Concurrent edit conflict detected" | "Someone else just updated this item. Would you like to keep your changes or use theirs?" |
| "LLM quota exceeded for user" | "You've hit today's parsing limit, but we can still help! Add items manually or we'll process your receipt overnight." |
| "Authorization token expired" | "Your session timed out for security. Let's sign you back in." |

**Error UI Components**

**Inline Error** (Form fields)
```
│  Item Name *                                               │
│  [_______________________________________________]          │
│  ❌ Item name is required                                  │
```
- Red text, 12px, below field
- Icon for visual scanning
- Appears on blur or submit

**Toast Notification** (Transient errors)
```
┌────────────────────────────────────────────────────────────┐
│  ❌ Failed to save item. Please try again.     [Retry] [X]│
└────────────────────────────────────────────────────────────┘
```
- Bottom-left (desktop), bottom-center (mobile)
- Auto-dismiss after 5 seconds, or user dismisses
- Stacks if multiple errors (max 3 visible)

**Error Modal** (Blocking errors)
```
┌─────────────────────────────────────────────┐
│  ⚠️  Session Expired                     [X]│
│                                             │
│  Your session timed out for security       │
│  reasons. Please sign in again.            │
│                                             │
│  [Sign In]                      [Cancel]   │
└─────────────────────────────────────────────┘
```
- Centered, semi-transparent backdrop
- Requires user action (no auto-dismiss)
- Escape key to dismiss if non-critical

**Banner** (Persistent warnings)
```
┌────────────────────────────────────────────────────────────┐
│  ⚠️ You're offline. Changes will sync when connected    [X]│
└────────────────────────────────────────────────────────────┘
```
- Top of page, full-width
- Yellow background for warnings, red for critical
- Dismissible with X, or auto-dismisses when resolved

### 5.5 Confirmation Dialogs

**When to Use**
- Destructive actions (delete, reject)
- Actions with significant cost (bulk operations)
- Irreversible changes (no undo)

**When NOT to Use**
- Actions with undo (prefer toast with undo button)
- Low-risk actions (edit, reorder)
- Frequent actions (would train users to ignore)

**Standard Confirmation Modal**
```
┌─────────────────────────────────────────────┐
│  Delete "Milk"?                          [X]│
│                                             │
│  This will remove Milk and its 12-month    │
│  purchase history. You can undo this       │
│  within 30 days.                           │
│                                             │
│  [Cancel]                       [Delete]   │
└─────────────────────────────────────────────┘
```

**Best Practices**
- Title as question: "Delete Milk?" not "Confirm Deletion"
- Explain consequences: "This will remove..."
- Show recovery path: "You can undo within 30 days"
- Destructive action on right (Western UX convention)
- Escape key = Cancel, Enter key = Confirm (only if low-risk)

---

## 6. Visual Design System

### 6.1 Color Palette

**Primary Colors** (Brand identity)
```
Blue-50:  #EFF6FF  (Backgrounds, subtle highlights)
Blue-100: #DBEAFE  (Hover states, badges)
Blue-600: #2563EB  (Primary actions, links)
Blue-700: #1D4ED8  (Hover on primary buttons)
Blue-800: #1E40AF  (Active state)
```

**Semantic Colors** (Convey meaning)
```
Success (Green):
  Green-50:  #F0FDF4  (Success backgrounds)
  Green-600: #16A34A  (Success text, icons)
  Green-700: #15803D  (Hover)

Warning (Yellow):
  Yellow-50:  #FEFCE8  (Warning backgrounds)
  Yellow-600: #CA8A04  (Warning text)
  Yellow-700: #A16207  (Hover)

Error (Red):
  Red-50:  #FEF2F2  (Error backgrounds)
  Red-600: #DC2626  (Error text, destructive actions)
  Red-700: #B91C1C  (Hover)

Urgency (Run-out date coding - DYNAMIC, frequency-relative):
  Red-100:    #FEE2E2  (Critical urgency)
  Yellow-100: #FEF3C7  (Warning urgency)
  Green-100:  #DCFCE7  (Healthy stock)
  
  **Algorithm (item-specific, NOT static thresholds):**
  Color is determined by: daysRemaining relative to avgFrequencyDays
  
  - Red (Critical):   daysRemaining ≤ MIN(3 days, 25% of avgFrequencyDays)
  - Yellow (Warning): daysRemaining ≤ MIN(7 days, 50% of avgFrequencyDays)
  - Green (Healthy):  daysRemaining > 50% of avgFrequencyDays
  
  **Visual Pairing (never color alone - accessibility requirement):**
  - Display urgency ratio: "Critical · 14% of cycle left" or "Healthy · 72% remaining"
  - Text labels: "Critical" / "Soon" / "Healthy" (not just color badges)
  - Tooltip on hover: "Urgency is based on your 7-day purchase cycle. You're 86% through it."
  - [How we calculate urgency] link in settings
  
  **Why dynamic?** A 90-day cycle item at 6 days is critical (7% remaining),
  while a 7-day cycle item at 6 days is healthy (86% remaining).
  
  **Examples with ratio labels:**
  - Milk (7d cycle, 2d left):       RED · "Critical · 29% left" 
  - Milk (7d cycle, 5d left):       YELLOW · "Soon · 71% left"
  - Eggs (14d cycle, 3d left):      RED · "Critical · 21% left"
  - Eggs (14d cycle, 9d left):      GREEN · "Healthy · 64% left"
  - Toilet Paper (90d cycle, 6d):   RED · "Critical · 7% left" (!)
  - Toilet Paper (90d cycle, 50d):  GREEN · "Healthy · 56% left"
```

**Neutral Colors** (UI structure)
```
Gray-50:  #F9FAFB  (Page backgrounds)
Gray-100: #F3F4F6  (Card backgrounds)
Gray-200: #E5E7EB  (Borders, dividers)
Gray-400: #9CA3AF  (Disabled text)
Gray-600: #4B5563  (Secondary text)
Gray-900: #111827  (Primary text)
White:    #FFFFFF  (Cards, elevated surfaces)
```

### 6.2 Typography

**Font Family**
- Primary: `Inter`, system-ui, sans-serif (clean, highly legible)
- Monospace: `Fira Code`, Consolas, monospace (for data, prices)

**Type Scale** (Responsive, mobile-first)

| Element | Mobile | Desktop | Weight | Line Height | Usage |
|---------|--------|---------|--------|-------------|-------|
| **H1** | 28px | 36px | 700 | 1.2 | Page titles |
| **H2** | 24px | 30px | 600 | 1.3 | Section headers |
| **H3** | 20px | 24px | 600 | 1.4 | Card titles |
| **H4** | 18px | 20px | 600 | 1.4 | List group headers |
| **Body Large** | 16px | 18px | 400 | 1.6 | Emphasis text |
| **Body** | 14px | 16px | 400 | 1.5 | Default text |
| **Body Small** | 12px | 14px | 400 | 1.5 | Secondary info |
| **Caption** | 11px | 12px | 500 | 1.4 | Badges, labels |
| **Button** | 14px | 16px | 600 | 1 | All buttons |

**Text Colors**
- Primary text: Gray-900 (high contrast, body text)
- Secondary text: Gray-600 (labels, metadata)
- Disabled text: Gray-400 (inactive states)
- Inverse text: White (on dark backgrounds)

### 6.3 Spacing & Layout

**Base Unit**: 4px (all spacing is multiple of 4)

**Spacing Scale**
```
xs:  4px   (Tight spacing within components)
sm:  8px   (Compact spacing)
md:  16px  (Default spacing, padding)
lg:  24px  (Section spacing)
xl:  32px  (Major section breaks)
2xl: 48px  (Page-level spacing)
3xl: 64px  (Hero sections)
```

**Component Spacing**
- Card padding: 16px (mobile), 20px (desktop)
- Card gap: 12px (mobile), 16px (desktop)
- Form field gap: 16px
- Button padding: 12px 20px (horizontal: 1.67× vertical)
- Modal padding: 24px
- Page margins: 16px (mobile), 24px (tablet), 32px (desktop)

**Grid System**
- **Mobile (<640px)**: 1 column, full-width cards
- **Tablet (640-1024px)**: 2 columns for cards, 1 for forms
- **Desktop (≥1024px)**: 3 columns for cards, 2 for wide layouts

**Z-Index Scale** (Prevent overlap conflicts)
```
z-0:   0    (Base layer, content)
z-10:  10   (Dropdowns, tooltips)
z-20:  20   (Fixed headers)
z-30:  30   (Modals, overlays)
z-40:  40   (Toasts, notifications)
z-50:  50   (Critical system alerts)
```

### 6.4 Elevation & Shadows

**Principle**: Use shadows sparingly to convey hierarchy and interactivity.

**Shadow Scale**
```
shadow-sm:  0 1px 2px rgba(0,0,0,0.05)         (Subtle cards)
shadow:     0 1px 3px rgba(0,0,0,0.1)          (Default cards)
shadow-md:  0 4px 6px rgba(0,0,0,0.1)          (Hover state)
shadow-lg:  0 10px 15px rgba(0,0,0,0.1)        (Modals)
shadow-xl:  0 20px 25px rgba(0,0,0,0.1)        (Elevated modals)
```

**Usage**
- Resting cards: `shadow-sm` or `shadow`
- Hover cards: `shadow-md` (transition 200ms)
- Modals/dialogs: `shadow-lg`
- Bottom sheets: `shadow-xl` (emphasize elevation)

### 6.5 Border Radius

**Scale**
```
rounded-none: 0px     (Sharp edges, rare)
rounded-sm:   4px     (Buttons, inputs)
rounded:      6px     (Default, cards)
rounded-lg:   8px     (Large cards)
rounded-xl:   12px    (Modals, sheets)
rounded-full: 9999px  (Pills, avatars)
```

**Usage**
- Buttons: `rounded-sm` or `rounded`
- Cards: `rounded-lg`
- Badges: `rounded-full`
- Inputs: `rounded` (match button radius)

### 6.6 Iconography

**Icon Library**: Lucide Icons (consistent style, open source)

**Icon Sizes**
- Small: 16px (inline with text)
- Medium: 20px (buttons, cards)
- Large: 24px (headers, empty states)
- XL: 32px (hero icons)

**Usage Guidelines**
- Always pair with text labels (don't rely on icon alone for meaning)
- Use solid fill for active states, outline for inactive
- Color matches text color (inherit)
- Add `aria-label` for screen readers if icon-only

**Common Icons**
- Home: `home`
- Inventory: `package`
- Import: `upload`
- Shopping List: `shopping-cart`
- Settings: `settings`
- Add: `plus-circle`
- Edit: `pencil`
- Delete: `trash-2`
- More: `more-vertical`
- Success: `check-circle`
- Warning: `alert-triangle`
- Error: `x-circle`
- Info: `info`

---

## 7. Responsive Design Strategy

### 7.1 Breakpoints

```
sm:  640px   (Large phones, portrait tablets)
md:  768px   (Tablets, landscape)
lg:  1024px  (Small laptops, desktop)
xl:  1280px  (Desktop)
2xl: 1536px  (Large desktop, optional)
```

**Design Priority**: Mobile-first (design for 375px width, scale up)

### 7.2 Layout Adaptations

**Navigation**
- **<1024px**: Bottom tab bar (5 tabs)
- **≥1024px**: Left sidebar (expanded or collapsed)

**Dashboard Cards**
- **<640px**: 1 column, full-width cards
- **640-1024px**: 2 columns, equal width
- **≥1024px**: 3 columns for "Running Out", 2 columns for details

**Inventory List**
- **<640px**: 1 column, compact cards (120px height)
- **640-1024px**: 2 columns, medium cards (140px)
- **≥1024px**: 3 columns OR list view (user preference)

**Forms**
- **<640px**: Single column, full-width inputs
- **≥640px**: Two-column layout for related fields (Quantity + Unit)

**Modals**
- **<640px**: Full-screen modal (slides up from bottom)
- **≥640px**: Centered modal (max-width 600px)

### 7.3 Touch Target Sizes

**Mobile** (<640px)
- Minimum touch target: 44×44px (iOS HIG), 48×48px (Android Material)
- Buttons: 48px height minimum
- Card touch area: Entire card (not just text)
- Form inputs: 48px height

**Desktop** (≥1024px)
- Buttons: 40px height (smaller acceptable with mouse precision)
- Links: 16px height minimum
- Icons: 24px click area (16px visible icon + padding)

### 7.4 Typography Scaling

**Principle**: Increase font sizes for desktop to utilize space, but maintain readability.

**Example: Item Card**
- **Mobile**: Item name 16px, metadata 12px
- **Desktop**: Item name 18px, metadata 14px

**Example: Page Titles**
- **Mobile**: H1 28px
- **Desktop**: H1 36px

---

## 8. Accessibility Guidelines

### 8.1 WCAG 2.1 Level AA Compliance

**Target**: All features fully accessible to users with disabilities.

**Key Requirements**

**Color Contrast**
- Text contrast ratio: ≥4.5:1 (normal text), ≥3:1 (large text 18px+)
- UI component contrast: ≥3:1 (buttons, form borders)
- Test tool: WebAIM Contrast Checker

**Examples**
- ✅ Gray-900 text on White background = 15.3:1
- ✅ Blue-600 links on White = 5.9:1
- ❌ Gray-400 text on White = 2.9:1 (use Gray-600 minimum)

**Urgency Color Accessibility**
- Red-100 background with Gray-900 text = 13.2:1 ✅
- Yellow-100 background with Gray-900 text = 16.8:1 ✅
- Green-100 background with Gray-900 text = 15.1:1 ✅
- Never use color alone to convey urgency (always pair with text: "2 days left")

**Keyboard Navigation**
- All interactive elements focusable via Tab key
- Logical tab order (top-to-bottom, left-to-right)
- Focus indicator: 2px solid Blue-600 outline, 2px offset
- Skip to main content link (hidden until focused)
- Escape key closes modals/sheets
- Arrow keys navigate lists and dropdowns
- Space/Enter activates buttons

**Screen Reader Support**
- Semantic HTML: `<button>`, `<nav>`, `<main>`, `<article>`
- ARIA labels for icon-only buttons: `aria-label="Add item"`
- ARIA live regions for dynamic content: `aria-live="polite"` (toasts)
- Alt text for images: Descriptive, <150 characters
- Form labels: Always associated with inputs via `for` attribute

**Focus Management**
- Auto-focus first input in forms (on desktop)
- Trap focus in modals (Tab cycles within modal)
- Return focus to trigger element when closing modal
- Skip links for long lists: "Skip to item 50"

### 8.2 Accessible Components

**Item Card**
```html
<article 
  role="article" 
  aria-labelledby="item-name-123"
  tabindex="0">
  <h3 id="item-name-123">Milk</h3>
  <p>Runs out in 2 days</p>
  <button aria-label="Restock Milk with one tap">
    One-Tap Restock
  </button>
</article>
```

**Confidence Badge**
```html
<span 
  class="badge badge-high"
  role="status"
  aria-label="High confidence: Based on 8+ purchases">
  HIGH
</span>
```

**Micro-Review Bottom Sheet**
```html
<dialog 
  role="dialog" 
  aria-labelledby="review-title"
  aria-describedby="review-desc"
  aria-modal="true">
  <h2 id="review-title">Review Item 1 of 3</h2>
  <p id="review-desc">Organic Whole Milk, confidence 65%</p>
  ...
</dialog>
```

### 8.3 Error Accessibility

**Inline Errors**
```html
<label for="item-name">Item Name</label>
<input 
  id="item-name" 
  aria-invalid="true"
  aria-describedby="item-name-error">
<span 
  id="item-name-error" 
  role="alert"
  class="error-text">
  Item name is required
</span>
```

**Toast Notifications**
```html
<div 
  role="alert" 
  aria-live="assertive"
  aria-atomic="true">
  Failed to save item. Please try again.
</div>
```

### 8.4 Motion & Animation Accessibility

**Respect `prefers-reduced-motion`**
- Disable animations for users with vestibular disorders
- CSS: `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`
- Instant state changes instead of transitions
- Exception: Essential animations (loading spinners) use slow, linear motion

---

## 9. Error States & Edge Cases

### 9.1 Network Conditions

**Offline Mode**
```
┌────────────────────────────────────────────────────────────┐
│  ⚠️ You're offline. Changes will sync when connected    [X]│
├────────────────────────────────────────────────────────────┤
│  My Inventory (47 items)                  [+ Add] [Filter]│
│  Last synced: 5 minutes ago                                │
│  ...
```
- Yellow banner persists at top
- All reads work from IndexedDB cache
- Writes queued for sync (optimistic UI)
- Import/parsing disabled (requires server)
- Clear indicator: "Last synced: X ago"

**Slow Connection** (>3s response time)
```
│  ⏳ Slow connection detected                            [X]│
│  Some features may be delayed. Consider using offline mode.│
```
- Appears after 3 seconds of waiting
- All features remain enabled
- Show loading indicators more prominently

**Reconnecting**
```
│  🔄 Reconnecting... (Attempt 2 of 3)                       │
```
- Auto-retry with exponential backoff
- Shows attempt count
- After 3 failures: "Could not reconnect. Try refreshing the page."

### 9.2 Data Edge Cases

**Empty Inventory**
- Show empty state with 3 CTAs (upload CSV, take photo, add manually)
- Demo mode toggle: "Try with sample data"

**Single Item** (Not enough for patterns)
- Show item card with placeholder prediction: "Add more purchases for predictions"
- Teach Mode encouraged: Banner "Tell us how often you buy this"

**Inactive Item** (No purchases in 90+ days)
- Badge: "Inactive - Not tracking"
- CTA: "Delete or record new purchase?"

**Low Confidence Predictions** (All items <50%)
- Dashboard banner: "Need more data for accurate predictions"
- CTA: "Import order history to improve accuracy"
- Show confidence badges prominently

**Duplicate Items** (Similar canonical names)
```
│  ⚠️ Possible duplicate: "Milk" and "Whole Milk"        [X]│
│  These might be the same item.                            │
│  [View Both] [Merge Items] [Ignore]                       │
```
- Detected during parsing or manual entry
- Offers merge with conflict resolution
- User can ignore and dismiss

**Price Anomalies** (3× average price)
```
│  ⚠️ Price looks unusual                                    │
│  $14.99 is much higher than usual ($4.99 avg).            │
│  [Edit Price] [It's Correct]                              │
```
- Inline warning during transaction entry
- User can confirm or correct
- Learns from corrections

**Prediction Failures** (Algorithm can't calculate)
- Item card shows: "Not enough data yet"
- No run-out date displayed
- Badge: "Need 3+ purchases"

### 9.3 Parsing Edge Cases

**Ambiguous Item Names**
```
│  "Org Milk 1/2gal" could be:                              │
│  • Organic Whole Milk, 64 fl oz                           │
│  • Organic 2% Milk, 64 fl oz                              │
│  [Select correct match ▼]                                 │
```
- Micro-review shows LLM-suggested options
- User selects or types custom name

**Unparseable Receipt**
```
│  ❌ We couldn't read this receipt                         │
│  The image is too blurry or text is unreadable.           │
│  [Retake Photo] [Try Manual Entry] [Skip]                │
```
- Image quality check before OCR
- Suggests retaking with tips (lighting, focus)

**Partial Parse** (Some items failed)
```
│  ⚠️ 42 items parsed, 5 couldn't be read                   │
│  [View Parsed Items] [Review Failed Items]                │
```
- Success summary shows breakdown
- Failed items shown with original text for manual entry

**LLM Budget Exceeded**
```
│  ⚠️ Daily parsing limit reached                           │
│  Your receipt has been queued for overnight processing.    │
│  You'll get a notification when ready (within 24 hours).  │
│  [View Queue Status] [Try Manual Entry]                   │
```
- Explains degradation gracefully
- Offers alternative (manual entry)
- Shows queue position: "3 receipts ahead of yours"

### 9.4 Multi-Device Conflicts

**Concurrent Edit Conflict**
```
┌─────────────────────────────────────────────┐
│  Conflict Detected                       [X]│
│                                             │
│  "Milk" was updated on another device:     │
│                                             │
│  Your changes:      Their changes:          │
│  Run out: Nov 4     Run out: Nov 5          │
│  Price: $4.99       Price: $5.19            │
│                                             │
│  [Keep Mine] [Use Theirs] [Merge Both]     │
└─────────────────────────────────────────────┘
```
- Shows side-by-side diff
- Merge option combines non-conflicting fields
- Timestamps help user decide: "Updated 2 minutes ago on iPhone"

**Delete on Another Device**
```
│  ⚠️ This item was deleted on another device                │
│  [Restore Item] [Confirm Deletion]                         │
```
- Local cache shows deleted item with banner
- Restore recreates item with full history

**Stale Data Warning**
```
│  ⚠️ Your data is 2 hours old                              │
│  [Sync Now] [Continue Offline]                            │
```
- Appears if last sync >1 hour ago
- User can force sync or continue with stale cache

---

## 10. Animation & Micro-interactions

### 10.1 Animation Principles

1. **Purposeful**: Animations guide attention, provide feedback, or show relationships
2. **Fast**: 200-300ms for UI transitions, never >500ms
3. **Natural**: Easing curves mimic physics (ease-out for entrances, ease-in for exits)
4. **Respectful**: Honor `prefers-reduced-motion`, provide instant fallback
5. **Performant**: Use `transform` and `opacity` only (GPU-accelerated)

### 10.2 Transition Specifications

**Card Hover** (Desktop only)
```css
transition: all 200ms ease-out;
/* Hover state: */
transform: translateY(-2px);
box-shadow: 0 4px 6px rgba(0,0,0,0.1);
```

**Button Press**
```css
transition: transform 100ms ease-in;
/* Active state: */
transform: scale(0.98);
```

**Modal Open**
```css
/* Backdrop */
animation: fadeIn 200ms ease-out;
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Modal */
animation: slideUp 300ms ease-out;
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Bottom Sheet Slide**
```css
animation: slideUpSheet 300ms cubic-bezier(0.4, 0, 0.2, 1);
@keyframes slideUpSheet {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

**Toast Notification**
```css
/* Enter */
animation: slideInRight 300ms ease-out;
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Exit */
animation: slideOutRight 200ms ease-in;
```

**Skeleton Shimmer**
```css
animation: shimmer 2s infinite linear;
@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
/* Applied to gradient overlay on skeleton blocks */
```

**Success Pulse** (One-Tap Restock)
```css
animation: successPulse 500ms ease-out;
@keyframes successPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); background-color: #16A34A; }
  100% { transform: scale(1); }
}
```

### 10.3 Loading Micro-interactions

**Button Loading State**
1. Button text fades out (100ms)
2. Spinner fades in (100ms)
3. Button width maintains (no layout shift)
4. Spinner rotates continuously
5. On success: Checkmark replaces spinner (200ms)
6. On error: X icon, button shakes (shake animation)

**Shake Animation** (Errors)
```css
animation: shake 400ms ease-in-out;
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}
```

**Progress Bar Fill**
```css
transition: width 300ms ease-out;
/* Width updates based on parsing progress */
```

### 10.4 Gesture Feedback

**Swipe to Delete** (Mobile)
1. Card follows finger (transform: translateX)
2. Red background revealed with trash icon
3. Haptic feedback at 50% swipe threshold
4. Release >50%: Card slides off screen, then removes from DOM
5. Release <50%: Card snaps back (spring animation)

**Pull to Refresh**
1. User pulls down: Spinner appears, rotates with pull distance
2. Pull >80px: Spinner changes to "Release to refresh"
3. Release: Spinner spins, API call triggers
4. On complete: Spinner fades out, content scrolls to top

**Long Press** (Desktop)
1. Button pressed: Scale down (0.98)
2. After 500ms: Progress ring appears around button
3. At 100%: Action executes, success pulse
4. Early release: Reset, no action

### 10.5 Page Transitions

**Route Change** (React Router)
```css
/* Exit page */
animation: fadeOut 150ms ease-in;

/* Enter page */
animation: fadeIn 200ms ease-out;
```

**Stagger Animation** (Dashboard cards load)
```css
/* Each card delays by 50ms */
animation: fadeInUp 300ms ease-out;
animation-delay: calc(var(--index) * 50ms);

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 11. Onboarding Flow

### 11.1 First-Time User Experience (FTUE)

**Goal**: Activate user within 2 minutes (see personalized prediction).

**Flow Diagram**
```
Landing Page
    ↓
[Sign In with Microsoft] ← 15 seconds
    ↓
Welcome Screen (Demo Mode)
    ├─→ Explore Samples (30 seconds) → CTA: "Try with your data"
    ├─→ Upload CSV (60 seconds) → Parsing → Predictions ready
    └─→ Skip to Manual (45 seconds) → Add item → Teach Mode → Prediction
```

### 11.2 Welcome Screen (Demo Mode)

```
┌────────────────────────────────────────────────────────────┐
│                    Welcome to Kirana! 🎉                   │
│                                                            │
│         Never run out of groceries again                   │
│    Smart predictions track what you need before you do     │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  Here's what your inventory could look like:               │
│                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ 🥛 Milk             │  │ 🥚 Eggs              │        │
│  │ Organic Valley      │  │ Happy Egg Co.        │        │
│  │ ⚠️ 2 days left      │  │ ⚠️ 4 days left       │        │
│  │ High confidence     │  │ Medium confidence    │        │
│  └─────────────────────┘  └─────────────────────┘        │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ 🍞 Bread            │  │ 🍌 Bananas           │        │
│  │ Dave's Killer Bread │  │ Organic              │        │
│  │ ✅ 5 days left      │  │ ⚠️ 3 days left       │        │
│  │ Low confidence      │  │ High confidence      │        │
│  └─────────────────────┘  └─────────────────────┘        │
│                                                            │
│  Try tapping "One-Tap Restock" on Milk →                  │
│  (Demo only - no data saved)                               │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  Ready to track your own groceries?                        │
│                                                            │
│  [📤 Upload Amazon Order History] ← Primary CTA           │
│       Fastest way to get started                           │
│                                                            │
│  [+ Add Items Manually] ← Secondary option                 │
│                                                            │
│  [Continue Exploring Demo] ← Tertiary link                 │
└────────────────────────────────────────────────────────────┘
```

**Interactive Demo Features**
- One-Tap Restock works (updates prediction in demo data)
- "View Details" shows sample history graph
- Subtle watermark on each demo card: "Demo" badge in top-right corner (gray, low opacity)
- Persistent top banner: "🎨 Demo Mode - This is sample data" [Switch to Real Data]
- Demo data resets on page refresh (not persisted)

**Onboarding Simplification** (Reduces decision paralysis)
- **Single primary CTA**: "Start Amazon Import" (recommended path)
- **Secondary option**: "Add Items Manually" (smaller, outline button)
- **Tertiary link**: "Explore demo first" (text link, no button)
- Hidden initially: Photo capture (shown after 1st manual item), Email forwarding (beta badge, settings)
- Progressive disclosure: Advanced options revealed after user completes basic setup
- **Why**: Reduces cognitive load, guides user to highest-value path (CSV for coverage)

**Demo → Real Transition** (Triggered when first real item is added)
```
┌─────────────────────────────────────────────┐
│  🎉 Welcome to Your Real Inventory!      [X]│
│                                             │
│  You just added your first item: Milk      │
│                                             │
│  What's next?                               │
│  ✓ Upload Amazon history for instant       │
│    high-confidence predictions (Fastest)    │
│                                             │
│  ✓ Add 2-3 more frequent items manually    │
│    (Takes 2 minutes)                        │
│                                             │
│  ✓ Take a photo of your next receipt       │
│    (Easiest going forward)                  │
│                                             │
│  [Upload Amazon CSV]  [Add More Items]     │
│                                             │
│  💡 Demo items have been cleared            │
└─────────────────────────────────────────────┘
```
- Clear moment of commitment (demo → real)
- Guides user to next best action (CSV import for coverage)
- Auto-clears demo data to avoid confusion

### 11.3 Guided CSV Upload (Redesigned to Handle Wait Time)

**Critical Design Constraint**: Amazon CSV download requires 5-10 minute email delivery. The UX must turn this wait time into productive activation.

**Step 1: Choose Retailer** (see Section 3.4)

**Step 2: Set Expectations & Provide Instructions**
```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Import from Amazon                              │
├────────────────────────────────────────────────────────────┤
│  📧 Amazon sends order reports via email                   │
│  This takes 5-10 minutes. Let's get you started now!       │
│                                                            │
│  Step 1: Request your report from Amazon                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 1. Click button below to open Amazon                │   │
│  │ 2. Go to Account → Download Order Reports           │   │
│  │ 3. Select: Last 12 months, CSV format               │   │
│  │ 4. Click "Request Report"                           │   │
│  │ 5. Check your email in 5-10 minutes                 │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  [Open Amazon in New Tab →]                               │
│                                                            │
│  ⏱️ While you wait, let's get your first predictions!     │
│  [Continue →]                                              │
└────────────────────────────────────────────────────────────┘
```

**Step 3: Teach Mode Activation (THE PIVOT) - Chip-Based Quick Setup**
```
┌────────────────────────────────────────────────────────────┐
│  While your Amazon report generates...                     │
├────────────────────────────────────────────────────────────┤
│  Let's get your first predictions!                         │
│  Tap items you buy often, set frequency, done.             │
│                                                            │
│  Common items (tap to add):                                │
│  [🥛 Milk] [🥚 Eggs] [🍞 Bread] [☕ Coffee]              │
│  [🍌 Bananas] [🧻 Toilet Paper] [+ Other]                │
│                                                            │
│  (After tapping "Milk":)                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🥛 Milk                                     [×]    │   │
│  │ How often do you buy this?                         │   │
│  │ [Every 7 days] [Every 14 days] [Every 30 days]    │   │
│  │ [Custom: __ days]                                  │   │
│  │                                                    │   │
│  │ → Predicted run-out: Nov 9 (7 days) 🎓 Learning  │   │
│  │ [Confirm]                                          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Items added: 🥛 Milk (7d)  🥚 Eggs (14d)  [+ Add more]   │
│                                                            │
│  [Done - See My Predictions]                               │
│                                                            │
│  💡 We'll merge this with your Amazon data when it arrives│
└────────────────────────────────────────────────────────────┘
```

**Design Rationale:**
- **Pre-suggested items**: Reduces typing, accelerates activation
- **Frequency chips**: Faster than sliders, common intervals pre-selected
- **Inline prediction**: Immediate feedback, shows value before confirmation
- **Flexible**: Can add 1-8 items, no forced minimum
- **Localization-ready**: Item suggestions vary by region (US: Milk/Eggs, India: Dal/Rice)

**Step 4: Immediate Value Delivered + CSV Pending Banner**
```
┌────────────────────────────────────────────────────────────┐
│  🎉 Your first predictions are ready!                      │
├────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ 🥛 Milk             │  │ 🥚 Eggs              │        │
│  │ Runs out in 7 days  │  │ Runs out in 14 days  │        │
│  │ 🎓 Learning         │  │ 🎓 Learning          │        │
│  └─────────────────────┘  └─────────────────────┘        │
│                                                            │
│  [View My Dashboard]                                       │
│                                                            │
│  ──────────────────────────────────────────────────────    │
│  📧 Amazon report pending (ready in ~8 minutes)            │
│  We'll notify you via email & in-app when it arrives.      │
└────────────────────────────────────────────────────────────┘
```

**Home Dashboard - CSV Pending Banner** (Persistent until upload)
```
┌────────────────────────────────────────────────────────────┐
│  📤 Amazon report ready! [Upload CSV Now →]           [×]│
├────────────────────────────────────────────────────────────┤
│  Home Dashboard                                            │
│  ...
```

**Design Rationale:**
- Banner persists on Home until CSV uploaded or dismissed
- Single-tap deep link returns user to upload flow
- Dismissible (X) but reappears once per session until action taken
- Auto-surfaces when email arrives (if app is open)

**Step 5: Email Notification (10 minutes later)**
```
Subject: Your Amazon order report is ready to upload

Your Amazon order report has arrived! 

Upload it now to get high-confidence predictions for all your items.

[Upload Now] (deep link to app)

Don't worry - we'll merge this with the 3 items you already added.
```

**Step 6: CSV Upload & Smart Merge**
```
┌────────────────────────────────────────────────────────────┐
│  Upload Your Amazon Report                                 │
├────────────────────────────────────────────────────────────┤
│  [Drag & drop CSV here or browse]                         │
│                                                            │
│  (After upload)                                            │
│  Parsing... 45 of 62 items (72%)                          │
│                                                            │
│  ✓ 42 new items added                                     │
│  🔗 3 items merged (Milk, Eggs, Bread)                    │
│     Using your Teach Mode data + Amazon history           │
│  ⚠️ 3 items need review                                   │
│                                                            │
│  [Review 3 Items]  [View Inventory]                       │
└────────────────────────────────────────────────────────────┘
```

**Step 7: Micro-Review Tutorial** (If needed, first-time only)
(See Section 4.4 for A/B test variants)

### 11.4 Teach Mode Tutorial

**Triggered**: When user adds first manual item.

```
┌────────────────────────────────────────────────────────────┐
│  🎓 Enable Teach Mode?                                     │
│                                                            │
│  Tell us how often you buy items, and we'll predict when  │
│  you'll run out immediately. Predictions improve over time │
│  as you record purchases.                                  │
│                                                            │
│  Example: "I buy milk every 7 days"                        │
│  → Prediction: "Runs out in 7 days (Low confidence)"      │
│                                                            │
│  [Enable Teach Mode]        [Skip - I'll add purchases]   │
└────────────────────────────────────────────────────────────┘
```

**If enabled**: Form shows Teach Mode section (see Section 3.6).

### 11.5 Success Celebration

**After first import completes**:
```
┌────────────────────────────────────────────────────────────┐
│                    🎉 You're all set!                      │
│                                                            │
│  45 items are now being tracked                            │
│  5 items running out in the next 7 days                    │
│                                                            │
│  What's next?                                              │
│  ✓ Check your dashboard for items running out soon        │
│  ✓ Use One-Tap Restock to record new purchases            │
│  ✓ Get notifications when items are running low           │
│                                                            │
│  [View My Dashboard]                                       │
└────────────────────────────────────────────────────────────┘
```

**After first One-Tap Restock**:
```
│  🎉 Great! You just restocked Milk                         │
│  We'll use this to improve predictions. Keep it up!        │
│  [Dismiss]                                                 │
```

### 11.6 Tooltips & Inline Help

**First-Time Tooltips** (Dismiss once, never show again)

**Dashboard - First visit**
```
│  Running Out Soon (≤7 days)                    [View All] │
│  ┌─────────────────────┐ ← 💡 These items need restocking │
│  │ 🥛 Milk             │    soon. Tap "One-Tap Restock"   │
│  │ ...                 │    to record a purchase.         │
```

**Item Detail - First view**
```
│  ┌────────────────────────────────────────────────────┐   │
│  │    📊 Prediction Timeline                          │   │
│  │    ↑ 💡 This shows your purchase history and       │   │
│  │       predicted run-out date based on patterns     │   │
```

**Confidence Badge - First hover**
```
│  High confidence ✓ ← 💡 Higher confidence means more   │
│                       reliable predictions             │
```

---

## 12. Multi-User Household UX

### 12.1 Household Management

**Settings > Household**

```
┌────────────────────────────────────────────────────────────┐
│  [← Back]  Household Settings                              │
├────────────────────────────────────────────────────────────┤
│  Household Name                                            │
│  [Smith Family________________________________]  [Save]    │
│                                                            │
│  Members (4/10)                                  [+ Invite]│
│  ┌────────────────────────────────────────────────────┐   │
│  │ 👤 Ved (You)                           Admin    [⋮]│   │
│  │    ved@example.com                                  │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 👤 Sarah                               Admin    [⋮]│   │
│  │    sarah@example.com                                │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 👤 Alex                                Member   [⋮]│   │
│  │    alex@example.com                                 │   │
│  │    Last active: 2 hours ago                         │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 👤 Jamie                               Member   [⋮]│   │
│  │    jamie@example.com                                │   │
│  │    Pending invitation                               │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Sync Settings                                             │
│  Sync interval: [Every 5 minutes ▼]                       │
│  Auto-sync on app open: [Toggle ●]                        │
│                                                            │
│  Danger Zone                                               │
│  [Leave Household]  [Delete Household]                    │
└────────────────────────────────────────────────────────────┘
```

**Member Actions Menu** (Three-dot)
- View Activity History
- Change Role (Admin only): Member ↔ Admin
- Remove from Household (Admin only, can't remove last admin)
- Resend Invitation (if pending)

### 12.2 Invite Flow

**Invite Modal** (Triggered by [+ Invite] button)

```
┌─────────────────────────────────────────────┐
│  Invite to Smith Family               [X]  │
│                                             │
│  Email Address                              │
│  [____________________________________]     │
│                                             │
│  Role                                       │
│  ○ Member - Can view and edit items        │
│  ○ Admin - Full access + manage members    │
│                                             │
│  [Cancel]                    [Send Invite] │
└─────────────────────────────────────────────┘
```

**Invitation Email** (Sent by system)
```
Subject: Ved invited you to join Smith Family on Kirana

Hi there!

Ved (ved@example.com) has invited you to join "Smith Family" 
on Kirana, a smart grocery tracking app.

You'll be able to:
• View and manage the household's grocery inventory
• Record purchases and get predictions
• Collaborate with 3 other household members

[Accept Invitation]

This invitation expires in 7 days.

---
Don't have a Kirana account? Accepting will guide you through sign-up.
```

**Invitation Accept Flow** (User clicks link in email)
1. If not signed in: Redirect to sign-in with Entra ID
2. Show invitation details: "Ved invited you to Smith Family"
3. [Accept] or [Decline] buttons
4. On accept: Add user to household, redirect to household dashboard
5. Toast: "Welcome to Smith Family! You can now manage the inventory."

### 12.3 Activity Attribution

**Item Card with Attribution** (Multi-user household)
```
┌──────────────────────────────────────────────────────┐
│ 🥛 Milk · Organic Valley                   [⋮]      │
│ Runs out in 2 days · High confidence                │
│ Last purchase: Oct 29 by Sarah · $4.99/64 fl oz     │
│                                             ↑        │
│                                    Attribution       │
│ [One-Tap Restock]              [View Details →]     │
└──────────────────────────────────────────────────────┘
```

**Transaction History** (Item detail view)
```
│  Purchase History                           [View All]     │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Oct 29, 2025 · $4.99 · Whole Foods                 │   │
│  │ by Sarah · 1× 64 fl oz                             │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Oct 22, 2025 · $5.19 · Safeway                     │   │
│  │ by Ved · 1× 64 fl oz                               │   │
│  └────────────────────────────────────────────────────┘   │
```

**Recent Activity Feed** (Dashboard)
```
│  Recent Activity (last 7 days)                [View All] │
│  • Milk restocked by Sarah (today)                       │
│  • Eggs added by Alex (2 days ago)                       │
│  • Amazon CSV imported by Ved: 15 items (3 days ago)     │
```

### 12.4 Conflict Resolution (Multi-Device Edits)

**Scenario**: Sarah edits "Milk" on her phone while Ved edits on desktop.

**Proactive Conflict Prevention** (Inline warning)
```
(Ved opens "Milk" item to edit, sees banner at top)
┌────────────────────────────────────────────────────────────┐
│  ⚠️ Sarah is editing this item right now                   │
│  Your changes might conflict. Wait or edit anyway.    [×] │
└────────────────────────────────────────────────────────────┘
```
- Real-time presence detection via WebSocket (if both users editing simultaneously)
- Non-blocking warning allows user to proceed if intentional
- Reduces accidental conflicts before they happen

**Conflict Detection** (After save attempt)
- Last-write-wins for simple fields (quantity, price)
- User prompt for critical fields (canonical name, run-out override)

**Conflict Modal** (Ved sees when his save fails)
```
┌─────────────────────────────────────────────┐
│  Someone else just edited this item      [X]│
│                                             │
│  "Milk" was updated by Sarah 2 minutes ago │
│                                             │
│  Your changes:      Sarah's changes:        │
│  Price: $4.99       Price: $5.19            │
│  Qty: 1             Qty: 2                  │
│                                             │
│  [Keep Mine] [Use Sarah's] [Merge Both]    │
│                                             │
│  💡 Merge will use Sarah's quantity (more   │
│     recent) and average the prices.         │
│                                             │
│  [Preview Merge] (shows before/after)       │
└─────────────────────────────────────────────┘
```
- Friendly title: "Someone else just edited" not "Edit Conflict"
- Preview button shows merge result before committing
- Clear explanation of merge logic reduces uncertainty

**Merge Strategy**
- Quantities: Use most recent (Sarah's 2)
- Prices: Average if close (<20% diff), else prompt
- Dates: Use most recent
- Names: Prompt user (critical field)

### 12.5 Permissions & Privacy

**Phase 1-2: Simple Model**
- **Admin**: Full access (view, edit, delete, manage members, settings)
- **Member**: View and edit items, cannot manage household or delete

**Phase 3+: Granular Permissions**
- **Viewer**: Read-only access (view inventory, can't edit)
- **Editor**: Add/edit items, record purchases
- **Admin**: Full access

**Privacy Settings** (Individual user, not household-wide)
```
│  Personal Privacy                                          │
│  ☑ Show my name on purchases                              │
│  ☑ Show my activity in Recent Activity feed               │
│  ☐ Allow household to see my spending totals              │
```

---

## 13. Implementation Checklist

### 13.1 Phase 1: Core Functionality (Weeks 1-8)

**Week 1-2: Foundation**
- [ ] Authentication (Entra ID OAuth)
- [ ] Basic layout (navigation, header, footer)
- [ ] Item list view (skeleton + real data)
- [ ] Add item form (manual entry)

**Week 3-4: Predictions**
- [ ] Item detail view with prediction graph
- [ ] One-Tap Restock button
- [ ] Prediction algorithm integration
- [ ] Confidence badges

**Week 5-6: Import & Parsing**
- [ ] CSV upload flow
- [ ] Parsing progress indicator
- [ ] Micro-review bottom sheet
- [ ] Photo capture (basic)

**Week 7-8: Polish & Onboarding**
- [ ] Demo mode (welcome screen)
- [ ] Empty states
- [ ] Error handling (all scenarios)
- [ ] Tooltips & inline help
- [ ] Accessibility audit

### 13.2 Phase 2: Multi-User & Refinement (Weeks 9-12)

**Week 9-10: Household Features**
- [ ] Household management UI
- [ ] Invite flow
- [ ] Activity attribution
- [ ] Conflict resolution

**Week 11-12: Advanced Features**
- [ ] Shopping list (auto-generated)
- [ ] Teach Mode (optional predictions)
- [ ] Notification preferences
- [ ] Export data (CSV)

### 13.3 Design Deliverables

**Required for Development Handoff**
1. **Figma/Sketch Files**: All screens at 375px (mobile) and 1440px (desktop)
2. **Component Library**: Storybook with all variants
3. **Design Tokens**: JSON file with colors, spacing, typography
4. **Interaction Specs**: Video recordings of key animations
5. **Accessibility Audit**: WCAG checklist with testing results
6. **User Testing Report**: 5 users, key insights, iterations made

---

## 14. Open Questions & Design Decisions Needed

### 14.1 CSV Import Wait Time Strategy
**Status**: **RESOLVED** - Teach Mode fallback implemented (see Section 11.3)

**Problem**: Amazon CSV download requires 5-10 minute email delivery, breaking the <5 minute activation goal.

**Solution**: Pivot to Teach Mode during wait time
1. User requests Amazon CSV (opens in new tab)
2. System immediately pivots: "While you wait, add your 3 most frequent items"
3. User completes Teach Mode in 2-3 minutes → **ACTIVATED**
4. 10 minutes later: CSV upload notification → Smart merge with Teach Mode items
5. Total time to first prediction: <3 minutes (via Teach Mode)
6. Total time to high-confidence predictions: ~12 minutes (CSV arrives and merges)

**Alternative considered**: Wait for email, send notification, hope user returns (rejected - high churn risk)

### 14.2 Navigation Pattern
**Status**: **RESOLVED** - Hybrid approach

**Option A: Bottom Tab Bar (Mobile-First)**
- Pros: Thumb-friendly, familiar to mobile users, works across all devices
- Cons: Takes vertical space on desktop, limits to 5 tabs

**Option B: Left Sidebar (Desktop-First)**
- Pros: Scalable navigation, professional look, collapsible
- Cons: Less mobile-friendly, requires hamburger menu on mobile

**Decision**: **Hybrid approach** - Bottom tab bar on mobile (<1024px), left sidebar on desktop (≥1024px). Best of both worlds.

### 14.3 Micro-Review Interaction
**Status**: **RESOLVED** - A/B test both variants per PRD requirement (see Section 4.4)

**Variant A: 2-Tap** (Accept/Reject primary, Edit icon)
- Hypothesis: Faster for majority case where Accept is most common

**Variant B: 3-Tap** (Accept/Edit/Reject equal prominence)
- Hypothesis: Better discoverability leads to more corrections, higher data quality

**Test Metrics**:
- Primary: Time to complete review queue
- Secondary: Edit rate (decision point: if >30% in Variant A, Variant B wins)
- Launch: 50/50 split, 1000 users minimum per variant

### 14.4 Demo Mode Personalization
**Question**: Should demo items be generic or personalized?

**Option A: Generic** (Milk, Eggs, Bread)
- Pros: Simple, universally understood
- Cons: May not resonate with all users

**Option B: Personalized** (Based on location/culture)
- Pros: More relevant (e.g., Tortillas for Mexico, Naan for India)
- Cons: Risk of stereotyping, complex to implement

**Recommendation**: **Generic for Phase 1**, add personalization in Phase 2 based on user's Entra ID profile (optional).

### 14.5 Low-Confidence Prediction Display
**Question**: How to show predictions with <50% confidence?

**Option A: Hide** (Don't show prediction at all)
- Pros: Avoids confusing users with unreliable data
- Cons: No value until 3+ purchases recorded

**Option B: Show with Wide Range** (e.g., "5-10 days")
- Pros: Still provides some value, sets expectations
- Cons: Range may be too wide to be useful

**Option C: Show with Low Badge** (e.g., "7 days (Low confidence)")
- Pros: Transparent, teaches users about prediction quality
- Cons: Badge may be ignored

**Recommendation**: **Option C for Phase 1** (show with Low badge), revisit based on user feedback.

### 14.6 Empty State Prioritization
**Question**: For a user with zero items, which CTA should be primary?

**Option A: CSV Upload** (Fastest bulk import)
- Pros: Activates users in <2 minutes with 50+ items
- Cons: Requires order history, not available for all users

**Option B: Photo Capture** (Most modern)
- Pros: Works for any receipt, feels cutting-edge
- Cons: Slower (1 receipt = 5-10 items), mobile-only

**Option C: Manual Entry** (Teaching mode)
- Pros: Teaches core concept, works offline
- Cons: Slow, tedious for large inventories

**Recommendation**: **CSV Upload primary**, Photo Capture secondary, Manual Entry tertiary. Matches PRD's "activate within 2 minutes" goal.

---

## 15. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Nov 2, 2025 | Initial draft | Design Team |
| 1.1 | Nov 2, 2025 | Critical revisions (Gemini review): Dynamic urgency colors (frequency-relative), CSV wait time redesign (Teach Mode fallback), confidence badge transparency (show reasoning), Micro-review A/B test variants | Design Team |
| 1.2 | Nov 2, 2025 | Refinements (Copilot review): Chip-based Teach Mode, CSV pending banner, confidence coach panel, grouped micro-review, inline quick-edit, demo→real transition, urgency ratio labels, retailer labeling, analytics instrumentation | Design Team |
| 1.3 | Nov 2, 2025 | Polish (Perplexity review): Pause/resume for micro-review (reduces fatigue), friendlier error messages (conversational tone), proactive conflict warnings (real-time presence), mobile summary views (collapsible sections), onboarding simplification (single primary CTA) | Design Team |

---

## 16. References & Resources

**Design Inspiration**
- [Figma Community - Grocery App Templates](https://www.figma.com/community/tag/grocery%20app)
- [Dribbble - Inventory Management](https://dribbble.com/tags/inventory-management)

**Component Libraries**
- [shadcn/ui](https://ui.shadcn.com/) - React component library
- [TailwindUI](https://tailwindui.com/) - Premium Tailwind components
- [Lucide Icons](https://lucide.dev/) - Icon library

**Accessibility Resources**
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [a11y Project Checklist](https://www.a11yproject.com/checklist/)

**UX Patterns**
- [Material Design 3](https://m3.material.io/) - Google's design system
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Nielsen Norman Group Articles](https://www.nngroup.com/articles/)

**Prototype Tools**
- Figma (for high-fidelity mockups)
- ProtoPie (for complex interactions)
- Loom (for recording interaction demos)

---

## 17. UX Analytics & Instrumentation

### 17.1 Activation Health Metrics

**Events to Track:**
- `demo_mode_entered` - User views welcome screen
- `demo_interaction` - User taps One-Tap Restock on demo item
- `teach_mode_started` - User begins Teach Mode flow
- `teach_mode_item_added` - Item added with frequency estimate
- `teach_mode_completed` - User finishes Teach Mode (3+ items)
- `csv_request_started` - User clicks "Start Amazon Import"
- `csv_pending_banner_shown` - Banner appears on Home
- `csv_uploaded` - File successfully uploaded
- `csv_uploaded_within_24h` - Boolean flag for return rate
- `first_prediction_seen` - User views first personalized run-out date
- `time_to_first_prediction` - Timestamp delta (landing → first prediction)

**Dashboard Queries:**
- Activation rate by path (Demo only / Teach Mode / CSV + Teach / CSV only)
- Median time-to-first-prediction by path
- CSV return rate (requested → uploaded within 24h)

### 17.2 Trust & Confidence Metrics

**Events to Track:**
- `confidence_badge_hover` - User hovers/taps badge to see tooltip
- `confidence_tooltip_opened` - User clicks "Why is this low?" link
- `confidence_coach_viewed` - User expands Confidence Coach panel
- `confidence_improve_action` - User taps "Record purchase" or "Set frequency" from coach
- `prediction_override` - User manually changes predicted run-out date
- `prediction_override_rate_by_confidence` - Segment by High/Medium/Low

**Dashboard Queries:**
- Override rate by confidence level (target: High <5%, Medium <15%, Low <30%)
- Confidence tooltip engagement rate (target: >20% of Low confidence views)
- Time-series: Household avg confidence score over 30 days

### 17.3 Micro-Review Efficacy

**Events to Track:**
- `micro_review_started` - User enters review queue
- `micro_review_item_shown` - Item presented for review
- `micro_review_accepted` - User taps Accept
- `micro_review_edited` - User taps Edit (track: `edit_type` = name/quantity/unit/price)
- `micro_review_rejected` - User taps Reject
- `micro_review_skipped` - User taps Skip
- `micro_review_completed` - User finishes entire queue
- `micro_review_abandoned` - User closes sheet before completing
- `micro_review_variant` - A/B test variant (2-tap / 3-tap / grouped)
- `post_review_poll_shown` - "Was this correct?" poll (24h later)
- `post_review_poll_response` - User confirms or reports error

**Dashboard Queries:**
- Edit rate by variant and field type
- Time-to-complete by variant
- Post-review accuracy rate (poll responses)
- Downstream override rate for reviewed items (7-day window)

### 17.4 Feature Adoption

**Events to Track:**
- `one_tap_restock_used` - User records purchase via button
- `shopping_list_generated` - Auto-list created from predictions
- `shopping_list_exported` - User shares/exports list
- `household_member_invited` - Admin sends invitation
- `notification_clicked` - User opens app from push/email notification

**Dashboard Queries:**
- One-Tap Restock usage rate (% of eligible items per week)
- Shopping list generation rate (Phase 2)
- Multi-user household adoption rate

---

## 18. Key Design Decisions (v1.1 Summary)

### 17.1 Dynamic Urgency Colors (CRITICAL)
**Problem**: Static thresholds (red ≤3 days, yellow 3-7 days) ignore item-specific purchase cycles.
- Example: 6 days left is healthy for milk (7-day cycle) but critical for toilet paper (90-day cycle).

**Solution**: Frequency-relative color coding
- Red: ≤25% of cycle remaining OR ≤3 days
- Yellow: ≤50% of cycle remaining OR ≤7 days  
- Green: >50% of cycle remaining

**Impact**: Color-coding now reflects actual urgency, building trust in predictions.

### 17.2 CSV Wait Time → Productive Activation (CRITICAL)
**Problem**: Amazon CSV requires 5-10 minute email delivery, breaking <5 minute activation goal.

**Solution**: Pivot to Teach Mode during wait
1. User requests Amazon CSV
2. Immediately pivot: "While you wait, add 3 frequent items"
3. User activates in <3 minutes with Teach Mode predictions
4. CSV arrives later → Smart merge → High-confidence predictions

**Impact**: Activation goal achieved via Teach Mode, CSV enhances accuracy when it arrives.

### 17.3 Confidence Badge Transparency
**Problem**: Generic tooltips ("Based on 8+ purchases") don't explain WHY confidence is high/low.

**Solution**: Show prediction reasoning
- "Based on 8 purchases with consistent pattern (±1.2 days) and recent purchase (12 days ago)"

**Impact**: Users understand confidence scores and know how to improve them.

### 17.4 Micro-Review A/B Test
**Problem**: Unclear if 2-tap (faster) or 3-tap (more discoverable) is better for review flow.

**Solution**: A/B test both variants
- Variant A: Accept/Reject primary, Edit icon (hypothesis: faster)
- Variant B: Accept/Edit/Reject equal (hypothesis: better quality)
- Metric: Time to complete + edit rate

**Impact**: Data-driven decision on review UX.

---

**End of UX Design Specification**

*This document is a living specification and will be updated based on user testing, technical constraints, and stakeholder feedback. All design decisions should be validated with real users before full implementation.*

**Document Status**: Ready for design mockups and developer handoff. All critical feedback from external review has been addressed.

