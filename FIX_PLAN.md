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

## Phase H — Scanner reliability / infra (P1)

- [ ] **H1.** Scanner deploy target decision
  *Playwright + Chromium + pa11y do not fit reliably in a 1 GB Lambda. Recommend a dedicated worker (Fly.io Machines, Railway, Render) for `scanWebsiteJob`. No code change — a deploy-topology decision is needed first.*
- [ ] **H2.** `axe.min.js` path resolution is `cwd`-dependent
  *`readFileSync(resolve(process.cwd(), "node_modules/..."))` breaks in serverless builds where cwd is `/var/task`. Use `require.resolve` + `__dirname` instead.*
- [ ] **H3.** pa11y parallel Chromium doubles memory
  *Currently spawns its own headless Chrome alongside the Playwright instance. Either reuse the Playwright browser, cap pa11y to serial, or make it opt-in.*

## Phase I — Advertised features that are stubbed (P1)

- [ ] **I1.** Wire `generateAiFixSuggestion` into the scan pipeline (or remove the "AI fixes" plan-limit + marketing copy)
- [ ] **I2.** Cloudflare R2 screenshot storage — currently a stub; scans don't save screenshots
- [ ] **I3.** CI/CD integrations (GitHub Action, CLI) — plan-gated UI exists but no backing implementation

## Phase J — Code quality / follow-ups (P2)

- [ ] **J1.** Adopt `permissions.ts` helpers (`hasRole`, `canManageTeam`, …) across server actions + API routes
  *Today most sites hardcode `["OWNER","ADMIN"].includes(role)`. Centralizing role policy reduces drift.*
- [ ] **J2.** Resolve unused / dead code flagged by audit
  *E.g. `PaystackPlan` interface was removed; confirm no other dead exports linger.*
- [ ] **J3.** Audit server-action imports — remove remaining unused `db` imports after multi-org refactor*

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

**Next up:** ▶ **H1 — Scanner deploy target decision** (non-code — needs infra/product sign-off before any `H2`/`H3` code changes land)

When resuming:
1. Read this file top-to-bottom to recover context.
2. Jump to the first `[ ]` item (currently **H1**).
3. After shipping each item: update its checkbox, run `pnpm type-check && pnpm lint && pnpm test`, and pause for user sign-off before starting the next.

**Current verification status (post-Phase G):** `pnpm type-check` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (189/189 pass)

**How the phases are ordered:**
G (remaining security) → H (scanner infra decisions) → I (stubbed features) → J/K (quality) → L (tests) → M (competitive features).
