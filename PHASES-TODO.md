# AccessKit — Remaining Phases

> Generated 2026-03-23. Work through one phase at a time.

---

## Phase A: UI Overhaul — COMPLETE (commit `582c56e`)

- [x] Tailwind v3 → v4 migration
- [x] Dark navy/purple color scheme
- [x] Landing page, login page, sidebar, header, cookie consent restyled
- [x] All 17 dashboard pages updated for dark theme
- [x] Badge, card, scoreToColor utility fixed for dark backgrounds
- [x] All upsell/warning/success cards use dark-safe colors
- [x] Responsive: sidebar hidden on mobile with logo bar fallback
- [x] Build verified passing

---

## Phase B: Reporting & History — COMPLETE (commit `28ddd38`)

- [x] Score-over-time line chart (was already done in Phase 3)
- [x] CSV export endpoint + download button (was already done)
- [x] PDF report generation (@react-pdf/renderer) — professional template with score, severity breakdown, page-by-page issues
- [x] Reports dashboard: generate from any completed scan, list/download/share/delete
- [x] Shareable report links (/report/[shareToken]) with expiry support
- [x] Report model in Prisma schema
- [x] VPAT compliance evidence report — PDF with WCAG 2.1 AA criteria mapping, conformance status, scan evidence (Agency+ only)

---

## Phase C: Issue Workflow & Collaboration — COMPLETE

- [x] Issue detail page with HTML diff (current vs fixed)
- [x] Comments thread on issues
- [x] Assign issues to team members
- [x] Status workflow: Open → In Progress → Fixed → Verified → Won't Fix → False Positive
- [x] Bulk actions on issue list (assign, change status, mark won't fix)
- [x] Priority matrix view (severity × effort grid)
- [x] Cross-website issue dashboard with status tabs, severity/website filters
- [x] Email + in-app notification on issue assignment (uses Resend + notification system from Phase F)

---

## Phase D: Billing & Subscriptions — COMPLETE

- [x] Stripe client library (`src/lib/stripe.ts`) — checkout sessions, portal sessions, customer management
- [x] Stripe Checkout for new subscriptions (monthly + annual per plan)
- [x] Stripe Customer Portal for self-service (`/api/billing/portal`)
- [x] Webhook handler: `src/app/api/webhooks/stripe/route.ts` — handles checkout.completed, subscription CRUD, invoice paid/failed
- [x] Pricing page (`/pricing`) — public, annual/monthly toggle, plan comparison, FAQ, one-time audit
- [x] Billing settings page with live usage stats + upgrade/portal buttons (`BillingActions` component)
- [x] One-time audit purchase ($499) via Stripe Checkout
- [x] Free trial email reminders (day 7, 2, 0) via Inngest cron + Resend
- [x] `.env.example` updated with monthly/annual price IDs per plan
- [x] Pricing link added to landing page nav
- [ ] Stripe products/prices need to be created in Stripe Dashboard (env vars configured, code ready)

---

## Phase E: Agency Features (was Phase 7) — COMPLETE

- [x] White-label config: logo upload (URL-based), brand colors, company name + live preview
- [x] White-label PDF reports (zero AccessKit branding when Agency+)
- [x] Client portal: `/portal/[slug]` public route, optional password protection
- [x] REST API: `/api/v1/` endpoints with API key auth + rate limiting (100/min Agency, 1000/min Enterprise)
- [x] OpenAPI/Swagger documentation (`/api/v1/openapi.json`)
- [x] API key management UI (create, revoke, usage tracking, max 10 per org)
- [x] Outgoing webhooks: configurable URLs, event types (4 events), HMAC signing, retry with backoff, delivery log, management UI
- [ ] GitHub Action: `accesskit/scan-action@v1` (deferred — API is functional for CI/CD integration via curl)

---

## Phase F: Automation & Monitoring — COMPLETE

- [x] Inngest cron jobs for scheduled scans (`scheduled-scans.ts` with `ScanSchedule` model)
- [x] Email notifications: scan complete, new critical issues, score drop (5+ points), weekly digest (Monday 10 AM UTC)
- [x] In-app notification bell with unread count badge, mark read / mark all read
- [x] Notification + NotificationPreference models in Prisma schema
- [x] Notification preferences settings page (per-type email/in-app toggles)
- [x] `scan/completed` event fired from scan-website job, triggers 3 notification handlers
- [x] Competitive benchmarking: add/remove/scan competitor websites, side-by-side bar chart, summary cards
- [x] Benchmarking gated to Agency+ plans (with plan limit enforcement)
- [x] All Inngest functions registered in serve handler
- [x] Build verified passing

---

## Phase G: Polish & Launch — COMPLETE

- [x] Landing page with live demo scan — enter URL, get instant score + top issues (rate limited)
- [x] Performance: selective field loading on dashboard + website pages, optimized queries
- [x] Security hardening: CSP tightened (unsafe-eval dev-only, upgrade-insecure-requests), rate limiting on public endpoints, /benchmarking added to protected routes
- [x] API documentation page (`/docs`) — endpoint reference, auth guide, webhook docs, CI/CD example
- [x] Legal pages: Terms, Privacy, Cookie consent (already existed)
- [ ] Self-audit: run AccessKit against itself, fix all issues, score ≥ 95 (requires running instance)

---

## Phase 3 Remaining (minor)

- [ ] Screenshots: implement `screenshot.ts` R2 upload (needs R2 credentials)
- [x] pa11y secondary scanner: `pa11y-scanner.ts` implemented, merged with axe-core results in main scanner (deduplication by fingerprint)

---

## Suggested order

1. **Phase A** — UI Overhaul (finish + commit what's started)
2. **Phase D** — Billing (Stripe integration enables revenue)
3. **Phase B** — Reporting (high-value user feature)
4. **Phase C** — Issue Workflow (collaboration features)
5. **Phase E** — Agency Features (premium tier value)
6. **Phase F** — Automation & Monitoring
7. **Phase G** — Polish & Launch
