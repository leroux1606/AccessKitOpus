# AccessKit — Global SaaS Product Plan

## IMPORTANT: Instructions for AI Implementation

This document is the authoritative planning reference for building AccessKit. Read it completely before writing any code. Build each phase fully before starting the next. Ask the user when you encounter ambiguity in business logic or UX decisions. Do not skip steps or cut corners. The goal is a production-quality SaaS product that competes with enterprise tools at agency-friendly prices.

---

## 1. Product Vision

**One-liner:** The most actionable web accessibility platform for agencies — scan, fix, prove compliance, and resell to clients.

**Why AccessKit wins:** Existing tools either (a) cost enterprise money (Siteimprove: $10K+/yr), (b) are developer-CLI-only (axe DevTools), or (c) are scammy overlays (accessiBe). AccessKit fills the gap: **agency-grade scanning + white-label client delivery + guided remediation at $299/month.**

**Market timing:** EU European Accessibility Act enforcement began June 2025. US ADA digital lawsuits hit ~4,500/year. Every agency with SMB clients is scrambling. This is not a nice-to-have — it is a legal compliance tool.

**Positioning (critical):** AccessKit is a **monitoring and baseline assessment tool**, NOT a compliance guarantee. Marketing must never claim "make your site compliant" — instead: "find, track, and fix accessibility issues systematically."

---

## 2. Competitive Moat — What Makes AccessKit Hard to Beat

These features, taken together, differentiate AccessKit from every competitor:

### 2.1 Guided Remediation Engine (not just detection)
- Every violation gets a **specific, copy-paste code fix** — not generic guidance
- Show the actual offending HTML element alongside the corrected version
- Link to relevant WCAG success criterion with plain-English explanation
- Prioritize fixes by **impact × effort** (not just severity) — help agencies fix the most impactful issues first
- AI-powered fix suggestions that understand the context of the surrounding HTML

### 2.2 Issue Workflow & Collaboration
- Issues are not just a report — they are **trackable tasks**
- Assign issues to team members
- Status tracking: Open → In Progress → Fixed → Verified (re-scan confirms)
- Comments and notes on issues
- Filter/sort by assignee, status, severity, page, category
- This turns AccessKit from a "scanning tool" into a "compliance project management tool"

### 2.3 Client Portal (White-Label)
- Agencies create branded portals for each of their clients
- Clients log in and see: current score, issues, progress over time, next scan date
- Custom domain support (accessibility.agencyname.com)
- Client receives automatic email digests of progress
- Agencies look professional; clients see value; churn decreases

### 2.4 Compliance Evidence Package
- Generate a **VPAT (Voluntary Product Accessibility Template)** style report
- Timestamped scan results that serve as evidence of due diligence
- Before/after comparisons showing remediation progress
- Exportable compliance timeline for legal teams
- This is what makes the $299/month feel cheap — it's legal protection

### 2.5 CI/CD Integration (Developer Workflow)
- GitHub Action / GitLab CI / Bitbucket Pipeline integration
- Scan staging URLs on every PR/deploy
- Block merges if new critical accessibility issues are introduced
- Comment on PRs with scan results summary
- Developers catch issues before production — agencies prevent regressions

### 2.6 Multi-Standard Support
- WCAG 2.1 Level A & AA (core)
- WCAG 2.2 (latest standard)
- Section 508 (US federal)
- EN 301 549 (EU standard)
- ADA compliance mapping
- Let users select which standards apply to each website
- Violations are tagged with which standards they violate

### 2.7 Competitive Benchmarking
- Scan competitor websites (within plan limits)
- Show side-by-side accessibility score comparison
- "Your client's site scores 72. Their top competitor scores 41." — powerful sales tool for agencies

---

## 3. Target Users & Use Cases

### Primary: Web Agencies (60% of revenue target)
- Have 10-200 client websites
- Need to audit, fix, and prove compliance
- Want to resell accessibility as a service to their clients
- Need white-label reports and client portals
- Decision maker: Agency owner or project manager

### Secondary: In-House Web Teams (25% of revenue target)
- Companies with their own websites (ecommerce, SaaS, media)
- Need ongoing monitoring and developer workflow integration
- Care about CI/CD integration and issue assignment
- Decision maker: Engineering lead or VP of Engineering

### Tertiary: Freelance Web Developers (15% of revenue target)
- Individual developers who want to offer accessibility audits
- Lower price sensitivity, fewer sites
- Good for word-of-mouth growth and community building

---

## 4. Pricing & Plans

**Payment processor: Stripe** (global coverage, supports 135+ currencies, subscription management built-in)

### Plans

| Feature | Starter | Professional | Agency | Enterprise |
|---|---|---|---|---|
| **Price** | $49/month | $149/month | $349/month | Custom |
| **Annual discount** | $39/month | $119/month | $279/month | Custom |
| **Websites** | 3 | 25 | 150 | Unlimited |
| **Pages per scan** | 50 | 250 | 1,000 | Unlimited |
| **Scan frequency** | Monthly | Weekly | Daily | Real-time |
| **Team seats** | 1 | 3 | 10 | Unlimited |
| **Standards** | WCAG 2.1 AA | All standards | All standards | All + custom |
| **Reports** | Basic PDF | PDF + CSV + shareable links | White-label + compliance package | Custom branded |
| **Client portal** | No | No | Yes (branded) | Yes (custom domain) |
| **CI/CD integration** | No | GitHub Action | All CI/CD + API | All + webhook |
| **Issue workflow** | View only | Assign + track | Full workflow + client view | Full + SLA tracking |
| **Remediation guidance** | Generic tips | Code-level fixes | AI-powered fixes + priority matrix | Dedicated support |
| **Benchmarking** | No | No | Yes (5 competitors) | Unlimited |
| **Support** | Email | Priority email | Slack + onboarding call | Dedicated CSM |

### One-Time Audit Product
- **$499** — single website, up to 500 pages, full compliance report + remediation guide + 1 re-scan after 30 days
- Purpose: lead generation funnel into subscriptions
- After delivery, offer 20% discount on first 3 months of a subscription

### Revenue Model Notes
- Target: 500 paying customers within 18 months
- Blended ARPU target: ~$180/month
- Annual run rate goal: ~$1M ARR
- Gross margin target: >80% (scanning infrastructure is the main COGS)

---

## 5. Tech Stack

### Frontend & Backend
- **Next.js 15** (App Router) — full-stack framework
- **TypeScript** (strict mode, zero `any` types)
- **Tailwind CSS v4** + **shadcn/ui** — consistent, accessible UI components
- **React Server Components** where possible (minimize client JS)

### Database
- **PostgreSQL** (via Supabase or Neon for managed hosting)
- **Prisma ORM** — type-safe queries, migrations, seeding
- **Row-level security** via Prisma middleware (tenant isolation)

### Authentication
- **NextAuth.js v5 (Auth.js)**
- Providers: Google OAuth, GitHub OAuth, Email magic link
- Session strategy: JWT (stateless, scales horizontally)
- Organization/team support via custom tables

### Payments
- **Stripe** — subscriptions, invoices, customer portal, webhook events
- Stripe Checkout for signup flow
- Stripe Customer Portal for self-service plan management
- Metered billing consideration for enterprise (per-scan pricing)

### Scanning Engine
- **Playwright** (preferred over Puppeteer — better cross-browser support, more reliable, maintained by Microsoft)
- **axe-core** — industry standard accessibility engine (Deque)
- **pa11y** — secondary engine for broader coverage
- **Custom rules engine** — extensible layer for AccessKit-specific checks
- Run in isolated containers (avoid noisy-neighbor issues)

### AI Layer
- **Claude API** (Anthropic) — for generating contextual fix suggestions, plain-English explanations, and VPAT report narratives
- Cache AI responses per violation pattern to control costs
- Fallback to template-based suggestions if AI is unavailable

### Background Jobs
- **Inngest** — event-driven background jobs (scan scheduling, report generation, email sending)
- Benefits: built-in retry, concurrency control, cron scheduling, observability dashboard
- Alternative if self-hosting: **BullMQ** + Redis

### Email
- **Resend** — transactional emails (scan complete, new issues, weekly digest, team invitations)
- **React Email** — email templates in JSX

### File Storage
- **Cloudflare R2** — S3-compatible, zero egress fees (important for screenshot-heavy product)
- Store: violation screenshots, PDF reports, white-label assets (logos)

### Hosting & Infrastructure
- **Vercel** — frontend + API routes + serverless functions
- **Fly.io** or **Railway** — long-running scan workers (Playwright needs persistent containers, not serverless)
- **Upstash Redis** — rate limiting, caching, job queues (if not using Inngest)

### Monitoring & Observability
- **Sentry** — error tracking
- **PostHog** — product analytics, feature flags, session replay
- **Checkly** or **BetterStack** — uptime monitoring

### CI/CD
- **GitHub Actions** — lint, test, type-check, deploy
- Preview deployments on Vercel for every PR

---

## 6. Database Schema (Core Entities)

This is a high-level schema. Prisma will be the source of truth. Implement with these core entities:

### Organizations
```
Organization {
  id              String   @id @default(cuid())
  name            String
  slug            String   @unique
  plan            PlanType (STARTER, PROFESSIONAL, AGENCY, ENTERPRISE)
  stripeCustomerId    String?
  stripeSubscriptionId String?
  subscriptionStatus  SubscriptionStatus
  trialEndsAt     DateTime?
  whiteLabel      WhiteLabelConfig?  (JSON: logo, colors, customDomain)
  createdAt       DateTime
  updatedAt       DateTime
}
```

### Users & Memberships
```
User {
  id              String   @id @default(cuid())
  name            String?
  email           String   @unique
  emailVerified   DateTime?
  image           String?
  memberships     Membership[]
}

Membership {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  role            Role (OWNER, ADMIN, MEMBER, CLIENT_VIEWER)
  user            User
  organization    Organization
  @@unique([userId, organizationId])
}
```

### Websites
```
Website {
  id              String   @id @default(cuid())
  organizationId  String
  url             String
  name            String
  verified        Boolean  @default(false)
  verificationMethod VerificationMethod?
  currentScore    Int?     (0-100)
  lastScanAt      DateTime?
  scanFrequency   ScanFrequency (DAILY, WEEKLY, MONTHLY, MANUAL)
  standards       Standard[] (WCAG21_A, WCAG21_AA, WCAG22_AA, SECTION_508, EN_301_549)
  isCompetitor    Boolean  @default(false)  // for benchmarking
  createdAt       DateTime
  updatedAt       DateTime
}
```

### Scans
```
Scan {
  id              String   @id @default(cuid())
  websiteId       String
  status          ScanStatus (QUEUED, RUNNING, COMPLETED, FAILED)
  score           Int?
  pagesScanned    Int      @default(0)
  pageLimit       Int
  totalViolations Int?
  criticalCount   Int?
  seriousCount    Int?
  moderateCount   Int?
  minorCount      Int?
  duration        Int?     // milliseconds
  triggeredBy     TriggerType (MANUAL, SCHEDULED, CI_CD, API)
  errorMessage    String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime
}
```

### Pages (scanned within a scan)
```
Page {
  id              String   @id @default(cuid())
  scanId          String
  url             String
  title           String?
  score           Int?
  violationCount  Int      @default(0)
  screenshotUrl   String?
  loadTime        Int?     // milliseconds
  createdAt       DateTime
}
```

### Violations (Issues)
```
Violation {
  id              String   @id @default(cuid())
  scanId          String
  pageId          String
  websiteId       String   // denormalized for query performance

  // Detection data
  ruleId          String   // axe-core or pa11y rule ID
  engine          Engine   (AXE_CORE, PA11Y, CUSTOM)
  severity        Severity (CRITICAL, SERIOUS, MODERATE, MINOR)
  impact          String   // axe-core impact value
  category        Category (IMAGES, FORMS, COLOR, KEYBOARD, ARIA, STRUCTURE, MULTIMEDIA, NAVIGATION)

  // Standards mapping
  standards       String[] // which standards this violates: ["WCAG21_AA_1.1.1", "SECTION_508_a"]
  wcagCriterion   String?  // e.g., "1.1.1"
  wcagLevel       String?  // A, AA, AAA

  // Violation details
  description     String
  helpText        String
  helpUrl         String?
  htmlElement     String   // the offending HTML
  cssSelector     String
  xpath           String?
  screenshotUrl   String?  // screenshot of the specific element

  // Remediation
  fixSuggestion   String?  // template-based fix
  aiFixSuggestion String?  // AI-generated contextual fix
  fixedHtml       String?  // corrected HTML example
  effortEstimate  EffortLevel (LOW, MEDIUM, HIGH) // for priority matrix

  // Workflow
  status          IssueStatus (OPEN, IN_PROGRESS, FIXED, VERIFIED, WONT_FIX, FALSE_POSITIVE)
  assignedToId    String?
  resolvedAt      DateTime?
  verifiedAt      DateTime?  // confirmed fixed by re-scan

  // Fingerprint for tracking across scans
  fingerprint     String   // hash of (ruleId + cssSelector + websiteId) — tracks same issue across scans
  firstDetectedAt DateTime

  createdAt       DateTime
  updatedAt       DateTime
}
```

### Issue Comments
```
IssueComment {
  id              String   @id @default(cuid())
  violationFingerprint String  // links to violation by fingerprint, not single scan
  userId          String
  content         String
  createdAt       DateTime
}
```

### Scan Schedules
```
ScanSchedule {
  id              String   @id @default(cuid())
  websiteId       String
  frequency       ScanFrequency
  nextRunAt       DateTime
  lastRunAt       DateTime?
  enabled         Boolean  @default(true)
  createdAt       DateTime
}
```

### API Keys
```
ApiKey {
  id              String   @id @default(cuid())
  organizationId  String
  name            String
  keyHash         String   // store hashed, never plain
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  createdAt       DateTime
}
```

### Client Portal Access
```
ClientPortal {
  id              String   @id @default(cuid())
  organizationId  String
  websiteId       String
  slug            String   @unique
  customDomain    String?
  passwordHash    String?  // optional password protection
  logoUrl         String?
  primaryColor    String?
  companyName     String?
  enabled         Boolean  @default(true)
  createdAt       DateTime
}
```

### Indexes to create
- `Violation.fingerprint` — fast lookup for issue tracking across scans
- `Violation.websiteId + status` — dashboard queries
- `Violation.scanId + severity` — report generation
- `Scan.websiteId + createdAt` — history timeline
- `Website.organizationId` — tenant isolation queries
- `Membership.userId + organizationId` — auth checks

---

## 7. Application Structure

```
accesskit/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (marketing)/              # Public pages (no auth)
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── pricing/page.tsx
│   │   │   ├── features/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (auth)/                   # Auth pages
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/              # Authenticated app
│   │   │   ├── layout.tsx            # Sidebar + header
│   │   │   ├── page.tsx              # Dashboard overview
│   │   │   ├── websites/
│   │   │   │   ├── page.tsx          # Website list
│   │   │   │   ├── new/page.tsx      # Add website
│   │   │   │   └── [websiteId]/
│   │   │   │       ├── page.tsx      # Website detail + latest scan
│   │   │   │       ├── scans/page.tsx         # Scan history
│   │   │   │       ├── issues/page.tsx        # Issue list (with filters)
│   │   │   │       ├── issues/[issueId]/page.tsx  # Issue detail
│   │   │   │       ├── reports/page.tsx       # Generate/download reports
│   │   │   │       ├── settings/page.tsx      # Scan config, standards
│   │   │   │       └── benchmark/page.tsx     # Competitor comparison
│   │   │   ├── issues/               # Cross-website issue view
│   │   │   │   └── page.tsx          # All issues across all sites
│   │   │   ├── team/
│   │   │   │   └── page.tsx          # Team members, invitations
│   │   │   ├── clients/              # Client portal management
│   │   │   │   ├── page.tsx          # List client portals
│   │   │   │   └── [portalId]/page.tsx  # Configure portal
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx          # Org settings
│   │   │   │   ├── billing/page.tsx  # Stripe portal, plan management
│   │   │   │   ├── api-keys/page.tsx # API key management
│   │   │   │   └── white-label/page.tsx # White-label config
│   │   │   └── integrations/
│   │   │       └── page.tsx          # CI/CD setup, webhooks
│   │   ├── portal/                   # Client-facing portal (public)
│   │   │   └── [slug]/
│   │   │       ├── page.tsx          # Client dashboard
│   │   │       └── layout.tsx        # White-label layout
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── webhooks/
│   │       │   └── stripe/route.ts
│   │       ├── v1/                   # Public API (for API key holders)
│   │       │   ├── scans/route.ts
│   │       │   ├── websites/route.ts
│   │       │   ├── issues/route.ts
│   │       │   └── reports/route.ts
│   │       └── internal/             # Internal API routes
│   │           ├── scan/trigger/route.ts
│   │           └── scan/callback/route.ts
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── dashboard/                # Dashboard-specific components
│   │   │   ├── score-gauge.tsx       # Circular score display
│   │   │   ├── violation-card.tsx
│   │   │   ├── scan-history-chart.tsx
│   │   │   ├── issue-table.tsx
│   │   │   ├── severity-badge.tsx
│   │   │   ├── fix-suggestion.tsx    # Code diff display
│   │   │   └── benchmark-chart.tsx
│   │   ├── reports/                  # Report components
│   │   │   ├── pdf-template.tsx
│   │   │   └── compliance-package.tsx
│   │   └── portal/                   # Client portal components
│   ├── lib/
│   │   ├── auth.ts                   # NextAuth config
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── stripe.ts                 # Stripe client + helpers
│   │   ├── ai.ts                     # Claude API integration
│   │   ├── permissions.ts            # Role-based access control logic
│   │   ├── plans.ts                  # Plan limits and feature flags
│   │   └── utils.ts
│   ├── scanner/                      # Scanning engine (runs on worker)
│   │   ├── index.ts                  # Orchestrator
│   │   ├── crawler.ts                # Discover pages from sitemap/crawling
│   │   ├── axe-scanner.ts            # axe-core integration
│   │   ├── pa11y-scanner.ts          # pa11y integration
│   │   ├── screenshot.ts             # Capture violation screenshots
│   │   ├── scorer.ts                 # Calculate compliance score
│   │   ├── deduplicator.ts           # Fingerprint + deduplicate violations
│   │   ├── fix-generator.ts          # Generate fix suggestions (template + AI)
│   │   ├── standards-mapper.ts       # Map violations to WCAG/508/EN criteria
│   │   └── report-generator.ts       # PDF/CSV generation
│   ├── inngest/                      # Background job definitions
│   │   ├── client.ts
│   │   ├── scan-website.ts           # Main scan job
│   │   ├── generate-report.ts
│   │   ├── send-notification.ts
│   │   └── scheduled-scans.ts        # Cron-triggered scans
│   └── types/                        # Shared TypeScript types
│       ├── scan.ts
│       ├── violation.ts
│       └── plan.ts
├── worker/                           # Scan worker (deployed separately)
│   ├── Dockerfile
│   └── server.ts                     # Receives scan jobs, runs Playwright
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── ACCESSKIT_PLAN.md                 # This file
```

---

## 8. Implementation Phases

Build sequentially. Each phase must be fully functional and tested before starting the next. Each phase should result in a deployable state.

### Phase 1: Foundation (Auth + Database + Dashboard Shell)

**Goal:** User can register, log in, see an empty dashboard, create/switch organizations.

**Tasks:**
1. Initialize Next.js 15 project with TypeScript strict mode
2. Set up Tailwind CSS v4 + shadcn/ui
3. Set up Prisma with PostgreSQL — create full schema (all tables from Section 6)
4. Run initial migration and seed with test data
5. Implement NextAuth.js v5 with Google OAuth + GitHub OAuth + Email magic link
6. Build organization creation flow (user creates org on first login)
7. Build organization switching (users can belong to multiple orgs)
8. Implement Membership model with roles (OWNER, ADMIN, MEMBER, CLIENT_VIEWER)
9. Build dashboard layout: sidebar navigation, header with org switcher, user menu
10. Build empty-state dashboard page with "Add your first website" CTA
11. Implement permission middleware — all (dashboard) routes must verify auth + org membership
12. Set up Sentry for error tracking

**Acceptance criteria:**
- New user can register via Google, GitHub, or magic link
- User lands on dashboard after auth
- Organization is created automatically on first login
- Sidebar shows all navigation items (greyed out if not yet built)
- Unauthenticated users are redirected to login
- Users cannot access other organizations' data

---

### Phase 2: Website Management

**Goal:** User can add websites, see them in a list, configure scan settings.

**Tasks:**
1. Build "Add Website" form (URL input, name, select standards to check against)
2. URL validation (must be reachable, handle redirects)
3. Build website list page with cards showing: name, URL, score (--), last scan (never), status
4. Build website detail page (placeholder for scan results)
5. Implement website verification (3 methods):
   - Meta tag: `<meta name="accesskit-verification" content="[token]">`
   - DNS TXT record: `accesskit-verify=[token]`
   - File upload: `/.well-known/accesskit-verify.txt`
6. Build verification status UI with instructions for each method
7. Implement plan-based website limits (check on add)
8. Build website settings page (scan frequency, standards selection, delete website)
9. Build website deletion with confirmation (cascade deletes scans/violations)

**Acceptance criteria:**
- User can add a website by URL
- Website appears in list with pending verification status
- User can verify ownership via any of the 3 methods
- Plan limits are enforced (cannot add more sites than plan allows)
- Website settings can be modified

---

### Phase 3: Scanning Engine (Core Value)

**Goal:** User can trigger a scan and see real results. This is the most critical phase.

**Tasks:**
1. Build the page crawler:
   - Fetch and parse sitemap.xml first
   - If no sitemap, crawl from homepage following internal links
   - Respect robots.txt
   - Limit to plan's page count
   - Handle SPAs (wait for dynamic content to load)
2. Implement axe-core scanning:
   - Run axe-core on each page via Playwright
   - Capture all violations with full metadata
   - Map each violation to WCAG criteria and standards
3. Implement pa11y scanning:
   - Run pa11y as secondary engine
   - Merge results with axe-core (deduplicate by element + rule)
4. Build violation fingerprinting:
   - Generate stable fingerprint: hash(ruleId + cssSelector + websiteUrl)
   - Track same issues across scans (first detected date, still present, resolved)
5. Screenshot capture:
   - Full page screenshot per page
   - Element-level screenshot per violation (highlight the offending element)
   - Upload to Cloudflare R2
6. Score calculation:
   - Weighted formula: critical issues × 10, serious × 5, moderate × 2, minor × 1
   - Score = max(0, 100 - totalWeightedViolations) — capped at 0-100
   - Per-page scores and overall website score
7. Fix suggestion generation:
   - Template-based fixes for common violations (missing alt text, low contrast, missing labels, etc.)
   - Build a library of 50+ fix templates covering the most common axe-core rules
   - Claude API integration for contextual fixes (pass the HTML context, get a specific fix)
   - Cache AI suggestions per violation rule+context pattern
8. Standards mapping:
   - Map every axe-core/pa11y rule to: WCAG 2.1/2.2 criteria, Section 508, EN 301 549
   - Store in a configuration file for easy updates
9. Build scan orchestration:
   - "Scan Now" button triggers background job via Inngest
   - Scan status: QUEUED → RUNNING → COMPLETED / FAILED
   - Real-time progress updates (pages scanned, violations found so far)
   - Handle failures gracefully (timeout, unreachable, rate limited)
10. Build scan worker:
    - Separate deployable service (Dockerfile with Playwright + browsers)
    - Receives scan jobs, processes pages, sends results back via callback
    - Concurrency control (max 3 simultaneous scans per org to prevent abuse)
11. Build scan results UI:
    - Summary: score, total violations by severity, pages scanned, duration
    - Score gauge component (visual circular gauge)
    - Violation list grouped by severity, filterable by category
    - Individual violation detail: description, element HTML, screenshot, fix suggestion
    - Page-by-page breakdown

**Acceptance criteria:**
- User clicks "Scan Now", sees progress, sees results within a few minutes
- Violations are accurately detected with correct severity and category
- Each violation shows the offending HTML element and a fix suggestion
- Screenshots are captured and displayed
- Score is calculated and displayed
- Scan history is preserved (each scan is a snapshot)

---

### Phase 4: Reporting & History

**Goal:** Users can track progress over time, generate and export professional reports.

**Tasks:**
1. Build scan history timeline:
   - Chart showing score over time (line chart)
   - List of all past scans with summary stats
   - Click into any past scan to see full results
2. Build trend analysis:
   - "Issues opened" vs "issues resolved" over time
   - Category breakdown trends
   - Highlight improvements and regressions
3. PDF report generation:
   - Executive summary (score, top issues, trend)
   - Detailed violations with screenshots and fix suggestions
   - Standards compliance checklist (which criteria pass/fail)
   - Use @react-pdf/renderer for generation
4. CSV export:
   - All violations with full metadata
   - Filterable before export
5. Shareable report links:
   - Generate unique URL for a scan report
   - Optional password protection
   - Expiration date option
6. Compliance evidence package (Agency/Enterprise):
   - VPAT-style accessibility conformance report
   - Timestamped evidence trail
   - Before/after comparisons
   - Remediation progress narrative (AI-generated summary)

**Acceptance criteria:**
- Dashboard shows score trend chart
- PDF reports are professional and comprehensive
- CSV exports contain all violation data
- Shareable links work for unauthenticated viewers
- Compliance package contains legally useful evidence

---

### Phase 5: Issue Workflow & Collaboration

**Goal:** Turn violations into trackable, assignable issues that teams can work through systematically.

**Tasks:**
1. Build cross-scan issue tracking:
   - Use violation fingerprints to track issues across scans
   - Issue is "open" if latest scan still contains the fingerprint
   - Issue is "verified fixed" if a re-scan no longer finds the fingerprint
   - Show issue lifecycle: first detected → assigned → fixed → verified
2. Build issue list view:
   - Filterable by: status, severity, assignee, category, page, standard
   - Sortable by: severity, date detected, effort estimate
   - Bulk actions: assign, change status, mark as won't fix
3. Build issue detail view:
   - Full violation information
   - Code diff showing current HTML vs. suggested fix
   - Comments thread
   - Activity log (status changes, assignments)
   - Link to affected page (opens in new tab)
4. Build assignment system:
   - Assign to any team member in the organization
   - Email notification on assignment
   - "My Issues" filtered view
5. Build priority matrix view:
   - 2D grid: severity (y-axis) × effort (x-axis)
   - Help agencies decide what to fix first
   - Visual, drag-and-drop friendly
6. Cross-website issue dashboard:
   - See all open issues across all websites in one view
   - Summary stats: total open, by severity, by assignee
   - Useful for agency managers overseeing multiple client sites

**Acceptance criteria:**
- Issues persist across scans via fingerprinting
- Verified-fixed status is automatically set when re-scan confirms fix
- Team members can be assigned and notified
- Priority matrix helps users decide what to fix first
- Comments allow team collaboration on issues

---

### Phase 6: Billing & Subscriptions

**Goal:** Users can subscribe to plans, manage billing, and plan limits are enforced everywhere.

**Tasks:**
1. Integrate Stripe:
   - Create Stripe products and prices for each plan
   - Implement Stripe Checkout for new subscriptions
   - Implement Stripe Customer Portal for self-service management
   - Handle Stripe webhooks: subscription.created, updated, deleted, invoice.paid, payment_failed
2. Build pricing page (public marketing page):
   - Show all plans with feature comparison
   - Annual vs monthly toggle
   - "Start free trial" CTA (14-day trial on Professional plan)
3. Build billing settings page:
   - Current plan display
   - Usage stats (websites used, scans this month, team seats)
   - Upgrade/downgrade flow
   - Link to Stripe Customer Portal for payment method, invoices
4. Implement plan enforcement throughout the app:
   - Website limit per plan
   - Page-per-scan limit per plan
   - Scan frequency limit per plan
   - Team seat limit per plan
   - Feature gating: white-label, API, CI/CD, benchmarking
   - Show upgrade prompts when limits are hit (not error messages)
5. Build one-time audit purchase flow:
   - Stripe Checkout session for $499 one-time payment
   - Creates a temporary organization with one website slot
   - Delivers report + offers subscription discount
6. Free trial implementation:
   - 14 days on Professional plan
   - No credit card required to start
   - Email reminders at day 7, day 12, day 14
   - Downgrade to limited free view after trial (can see past results but not run new scans)

**Acceptance criteria:**
- Users can subscribe via Stripe Checkout
- Plan limits are enforced everywhere (soft limits with upgrade prompts)
- Stripe webhooks correctly update subscription status
- Free trial works end-to-end
- Users can upgrade, downgrade, and cancel self-service

---

### Phase 7: Agency Features

**Goal:** Agency plan customers can white-label reports, manage client portals, use the API, and set up webhooks.

**Tasks:**
1. White-label configuration:
   - Upload custom logo
   - Set brand colors (primary, secondary, accent)
   - Custom company name on reports
   - Preview before saving
2. White-label report generation:
   - PDF reports use the agency's branding, not AccessKit
   - Shareable links show agency branding
   - Remove all AccessKit mentions from client-facing outputs
3. Client portal:
   - Agency creates a portal per client website
   - Portal has unique slug URL (/portal/[slug])
   - Optional custom domain (CNAME setup instructions)
   - Client sees: score, issues, progress, next scan date
   - Client can leave comments on issues
   - Client does NOT see other websites or agency internals
   - Optional password protection
4. REST API:
   - Authenticated via API key (Bearer token)
   - Endpoints: list websites, trigger scan, get scan results, get issues, get reports
   - Rate limiting (100 requests/minute for Agency, 1000 for Enterprise)
   - OpenAPI/Swagger documentation
   - API key management UI (create, revoke, view last used)
5. Webhooks:
   - Configurable webhook URLs per organization
   - Events: scan.completed, scan.failed, issue.new_critical, score.decreased, issue.resolved
   - Webhook payload includes relevant data
   - Retry logic (3 attempts with exponential backoff)
   - Webhook delivery log in UI
6. CI/CD integration:
   - GitHub Action: `accesskit/scan-action@v1`
   - Accepts: API key, website URL (or auto-detect from PR)
   - Scans staging/preview URL
   - Posts results as PR comment (score, new issues, regressions)
   - Optional: fail the check if new critical issues are introduced
   - Documentation for GitLab CI and Bitbucket Pipelines (curl-based)

**Acceptance criteria:**
- Agency reports contain zero AccessKit branding when white-label is configured
- Client portals are fully functional and isolated
- API is documented and functional for all core operations
- Webhooks deliver reliably with retries
- GitHub Action works end-to-end on a test repo

---

### Phase 8: Automation & Monitoring

**Goal:** The product runs itself — scheduled scans, notifications, and alerts keep users engaged without manual action.

**Tasks:**
1. Scheduled scan system:
   - Inngest cron jobs trigger scans based on each website's frequency
   - Respect plan limits (daily for Agency, weekly for Professional, monthly for Starter)
   - Distribute scan times to avoid thundering herd (jitter)
   - Skip if website is unreachable (notify user after 3 consecutive failures)
2. Email notifications:
   - Scan complete: summary with score and issue counts
   - New critical issues detected: immediate alert
   - Score decreased: alert with comparison
   - Weekly digest: all websites summary, top issues, progress
   - Team: new assignment notification
   - Trial: reminder emails at day 7, 12, 14
   - All emails use React Email templates, sent via Resend
   - User notification preferences (per-type opt-in/opt-out)
3. Dashboard alerts:
   - In-app notification bell
   - Unread count badge
   - Mark as read, mark all as read
4. Competitive benchmarking:
   - Add competitor URLs to a website
   - Run scan against competitors (counts against plan scan limits)
   - Side-by-side score comparison chart
   - "Your site vs competitors" widget on website dashboard

**Acceptance criteria:**
- Scans run automatically on schedule
- Users receive relevant email notifications
- Notification preferences are respected
- Benchmarking comparison displays correctly

---

### Phase 9: Polish & Launch Preparation

**Goal:** Product is production-ready, performant, and market-ready.

**Tasks:**
1. Landing page / marketing site:
   - Hero: clear value prop with live demo scan
   - Features section with screenshots
   - Pricing table
   - Trust signals: "Scans powered by axe-core (used by Microsoft, Google)"
   - FAQ section addressing: "Can automated tools guarantee compliance?" (No — position honestly)
   - Blog section (for SEO)
2. Performance optimization:
   - Database query optimization (analyze slow queries)
   - Implement caching where appropriate (Redis)
   - Optimize large scan result page loads (virtualized lists, pagination)
   - Image optimization for screenshots (WebP, lazy loading)
3. Accessibility audit of AccessKit itself:
   - Run AccessKit against itself
   - Fix all critical and serious issues
   - Achieve 95+ score (this is non-negotiable — the product must be accessible)
4. Security hardening:
   - Rate limiting on all API routes
   - Input validation/sanitization everywhere
   - CSRF protection
   - Content Security Policy headers
   - SQL injection prevention (Prisma handles this, but verify)
   - XSS prevention (React handles this, but verify raw HTML rendering)
   - API key hashing (never store plain text)
   - Org data isolation audit (verify no cross-tenant data leaks)
5. Documentation:
   - API documentation (OpenAPI spec)
   - CI/CD integration guides
   - Knowledge base: common violations and how to fix them
6. Legal:
   - Terms of service
   - Privacy policy (GDPR compliant — you're targeting EU)
   - Cookie consent
   - Data processing agreement template (for Enterprise)

**Acceptance criteria:**
- Landing page converts (clear CTA, fast load)
- AccessKit scores 95+ on its own scan
- No security vulnerabilities in OWASP top 10
- API documentation is complete
- Legal pages are in place

---

## 9. Key Design Decisions (For the Implementing AI)

1. **Server Components by default.** Only use client components (`"use client"`) when you need interactivity (forms, modals, charts). Keep data fetching in server components.

2. **Server Actions for mutations.** Use Next.js Server Actions for form submissions and data mutations. Do not create API routes for internal operations.

3. **Optimistic UI where appropriate.** Issue status changes, assignments, and comments should update the UI immediately while the server action runs in the background.

4. **Violation fingerprinting is critical.** The fingerprint (hash of ruleId + cssSelector + websiteUrl) is how we track issues across scans. Get this right in Phase 3 — it underpins all of Phase 5.

5. **Scan worker is a separate service.** Playwright browsers are too heavy for serverless. The scan worker runs in a container (Fly.io or Railway). The Next.js app communicates with it via Inngest events.

6. **Cache AI responses aggressively.** Claude API calls for fix suggestions should be cached per (ruleId + htmlElement pattern). Most violations repeat — don't pay for the same suggestion twice.

7. **Plan limits are soft gates, not hard walls.** When a user hits a limit, show an upgrade prompt with the value of the next plan. Never show an error message for a plan limit.

8. **The product must be accessible.** Use semantic HTML, proper ARIA attributes, keyboard navigation, focus management, and color contrast everywhere. Use shadcn/ui components as a baseline (they're already accessible). Test with screen readers.

9. **Multi-tenant isolation is non-negotiable.** Every database query must include an organizationId filter. Use Prisma middleware to enforce this. Test that no cross-tenant data leaks exist.

10. **Error states and loading states everywhere.** Use React Suspense boundaries and error boundaries. Show skeletons during loading. Show helpful error messages with retry options.

---

## 10. Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=accesskit-screenshots

# Email
RESEND_API_KEY=re_...

# Scanning Worker
SCANNER_WORKER_URL=https://...
SCANNER_API_SECRET=...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Monitoring
SENTRY_DSN=https://...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

---

## 11. Success Metrics

Track these from day one via PostHog:

- **Activation rate:** % of signups that complete their first scan
- **Scan completion rate:** % of scans that complete successfully (target: >95%)
- **Time to first scan:** minutes from signup to first scan result
- **Report generation rate:** % of users who generate at least one PDF report
- **Issue resolution rate:** % of detected issues that get marked as fixed
- **Free trial → paid conversion:** target 10-15%
- **Monthly churn:** target <5% for paid plans
- **NPS score:** target >40

---

## Summary

AccessKit is a global accessibility monitoring SaaS targeting web agencies. The moat is: guided remediation (not just detection), issue workflow (not just reports), client portals (not just dashboards), and compliance evidence (not just scores). Build it phase by phase, keep it accessible, and ship fast — the regulatory window is open now.
