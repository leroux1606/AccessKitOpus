# AccessKit — Fix Plan & Progress Log

Living document tracking every issue surfaced by the audit, what's been shipped,
and where to resume. Each section is ordered by priority (P0 = ship-stopper,
P3 = nice-to-have).

Legend: `[x]` done · `[ ]` open · `[~]` partially done

---

## Phase A — Critical security (P0) ✅ COMPLETED

- [x] **A1.** `/api/demo-scan` SSRF guard + unified rate limiter
  *Unauthenticated endpoint ran `runScan()` on user-supplied URLs without `assertSafeFetchUrl`. Now guarded + uses `checkRateLimit` (3/min/IP) and returns `Retry-After`.*
- [x] **A2.** Magic-link console log gated to dev only
  *Previously logged auth URLs unconditionally — anyone with production log access could sign in as any user. Now `NODE_ENV !== "production"` only.*
- [x] **A3.** Portal password moved out of query string → httpOnly cookie
  *New `POST /api/portal/[slug]/auth` sets a scoped httpOnly cookie. Page reads the cookie instead of `?token=…`. Adds 10-attempts-per-10-min anti-brute-force.*
- [x] **A4.** `isAllowedByRobots` rewritten (RFC 9309 style)
  *Old parser only read `Disallow` for `User-agent: *` with literal prefix match. New parser: agent groups, `Allow`, `*`/`$` wildcards, longest-match-wins, Allow beats Disallow on tie.*
- [x] **A5.** SSRF-guard every URL discovered by the crawler
  *Sitemap entries and anchor hrefs are now re-validated through `assertSafeFetchUrl` before Playwright visits them. Closes the rebind-via-sitemap hole.*

---

## Phase B — Multi-org correctness (P0) ✅ COMPLETED

- [x] **B1.** Replace `db.membership.findFirst({ where: { userId } })` with `getActiveMembership(userId)` across 29 files
  *Users in multiple orgs now land in the org they switched into via the `active-org` cookie, not an arbitrary one. Covers billing, settings, issues, reports, client portals, benchmarking, notifications, internal endpoints, and dashboard pages.*
- [x] **B2.** Hide delete-website Danger Zone from MEMBER role + enforce on server
  *Delete requires OWNER/ADMIN in both UI (`canDelete`) and the `deleteWebsite` server action.*

---

## Phase C — Data integrity (P1) ✅ COMPLETED

- [x] **C1.** Inngest `save-results` step idempotent
  *Deletes partial `Page`/`Violation` rows for the same `scanId` at the top of the transaction so retries can't double-write.*
- [x] **C2.** `calculateNextRunAt` extracted to `src/lib/scan-schedule.ts`
  *Single source of truth used by both the website-settings server action and the Inngest cron. No drift.*
- [x] **C3.** `UNLIMITED` sentinel replaces `Infinity` in `PLAN_LIMITS`
  *`Infinity` serializes to `null` through `JSON.stringify`; now `999_999`.*

---

## Phase D — GDPR / compliance (P1) ✅ COMPLETED

- [x] **D1.** Data export includes Notifications + NotificationPreferences
- [x] **D2.** Data retention purges Notifications older than 6 months
  *Was only purging Scans before.*

---

## Phase E — UX polish (P2) ✅ COMPLETED

- [x] **E1.** Org switcher handles failure — checks `res.ok`, shows inline error, disables while switching

---

## Phase F — Code quality (P2) ✅ COMPLETED

- [x] **F1.** `getInitials` deduped into `@/lib/utils` (5 copies removed)
- [x] **F2.** 14 ESLint errors → 0 (unused imports, unescaped entities, unused Stripe handler)
- [x] **F3.** 4 TypeScript errors in `scorer.test.ts` → 0

**Verification:** `pnpm type-check` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (141/141 pass)

---

## Phase G — Remaining security work (P1) ✅ COMPLETED

- [x] **G1.** CSRF protection on state-changing API routes
  *Added `src/lib/csrf.ts` with origin/referer matching. Wired into `middleware.ts` — every non-safe-method `/api/*` request now verifies the caller's `Origin` (falling back to `Referer`) against the app's own origin plus `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` / `APP_URL`. Skips NextAuth, webhooks (HMAC-verified), Inngest (signed), `/api/v1/*` (Bearer-key API), `/api/health`, and `/api/csp-report`. Covered by 24 unit tests.*
- [x] **G2.** Response-size caps on crawler page fetches
  *New `src/lib/http-limits.ts` exposes `readBodyCapped` + `fetchWithSizeLimit` with `DEFAULT_LIMITS` (ROBOTS_TXT 512 KB, SITEMAP_XML 10 MB, VERIFICATION 512 KB, PAGE_WEIGHT 15 MB, PAGE_SUBRESOURCE 10 MB). Crawler now size-caps sitemap + robots.txt fetches. New `src/scanner/page-limits.ts` installs a Playwright `page.route` interceptor that uses `route.fetch()` + Content-Length inspection to enforce per-page and per-subresource download caps — installed inside `scanPageWithAxe` and `crawlFromHomepage` so no pathological response can OOM the worker. `verify-website` refactored to use the shared helper. 13 new unit tests for `http-limits`.*
- [x] **G3.** Origin / Referer strict check on webhooks
  *New `src/lib/webhook-guard.ts` — `checkWebhookRequest()` rejects non-POST methods (405), oversized payloads >1 MB via Content-Length (413), and any request carrying a browser `Origin` header that isn't in an allowlist (403). Wired into both `/api/webhooks/paystack` and `/api/webhooks/stripe` **before** HMAC verification, so a stolen secret alone can't be replayed from a browser. Covered by 13 unit tests.*
- [x] **G4.** CSP report-only → enforced
  *CSP remains in enforcement mode and now pipes violations to a new `/api/csp-report` endpoint via both legacy `report-uri` and the modern `Reporting-Endpoints` / `report-to` header pair. The endpoint accepts `application/csp-report` and `application/reports+json`, caps payloads at 8 KB, rate-limits to 60 reports/min per IP, and logs a structured summary line for each violation.*

## Phase H — Scanner reliability / infra (P1) 🚧 PARTIAL

- [ ] **H1.** Scanner deploy target decision ← needs infra sign-off
  *Playwright + Chromium + pa11y do not fit reliably in a 1 GB Lambda. Recommend a dedicated worker (Fly.io Machines, Railway, Render) for `scanWebsiteJob`. No code change — a deploy-topology decision is needed first.*
- [x] **H2.** `axe.min.js` path resolution is `cwd`-independent
  *Switched to `createRequire(import.meta.url)` + `require.resolve("axe-core/axe.min.js")`. Works in any Node cwd (Lambda `/var/task`, PM2, Fly.io) and survives pnpm hoisting / workspace layouts. No more hardcoded `node_modules` path.*
- [x] **H3.** pa11y parallel Chromium no longer doubles memory
  *Now opt-in behind `SCANNER_ENABLE_PA11Y=true` (off by default), and when enabled runs URLs **serially** rather than via `Promise.all`. Cap also reduced from 5 to 3 URLs. Peak memory overhead drops from ~5× Chromium to ~1× when enabled, and 0 when disabled.*

## Phase I — Advertised features that are stubbed (P1) 🚧 PARTIAL

- [x] **I1.** `generateAiFixSuggestion` wired into the scan pipeline
  *Added a `generate-ai-fixes` Inngest step that runs after `save-results`. For orgs on a plan with `hasAiFixes` (Agency+), it selects up to 15 CRITICAL/SERIOUS violations per scan and generates Anthropic fix suggestions with a concurrency cap of 3 to respect rate limits. Skips silently when `ANTHROPIC_API_KEY` is unset, when plan doesn't include AI fixes, or when a violation already has a cached suggestion. The existing lazy per-view generation in the issue detail page still functions as a fallback.*
- [ ] **I2.** Cloudflare R2 screenshot storage — currently a stub
  *`src/scanner/screenshot.ts` returns `null` until `@aws-sdk/client-s3` is installed (requires user sign-off per the `Don't install packages unless asked` rule). Needs: R2 bucket env vars, presigned upload flow, and a `screenshotUrl` column on `Page`.*
- [ ] **I3.** CI/CD integrations (GitHub Action, CLI) — REST API already works, branded artifacts still pending
  *`POST /api/v1/scans` is implemented and authenticated via Bearer API keys, so any CI system can invoke it today. What's still missing is (a) an official GitHub Action repo that wraps the curl call, (b) a branded CLI binary, (c) a sample `.github/workflows/accessibility.yml`. Those live in separate repos.*

## Phase J — Code quality / follow-ups (P2) 🚧 PARTIAL

- [ ] **J1.** Adopt `permissions.ts` helpers (`hasRole`, `canManageTeam`, …) across server actions + API routes
  *Today most sites hardcode `["OWNER","ADMIN"].includes(role)`. Centralizing role policy reduces drift.*
- [x] **J2.** Clean up residual `Infinity` comparisons post-C3
  *Five remaining `=== Infinity` / `!== Infinity` callsites (team seat limit, billing usage card, competitor manager, `/api/v1/scans` pageLimit, team page) now use the `isUnlimited()` helper from `@/lib/plans`. Keeps the `UNLIMITED` sentinel policy consistent everywhere.*
- [ ] **J3.** Audit server-action imports — remove remaining unused `db` imports after multi-org refactor

## Phase K — Scanning accuracy & recommendations (P2)

- [ ] **K1.** Add WCAG 2.2 rule coverage audit
  *Confirm axe-core v4.x + pa11y ruleset covers 2.2 Level A/AA new criteria (Focus Not Obscured, Dragging Movements, Target Size Minimum, Consistent Help, Redundant Entry, Accessible Authentication).*
- [ ] **K2.** Fingerprint stability across re-scans
  *Verify `fingerprint` generation uses CSS selector + rule + element structure so "fixed" tracking works when page layout shifts slightly.*
- [ ] **K3.** False-positive triage for common landmark/region rules
  *Axe's `region` and `landmark-one-main` rules frequently flag modern SPA shells incorrectly. Decide whether to down-weight or exclude.*

## Phase L — Testing (P2)

- [ ] **L1.** Integration tests for auth routes (sign-in, magic-link, portal-auth)
- [ ] **L2.** Integration tests for multi-org switching + cookie-respecting `getActiveMembership`
- [ ] **L3.** Scanner end-to-end test against a known fixture HTML
- [ ] **L4.** Playwright E2E for critical UI flows (add website → verify → scan → view issue → comment)

## Phase M — Product competitiveness (P3)

- [ ] **M1.** Automated remediation PRs (GitHub App that opens fix PRs for common issues — alt/role/aria fixes)
- [ ] **M2.** PDF report styling pass (VPAT + exec summary + per-page drilldown)
- [ ] **M3.** Slack / Teams native notifications beyond the existing webhook
- [ ] **M4.** Email digest (weekly summary per website) opt-in
- [ ] **M5.** Public shareable badges (score badge for embedding in client sites)

---

## Continue from here

**Next up:** ▶ **H1 — Scanner deploy target decision** (non-code; needs infra sign-off) · then **I2 — R2 screenshot upload** (needs `@aws-sdk/client-s3` install approval) · then **J1 — adopt `permissions.ts` helpers**.

When resuming:
1. Read this file top-to-bottom to recover context.
2. Jump to the first `[ ]` item.
3. After shipping each item: update its checkbox, run `pnpm type-check && pnpm lint && pnpm test`, and pause for user sign-off before starting the next.

**Current verification status (post-H2/H3/I1/J2):** `pnpm type-check` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (189/189 pass)

**How the phases are ordered:**
G (remaining security) → H (scanner infra decisions) → I (stubbed features) → J/K (quality) → L (tests) → M (competitive features).
