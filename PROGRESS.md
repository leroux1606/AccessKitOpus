# AccessKit — Progress Log

*Last updated: 16 April 2026*

---

## What's Built ✅

### Core Application (Phases A–G)
- **Next.js 15** app with TypeScript, Tailwind CSS v4, shadcn/ui
- **Authentication** — NextAuth.js v5, magic link (Resend), Google OAuth, GitHub OAuth
- **Database** — PostgreSQL via Supabase, Prisma ORM, full schema with all models
- **Scanning engine** — axe-core + Playwright crawler, pa11y secondary engine
- **Standards mapping** — WCAG 2.1 A/AA, WCAG 2.2, Section 508, EN 301 549
- **Fix suggestions** — 50+ template fixes per violation type, Claude AI integration ready
- **Issue workflow** — detail pages, comments, assignment, bulk actions, priority matrix
- **Reporting** — PDF generation, CSV export, shareable links, VPAT compliance reports
- **Agency features** — white-label, client portals, REST API v1 with key auth, OpenAPI docs
- **Webhooks** — HMAC-signed outgoing webhooks with delivery log
- **Automation** — Inngest scheduled scans, email notifications via Resend, trial reminders
- **Billing** — Stripe integration (checkout, portal, webhooks) — needs PayStack swap
- **Benchmarking** — competitor scanning and side-by-side score comparison
- **Security** — SSRF guard with DNS rebinding protection, rate limiting, GDPR compliance
- **Legal pages** — Privacy Policy, Terms of Service, cookie consent banner
- **Landing page** — hero, live demo scan, features, pricing, API docs page

### Session: 15 April 2026
- **Team invitations** — full invite flow (send email, accept at `/invite/[token]`, revoke)
  - Plan seat-limit enforcement with upgrade prompt
  - Pending invitations list with revoke button (owner/admin only)
  - Remove member action with role guards
- **Org switching** — cookie-based active org, `getActiveMembership()` utility
  - Fixed non-deterministic `findFirst` bug for multi-org users
  - Org switcher now actually switches (was a no-op TODO)
- **Onboarding page** — `/onboarding` with create-org form (edge case: user without org)
- **Scan auto-verification** — violations no longer found on re-scan auto-marked `VERIFIED`
- **UI overhaul** — consistent design across all pages:
  - Dashboard: two-column layout, proper greeting using name from email
  - Websites: step-by-step guide in empty state, dashed "Add website" card
  - Issues, Reports: context-aware empty states
  - Benchmarking, Client Portals: upgrade gates with feature lists
  - Integrations: all 4 integrations shown with lock/available badges + code snippet
  - Sidebar: Documentation link no longer hidden at the very bottom
- **Fixed**: `accesskit.app` external links replaced with internal `/docs` route
- **Fixed**: Build error in integrations page (template literal with `${{}}`)
- **Database**: `Invitation` table pushed to Supabase via `prisma db push`

### Session: 16 April 2026 (continued)
- **Multi-org migration** — all top-level dashboard pages + server actions now use `getActiveMembership()`
  - issues, issues/matrix, reports, benchmarking, clients, team, settings/*, websites/new
  - reports/actions.ts (3 usages), reports/page.tsx migrated
- **Org rename** — owners/admins can rename their org from the Settings page
  - `PATCH /api/settings/org` — validates, updates, returns new name
  - `OrgRenameForm` client component — inline edit with save/cancel/keyboard support
- **AI fix suggestions** — Claude Haiku generates contextual fix suggestions on first view
  - `src/lib/ai.ts` — Anthropic client + `generateAiFixSuggestion()` helper
  - Violation detail page generates and caches AI suggestion on first load (Agency plan only)
  - `@anthropic-ai/sdk` installed
- **GDPR data export** — now includes issue assignments (`assignedIssues` field in export JSON)
- **Data retention** — already exists and registered (`data-retention` Inngest job, weekly Sunday 03:00 UTC)

### Session: 16 April 2026
- **PayStack integration** — added alongside Stripe (not replacing it)
  - `src/lib/paystack.ts` — full API client (initialize, verify, customer, subscription, webhook sig)
  - `src/app/api/billing/paystack-checkout/route.ts` — creates customer + initializes transaction with plan code
  - `src/app/api/billing/paystack-portal/route.ts` — returns subscription self-service management link
  - `src/app/api/webhooks/paystack/route.ts` — handles all subscription events, maps plan codes to PlanType
  - Schema: `paystackCustomerCode` + `paystackSubscriptionCode` added to Organization, pushed to Supabase
  - `billing-actions.tsx` — PayStack checkout/portal buttons added; upgrade flow now uses PayStack
  - `billing/page.tsx` — passes `hasPaystackSubscription` prop

---

## What's Left ⏳

### BLOCKER — Revenue
- [ ] **Sign up at paystack.com** — create account for AccessKit
- [ ] **Create plans in PayStack dashboard** — Starter/Professional/Agency monthly + annual (6 plans)
- [ ] **Set PayStack env vars** — `PAYSTACK_SECRET_KEY` + 6 `PAYSTACK_*_PLAN_CODE` vars in `.env`

### Authentication
- [ ] **Google OAuth** — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` not set in `.env`
- [ ] **GitHub OAuth** — `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` not set in `.env`
- [ ] **Magic link name capture** — users who sign in via email have no display name stored
  - Workaround in place: extracts first name from email prefix

### Email
- [ ] **Verify `accesskit.app` domain in Resend** — currently limited to sending to own email only
  - Add DNS TXT + MX records in domain registrar
  - Change `EMAIL_FROM` from `onboarding@resend.dev` to `noreply@accesskit.app`

### Features (stubs needing completion)
- [ ] **AI fix suggestions** — code complete, needs `ANTHROPIC_API_KEY` set in `.env`
- [ ] **Screenshot capture** — `screenshotUrl` field in schema, R2 stub in place
  - Needs Cloudflare R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, etc.)
- [ ] **GitHub Action** — `accesskit/scan-action@v1` mentioned in docs but not built
- [ ] **Org name editing** — users cannot rename their auto-generated org (e.g. "jan.leroux0")
  - Add org name field to Settings page

### Multi-org (partial)
- [ ] **Website-specific pages** still use raw `db.membership.findFirst`
  - These check website ownership (not active-org context) — lower priority
  - Affects: `websites/[websiteId]/**` pages and their actions.ts files

### GDPR / Compliance gaps
- [ ] Cookie consent not persisted server-side

### Production / Deployment
- [ ] Deploy to Vercel (frontend + API routes)
- [ ] Deploy scan worker to Fly.io or Railway (Playwright needs persistent containers)
- [ ] Set up `SCANNER_WORKER_URL` and `SCANNER_API_SECRET` in `.env`
- [ ] Configure Inngest for production (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`)
- [ ] Set up Sentry DSN for error tracking
- [ ] Configure PostHog for production analytics
- [ ] Set up Checkly or BetterStack for uptime monitoring
- [ ] Run AccessKit against itself — must score 95+ (non-negotiable for an accessibility tool)

### Testing gaps
- [ ] Server actions untested
- [ ] Crawler / scanner pipeline untested end-to-end
- [ ] Inngest job pipeline untested

---

## Environment Variables Needed

| Variable | Status | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ Set | Supabase with pgbouncer |
| `DIRECT_URL` | ✅ Set | Supabase direct connection |
| `AUTH_SECRET` | ✅ Set | |
| `RESEND_API_KEY` | ✅ Set | Domain unverified — can only send to own email |
| `AUTH_GOOGLE_ID/SECRET` | ❌ Empty | Google OAuth not working |
| `AUTH_GITHUB_ID/SECRET` | ❌ Empty | GitHub OAuth not working |
| `STRIPE_*` | ⚠️ Set | Will be replaced by PayStack |
| `ANTHROPIC_API_KEY` | ❌ Not set | Needed for AI fix suggestions |
| `R2_*` | ❌ Not set | Needed for screenshot storage |
| `SCANNER_WORKER_URL` | ❌ Not set | Needed for actual scans |
| `INNGEST_EVENT_KEY` | ❌ Not set | Needed for background jobs |
| `SENTRY_DSN` | ❌ Not set | Error tracking |

---

## Immediate Next Steps (Priority Order)

1. Sign up at **paystack.com** — create account for AccessKit
2. Build PayStack integration (mirror ComplianceKit's `lib/paystack.ts`)
3. Verify **accesskit.app** domain in Resend → magic link works for all users
4. Set `AUTH_GOOGLE_ID/SECRET` so Google login works
5. Add **org rename** to Settings page
6. Set `ANTHROPIC_API_KEY` to enable AI fix suggestions
7. Deploy to Vercel + set up scan worker
