# User Acceptance Testing (UAT) Plan

**Project:** Kirana - Smart Grocery Inventory Tracker  
**Phase:** Beta Testing (Phase 1G)  
**Duration:** 2-3 weeks  
**Target Users:** 20-30 beta testers  
**Date Created:** November 3, 2025

---

## 1. Overview

### Purpose
Validate that Kirana meets user needs and expectations before production launch. Gather real-world feedback on usability, prediction accuracy, and feature completeness.

### Goals
- **Validate Core Workflows:** CSV import, manual entry, teach mode, prediction accuracy
- **Identify Usability Issues:** Confusing UI, missing features, friction points
- **Test Production Readiness:** Performance, reliability, data integrity under real usage
- **Build User Trust:** Ensure predictions are accurate enough to be useful

---

## 2. Beta Tester Recruitment

### Target Audience (20-30 Users)

**Primary Profiles:**
1. **Tech-Savvy Early Adopters (40%)** - 8-12 users
   - Comfortable with CSV exports, APIs, tech tools
   - Willing to report detailed bugs
   - Can handle rough edges in beta software
   - **Recruitment:** Twitter/X, Hacker News, ProductHunt, personal network

2. **Grocery Shoppers (40%)** - 8-12 users
   - Regular grocery shopping (≥1x per week)
   - Mix of families, singles, couples
   - Not necessarily tech-savvy (test onboarding clarity)
   - **Recruitment:** Friends, family, local community groups

3. **Budget-Conscious Users (20%)** - 4-6 users
   - Actively track expenses
   - Use apps like YNAB, Mint, or spreadsheets
   - Motivated by reducing waste and overspending
   - **Recruitment:** Personal finance communities, Reddit r/personalfinance

### Diversity Criteria
- **Age Range:** 25-65 years old (mix across age groups)
- **Household Size:** Singles (30%), couples (30%), families 3+ (40%)
- **Technical Skill:** Tech-savvy (40%), average (40%), low-tech (20%)
- **Shopping Patterns:** Weekly bulk (50%), frequent small trips (30%), mixed (20%)

### Exclusion Criteria
- ❌ Current/former team members
- ❌ Users who don't buy groceries regularly
- ❌ Users outside USA (time zones, store compatibility)

### Recruitment Channels

**Direct Outreach (Target: 15 users)**
- Personal contacts: Friends, family, colleagues
- Email invite with demo video and signup link
- Personalized message explaining beta purpose

**Social Media (Target: 10-15 users)**
- **Twitter/X Post:**
  ```
  🛒 Looking for beta testers for Kirana - a smart grocery inventory tracker!
  
  ✨ Features:
  - Import your past purchases (Amazon, Instacart CSV)
  - Predict when you'll run out of items
  - Never forget milk again 🥛
  
  🎁 Benefits:
  - Free lifetime Pro account
  - Early access to new features
  - Help shape the product
  
  Interested? Sign up: [link]
  ```

- **Hacker News/ProductHunt:**
  - Show HN post with demo video
  - Link to beta signup form

- **Reddit Communities:**
  - r/personalfinance (budget tracking angle)
  - r/internetparents (household management)
  - r/productivity (organization tools)

**Community Groups (Target: 5 users)**
- Local Facebook groups (parenting, community)
- Nextdoor neighborhood posts
- Company Slack channels

### Screening Survey
Before accepting testers, collect basic info:
- **Name + Email**
- **Household size:** 1 / 2 / 3-4 / 5+
- **Shopping frequency:** Multiple times per week / Weekly / Biweekly
- **Tech comfort:** Very comfortable / Comfortable / Need help sometimes / Not comfortable
- **How do you currently track groceries?** (Free text)
- **What would make you trust an app to predict when you'll run out of milk?** (Free text)
- **Willing to provide feedback:** Yes (30+ min) / Yes (15 min) / Maybe (5 min)

**Auto-accept if:**
- Shops groceries ≥1x per week
- Willing to provide feedback
- Mix of demographics achieved

---

## 3. Onboarding Process

### Beta Invitation Email

**Subject:** You're in! Welcome to the Kirana Beta 🎉

**Body:**
```
Hi [Name],

Welcome to the Kirana beta! We're excited to have you test our smart grocery inventory tracker.

## What is Kirana?
Kirana helps you track your groceries and predicts when you'll run out of items - so you never forget milk again 🥛.

## Getting Started (< 5 minutes)
1. **Watch the Demo Video** (2 min): [YouTube link]
2. **Sign up:** [app.kirana.io/beta-signup]
3. **Import your past purchases:** Upload a CSV from Amazon, Instacart, or Walmart
   - Don't have a CSV? No problem - add items manually!
4. **Review your predictions:** See when you'll run out of each item

## Your Test Account
- **Email:** [prefilled]
- **Password:** [temporary password - please change on first login]
- **Beta Code:** BETA2025 (for any prompts)

## What We Need From You
- **Use the app for 2+ weeks** (add items, log restocks, check predictions)
- **Fill out our quick feedback survey** (5-10 min, link below)
- **Report any bugs** via the in-app feedback button or email beta@kirana.io

## Benefits for Beta Testers
✅ Free lifetime Pro account (worth $4.99/month after launch)
✅ Early access to new features
✅ Direct line to the product team
✅ Your feedback shapes the product!

## Important: This is Beta Software
You might encounter bugs or rough edges. That's expected! Please report anything confusing or broken.

## Questions?
Reply to this email or join our beta tester Slack: [invite link]

Thanks for helping us build Kirana!
- The Kirana Team

---

**Quick Links:**
- App: [app.kirana.io]
- Demo Video: [YouTube]
- Feedback Survey: [Google Form]
- Bug Reports: beta@kirana.io
- Slack: [invite link]
```

### First-Time User Experience (FTUE)

**Goal:** Get users to first prediction within 5 minutes.

**Onboarding Flow:**
1. **Welcome Screen** (5 sec)
   - Headline: "Never forget milk again 🥛"
   - Subheading: "Track your groceries, predict when you'll run out"
   - CTA: "Get Started"

2. **Account Setup** (30 sec)
   - Email (prefilled from invite)
   - Password
   - Household name (optional)

3. **Import Wizard** (3 min)
   - **Option A:** Upload CSV from Amazon, Instacart, Walmart
     - Example CSV templates provided
     - Progress bar during import
     - Micro-review of parsed items (show confidence scores)
   - **Option B:** Add items manually
     - Quick-add form: Item name, quantity, purchase date
     - "Add 5-10 items to get started"

4. **First Prediction** (1 min)
   - Dashboard shows items sorted by urgency
   - Callout box: "🎉 Your first predictions are ready!"
   - Explain urgency colors: Critical (red), Warning (yellow), Normal (green)
   - Teach mode callout: "Not accurate? Click 'Teach' to improve predictions"

**Onboarding Success Metrics:**
- ≥80% of users complete account setup
- ≥60% of users get first prediction within 5 min
- ≥50% of users use Teach Mode at least once in first session

### Pre-Populated Test Data (Optional)

For users who don't have CSV:
- Offer "Load Sample Data" button
- Pre-populate 15-20 common items (milk, bread, eggs, etc.)
- Show realistic prediction dates
- Explain: "This is sample data - replace with your own items"

**Sample Items:**
- Whole Milk (1 gallon) - Runs out in 6 days
- Eggs (12 count) - Runs out in 8 days
- Bread (1 loaf) - Runs out in 4 days
- Bananas (1 bunch) - Runs out in 3 days (Critical!)
- Chicken Breast (2 lbs) - Runs out in 10 days
- Rice (5 lbs bag) - Runs out in 45 days
- [10 more items...]

---

## 4. UAT Success Criteria

### Primary Metrics (Must Pass)

| Metric | Target | Measurement | Pass/Fail |
|--------|--------|-------------|-----------|
| **Activation Rate** | ≥60% get first prediction in <5 min | Track time from signup to first dashboard load with items | ❌ Fail if <50% |
| **Retention (Day 7)** | ≥40% return after 7 days | Track users with ≥2 sessions, ≥7 days apart | ❌ Fail if <30% |
| **Prediction Accuracy** | ≥70% rate as "accurate" or better | Post-beta survey question | ❌ Fail if <60% |
| **Usability (SUS Score)** | ≥70 (good) | System Usability Scale questionnaire | ❌ Fail if <65 |
| **Critical Bugs** | <5 reported | Bug tracker (P0/P1 severity only) | ❌ Fail if ≥5 |

### Secondary Metrics (Nice to Have)

| Metric | Target | Measurement |
|--------|--------|-------------|
| CSV Import Success | ≥80% successful imports | Track parse errors vs. success |
| Teach Mode Usage | ≥50% use at least once | Track teach mode submissions |
| Average Session Duration | ≥3 minutes | Analytics (engaged users) |
| Feature Discovery | ≥60% discover Teach Mode | Track first use of feature |
| Recommendation (NPS) | ≥30 (acceptable) | "How likely to recommend?" (0-10) |

### Qualitative Feedback Themes

Track sentiment and frequency for:
- **Onboarding Clarity:** Is CSV import confusing? Manual entry too slow?
- **Prediction Trust:** Do users believe the run-out dates? What makes them trust/distrust?
- **Micro-Review Friction:** Too many items to review after CSV import? Confidence scores clear?
- **UI/UX Polish:** Confusing buttons, missing features, visual hierarchy issues
- **Feature Requests:** What would make this a "must-have" app?

---

## 5. Feedback Collection

### In-App Feedback

**Feedback Button (Bottom-Right Corner):**
- Always visible on dashboard
- Opens modal with:
  - "What would you like to tell us?" (textarea)
  - "Is this a bug or feature request?" (radio: Bug / Feature / Other)
  - "How critical is this?" (radio: Blocker / Important / Nice to have)
  - Screenshot upload (optional)
  - Email (prefilled, editable)
- Sends to Linear/GitHub Issues
- Auto-reply email: "Thanks! We'll review within 24 hours"

### Post-Beta Survey (Google Form)

**Timing:** Sent after 2 weeks of usage  
**Length:** 10-15 questions (~5-10 minutes)  
**Incentive:** Entry into $100 Amazon gift card raffle

**Survey Questions:**

**Section 1: Usage Patterns**
1. How often did you use Kirana during the beta?
   - [ ] Daily
   - [ ] 3-4 times per week
   - [ ] 1-2 times per week
   - [ ] A few times total
   - [ ] Once or never

2. What was your primary way of adding items?
   - [ ] CSV import (Amazon, Instacart, etc.)
   - [ ] Manual entry (one by one)
   - [ ] Mix of both
   - [ ] I didn't add items

3. How many items do you currently track in Kirana?
   - [ ] 0-5 items
   - [ ] 6-15 items
   - [ ] 16-30 items
   - [ ] 31-50 items
   - [ ] 50+ items

**Section 2: Prediction Accuracy**
4. How accurate were Kirana's predictions for when you'd run out of items?
   - [ ] Very accurate (95%+ correct)
   - [ ] Mostly accurate (70-95% correct)
   - [ ] Somewhat accurate (50-70% correct)
   - [ ] Not very accurate (30-50% correct)
   - [ ] Inaccurate (<30% correct)

5. Did you use "Teach Mode" to improve predictions?
   - [ ] Yes, multiple times
   - [ ] Yes, once or twice
   - [ ] No, but I noticed it
   - [ ] No, I didn't see this feature

6. What would make predictions more useful to you? (Free text)

**Section 3: Usability (SUS - System Usability Scale)**
Rate each statement (1=Strongly Disagree, 5=Strongly Agree):

7. I think I would like to use this app frequently.
8. I found the app unnecessarily complex.
9. I thought the app was easy to use.
10. I think I would need help to use this app.
11. I found the various features were well integrated.
12. I thought there was too much inconsistency in this app.
13. I would imagine most people would learn to use this app quickly.
14. I found the app very cumbersome to use.
15. I felt very confident using the app.
16. I needed to learn a lot before I could use this app.

**Section 4: Feature Feedback**
17. What feature did you find most useful?
    - [ ] Predictive run-out dates
    - [ ] CSV import (bulk add items)
    - [ ] Teach Mode (improve accuracy)
    - [ ] Dashboard urgency view
    - [ ] Restock logging
    - [ ] Other: ___________

18. What feature was confusing or frustrating? (Free text)

19. What feature is missing that would make this a "must-have" app? (Free text)

**Section 5: Overall Satisfaction**
20. How likely are you to recommend Kirana to a friend? (0-10 scale)
    - **NPS Score:** Promoters (9-10), Passives (7-8), Detractors (0-6)

21. Would you pay $4.99/month for Kirana after the beta?
    - [ ] Yes, definitely
    - [ ] Probably yes
    - [ ] Maybe
    - [ ] Probably not
    - [ ] No, I'd stop using it

22. Any final thoughts or suggestions? (Free text)

### Weekly Check-In (Email or Slack)

**Week 1:** "How's your first week with Kirana?"
- Quick poll: 👍 Going great / 😐 It's okay / 👎 Having issues
- Link to feedback form
- Reminder: "Need help? Reply to this email!"

**Week 2:** "We'd love your feedback!"
- Share post-beta survey link
- Highlight new features added based on Week 1 feedback
- Ask: "What's working? What's not?"

**Week 3 (Final):** "Thank you for beta testing!"
- Final survey reminder (raffle entry)
- Share launch timeline
- Confirm lifetime Pro account activation
- Ask for testimonials (if positive experience)

---

## 6. Bug Reporting Process

### Bug Tracking

**Tool:** GitHub Issues (labeled `beta-bug`)

**Bug Report Template:**
```markdown
## Bug Description
[Clear description of what went wrong]

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
[What should have happened]

## Actual Behavior
[What actually happened]

## Screenshots
[If applicable]

## Environment
- **Browser:** Chrome 119 / Safari 17 / Firefox 120
- **Device:** Desktop / Mobile / Tablet
- **User ID:** [auto-filled from session]
- **Timestamp:** [auto-filled]

## Severity
- [ ] P0 - Blocker (can't use app)
- [ ] P1 - Critical (major feature broken)
- [ ] P2 - Important (minor feature broken)
- [ ] P3 - Nice to fix (cosmetic issue)
```

**Bug Triage (Daily During Beta):**
- **P0 (Blocker):** Fix within 24 hours, notify all users
- **P1 (Critical):** Fix within 48 hours, add to sprint
- **P2 (Important):** Fix before launch
- **P3 (Nice to fix):** Backlog for post-launch

### Common Expected Issues

| Issue | Expected Frequency | Mitigation |
|-------|-------------------|------------|
| CSV parsing errors | High (20-30% of imports) | Clear error messages, example CSV templates |
| Low prediction confidence | Medium (15-20% of items) | Teach Mode prominent, explain factors |
| Slow LLM responses | Medium (5-10% of imports) | Loading states, 60s timeout with fallback |
| Mobile UX issues | Low-Medium (5-15% of users) | Responsive design, mobile testing |
| Missing common features | Low (5-10% of users) | Feature request backlog |

---

## 7. Success Evaluation

### Dashboard Tracking

**Real-Time Metrics (Grafana Dashboard):**
- Active beta users (daily/weekly)
- Average session duration
- CSV imports (success vs. failure)
- Teach Mode usage rate
- API error rates (by endpoint)
- Page load times (p50, p95, p99)

**Weekly KPIs (Excel Spreadsheet):**
| Week | Signups | Active Users | Activation Rate | Day 7 Retention | Avg Items/User | Teach Mode % | Bugs Reported (P0/P1) |
|------|---------|--------------|-----------------|-----------------|----------------|--------------|------------------------|
| 1    | 20      | 18           | 60%             | N/A             | 12             | 45%          | 2 / 5                  |
| 2    | 25      | 22           | 68%             | 42%             | 18             | 58%          | 1 / 3                  |
| 3    | 30      | 26           | 72%             | 48%             | 22             | 65%          | 0 / 2                  |

### Go/No-Go Decision Matrix

**Launch if ALL criteria met:**
- ✅ Activation ≥60%
- ✅ Day 7 Retention ≥40%
- ✅ Prediction Accuracy ≥70% (survey)
- ✅ SUS Score ≥70
- ✅ Critical Bugs <5
- ✅ NPS ≥0 (more promoters than detractors)

**Delay launch if ANY criterion fails:**
- ❌ Activation <50% → Fix onboarding flow
- ❌ Retention <30% → Investigate why users churn
- ❌ Accuracy <60% → Improve prediction algorithm
- ❌ SUS <65 → Major UX overhaul needed
- ❌ Critical Bugs ≥5 → Stabilize before launch
- ❌ NPS <-20 → Fundamental product issues

### Post-Beta Retrospective

**Team Meeting (1 hour):**
1. **Review Metrics:** Did we hit targets?
2. **Top Bugs:** What broke most often?
3. **Feature Requests:** What do users want most?
4. **Onboarding:** What was confusing?
5. **Predictions:** Were they accurate enough?
6. **Go/No-Go:** Are we ready to launch?

**Output Document:** `docs/testing/uat-retrospective.md`
- Key learnings
- Top 5 bug fixes before launch
- Top 5 feature requests for v1.1
- Launch decision (Go / Delay / Major pivot)

---

## 8. Timeline

### Pre-Beta (Week 0)
- [ ] Finalize beta signup form
- [ ] Create demo video (2 min)
- [ ] Set up bug tracking (GitHub Issues)
- [ ] Configure analytics (Mixpanel/Amplitude)
- [ ] Prepare invitation email template
- [ ] Test onboarding flow internally

### Week 1: Recruitment + Early Testing
- [ ] **Day 1-2:** Send invites to first 10 users (personal network)
- [ ] **Day 3-5:** Post on social media (Twitter, HN, Reddit)
- [ ] **Day 6-7:** Onboard first cohort (10-15 users)
- [ ] **Daily:** Monitor for P0/P1 bugs, respond within 24 hours

### Week 2: Active Testing
- [ ] **Day 8:** Send Week 1 check-in email
- [ ] **Day 10:** Invite second cohort (10-15 users)
- [ ] **Day 14:** Review metrics, fix top bugs

### Week 3: Feedback + Wrap-Up
- [ ] **Day 15:** Send post-beta survey to all users
- [ ] **Day 18:** Reminder email (survey + raffle)
- [ ] **Day 21:** Final survey analysis, retrospective meeting
- [ ] **Day 22:** Go/No-Go decision for launch

---

## 9. Resources

### Tools
- **Signup Form:** Google Forms or Typeform
- **Email:** SendGrid or Mailchimp
- **Survey:** Google Forms
- **Analytics:** Mixpanel, Amplitude, or PostHog
- **Bug Tracking:** GitHub Issues with `beta-bug` label
- **Communication:** Slack channel #beta-testers

### Team Responsibilities
- **Product Manager:** Recruitment, user communication, survey analysis
- **Designer:** Onboarding flow polish, video creation
- **Engineer:** Bug fixes, analytics instrumentation, dashboard monitoring
- **QA:** Bug triage, reproduction, regression testing

### Budget
- **Demo Video Production:** $500 (Loom + editing) or DIY
- **Survey Incentive:** $100 Amazon gift card raffle
- **Analytics Tools:** $0 (free tiers sufficient for 30 users)
- **Total:** ~$600

---

## 10. Contingency Plans

### Low Signup Rate (<15 users by Week 1)
- **Action:** Expand recruitment to Reddit, Facebook groups, Nextdoor
- **Incentive:** Increase raffle to $200 or add 3× $50 gift cards

### High Churn (>50% drop off after Week 1)
- **Action:** Emergency user interviews (5-10 users), identify friction points
- **Quick Wins:** Fix top 3 usability issues within 48 hours

### Critical Bug Discovered
- **Action:** Pause new signups, notify all users via email, fix within 24 hours
- **Rollback:** Revert to previous stable version if fix is complex

### Low Survey Response (<50%)
- **Action:** Send 2 reminder emails, increase raffle prize
- **Fallback:** Conduct 1-on-1 interviews with 10 users

---

## Appendix: System Usability Scale (SUS) Calculation

**Scoring Formula:**
1. For odd-numbered questions (1, 3, 5, 7, 9): Subtract 1 from the user response (0-4 scale)
2. For even-numbered questions (2, 4, 6, 8, 10): Subtract the user response from 5 (inverted 0-4 scale)
3. Sum all scores and multiply by 2.5 (total 0-100 scale)

**Interpretation:**
- **90-100:** Excellent (best imaginable)
- **80-89:** Good (better than average)
- **70-79:** Acceptable (average)
- **60-69:** Poor (needs improvement)
- **<60:** Unacceptable (major UX overhaul needed)

**Example Calculation:**
- Q1 (positive): User rates 5 → Score = 5 - 1 = 4
- Q2 (negative): User rates 2 → Score = 5 - 2 = 3
- Sum all 10 questions: 32
- Final SUS Score: 32 × 2.5 = 80 (Good!)

---

**Last Updated:** November 3, 2025  
**Owner:** Product Team  
**Status:** Ready for Beta Launch
