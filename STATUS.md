# AccessKit — Build Status

## What's done

### Phase 1: Foundation ✅ (commit `67e4ed1`)
- Next.js 15 + TypeScript strict + Tailwind + shadcn/ui base components
- Full Prisma schema (all 13 entities from the plan)
- NextAuth.js v5: Google OAuth, GitHub OAuth, Resend magic link (JWT sessions)
- Auto-creates org + OWNER membership on first sign-up, 14-day trial
- Dashboard layout: sidebar, org switcher, user menu
- Auth middleware protecting all dashboard routes
- Seed file with demo data (3 websites, 3 violations, 1 completed scan)

### Phase 2: Website Management ✅ (commit `c3c59f0`)
- Add website form (Server Action, URL validation, plan limit check)
- Website list page with score cards
- Website detail page: score/issues/scan stats, top issues preview, sub-nav tabs
- Ownership verification: 3-method panel (meta tag / DNS TXT / file), live API check
- Website settings: name, scan frequency (plan-gated), standards selection
- Delete website with typed-name confirmation, cascade deletes all data
- Website issues page: filterable by severity and status
- Scan history page: full table with all past scans

### Phase 3: Scanning Engine ✅ (core done)
- `src/inngest/client.ts` — Inngest v4 client
- `src/inngest/scan-website.ts` — full job: crawl → axe-core → score → save → update website
- `src/app/api/inngest/route.ts` — Inngest HTTP handler (GET/POST/PUT)
- `src/scanner/crawler.ts` — sitemap.xml parser + Playwright link-crawl fallback + robots.txt
- `src/scanner/axe-scanner.ts` — Playwright + @axe-core/playwright, full violation extraction
- `src/scanner/standards-mapper.ts` — maps axe tags → WCAG/508/EN standards + criterion + level
- `src/scanner/deduplicator.ts` — SHA-256 fingerprint (ruleId + selector + origin)
- `src/scanner/scorer.ts` — weighted formula: critical×10, serious×5, moderate×2, minor×1
- `src/scanner/fix-generator.ts` — 50+ template fixes for common axe-core rules
- `src/scanner/index.ts` — orchestrator: runScan()
- `src/scanner/screenshot.ts` — stub (activates when R2 env vars are set)
- `src/scanner/pa11y-scanner.ts` — stub for future pa11y integration
- `src/types/scan.ts` — ScanViolation, PageScanResult, ScanResult, ScanEventData types
- `ScanButton` client component — triggers scan, shows spinner, redirects to progress page
- `src/app/(dashboard)/websites/[websiteId]/actions.ts` — triggerScan() server action
- `src/app/(dashboard)/websites/[websiteId]/scans/[scanId]/page.tsx` — scan detail: progress + full results
- `src/app/(dashboard)/websites/[websiteId]/scans/[scanId]/scan-poller.tsx` — 3s polling client component
- `src/app/api/internal/scan-status/route.ts` — scan status polling endpoint
- "Scan now" button is live (requires website ownership verified)

**Packages added:** `inngest@4`, `playwright`, `@axe-core/playwright`

---

## What still needs to be built

### Phase 3 remaining (minor)
- Screenshots: install `@aws-sdk/client-s3`, implement `screenshot.ts` R2 upload once R2 is configured
- pa11y secondary engine: `npm install pa11y`, implement `pa11y-scanner.ts`, merge with axe results
- Score trend chart on website overview (line chart, needs chart library e.g. recharts)

### Phase 4: Reporting & History
- Score-over-time line chart on website detail
- PDF report generation (@react-pdf/renderer)
- CSV export of violations
- Shareable report links (unique URL, optional password, expiry)
- VPAT-style compliance evidence package (Agency plan)

### Phase 5: Issue Workflow & Collaboration
- Issue detail page with HTML diff (current vs fixed)
- Comments thread on issues
- Assign issues to team members + email notification
- Status workflow: Open → In Progress → Fixed → Verified
- Bulk actions on issue list (assign, change status, mark won't fix)
- Priority matrix view (severity × effort grid)
- Cross-website issue dashboard

### Phase 6: Billing & Subscriptions
- Stripe products/prices for all 4 plans
- Stripe Checkout for new subscriptions
- Stripe Customer Portal for self-service
- Webhook handler: `src/app/api/webhooks/stripe/route.ts`
- Pricing page (public, with annual/monthly toggle)
- Billing settings page with live usage stats
- One-time audit purchase ($499)
- Free trial email reminders (day 7, 12, 14) via Resend

### Phase 7: Agency Features
- White-label config: logo upload, brand colors, company name preview
- White-label PDF reports (zero AccessKit branding)
- Client portal: `/portal/[slug]` public route, optional password
- REST API: `/api/v1/` endpoints with API key auth + rate limiting
- OpenAPI/Swagger documentation
- Webhooks: configurable URLs, event types, retry logic, delivery log
- GitHub Action: `accesskit/scan-action@v1`

### Phase 8: Automation & Monitoring
- Inngest cron jobs for scheduled scans (per website frequency)
- Email notifications: scan complete, new critical, score drop, weekly digest
- In-app notification bell with unread count
- Competitive benchmarking: scan competitor URLs, side-by-side chart

### Phase 9: Polish & Launch
- Landing page with live demo scan
- Performance: query optimization, Redis caching, virtualized lists
- Self-audit: run AccessKit against itself, fix all issues, score ≥ 95
- Security hardening: rate limiting, CSP headers, input sanitization audit
- API documentation
- Legal pages: Terms, Privacy, Cookie consent

---

## Where to resume next session

**Phase 3 remaining items OR Phase 4 (Reporting):**

Option A — Finish Phase 3 remaining:
1. `score-trend-chart.tsx` — recharts line chart on website detail (install: `npm install recharts`)
2. Screenshot upload — implement `screenshot.ts` using `@aws-sdk/client-s3` once R2 creds available
3. pa11y — `npm install pa11y` + implement merge logic in `pa11y-scanner.ts`

Option B — Start Phase 4 (more user-visible value):
1. Score-over-time chart on `/websites/[websiteId]` using scan history
2. `src/app/(dashboard)/websites/[websiteId]/reports/page.tsx` — report generation UI
3. PDF report: `npm install @react-pdf/renderer`, create `src/components/reports/pdf-template.tsx`
4. CSV export: generate from violations, stream as download
5. Shareable links: create `ShareableReport` model or extend Scan with a `shareToken`

---

## Running Phase 3 locally (dev)

1. Set env vars in `.env.local`:
   ```
   DATABASE_URL=postgresql://...
   AUTH_SECRET=...
   INNGEST_EVENT_KEY=...   # get from app.inngest.com
   INNGEST_SIGNING_KEY=... # get from app.inngest.com
   ```

2. Start Inngest dev server:
   ```bash
   npx inngest-cli@latest dev
   ```

3. Start Next.js dev server:
   ```bash
   npm run dev
   ```

4. Inngest dev server proxies job execution to `http://localhost:3000/api/inngest`

---

## Environment variables needed

```
DATABASE_URL=          # PostgreSQL (Supabase or Neon recommended)
AUTH_SECRET=           # generate with: openssl rand -base64 32
INNGEST_EVENT_KEY=     # from inngest.com dashboard
INNGEST_SIGNING_KEY=   # from inngest.com dashboard
ANTHROPIC_API_KEY=     # for AI fix suggestions (Phase 3, step 8)
R2_ACCOUNT_ID=         # for screenshots (can skip for early Phase 3)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```
