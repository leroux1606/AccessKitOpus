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

## Phase H — Scanner reliability / infra (P1) ✅ COMPLETED

- [x] **H1.** Scanner deploy target decision → **Fly.io Machines** (decision + artifacts shipped)

  *Decision rationale.* Each concurrent Playwright scan holds ~700 MB – 1 GB of resident RAM. Running the Inngest `scan-website` function inside Next.js OOMs any 1 GB serverless ceiling (Vercel Hobby, Vercel Fluid on default, AWS Lambda Node) and saturates the web tier even when it doesn't OOM. A dedicated worker is required.

  Four candidates were evaluated against memory headroom, scale-to-zero, cold-start, Docker/Chromium compatibility, concurrency, cost, and ops surface:

  | Target | Verdict | Key reasons |
  |---|---|---|
  | **Fly.io Machines** ✅ chosen | Best fit | Pay-per-second, scale-to-zero (`auto_stop_machines = "stop"`), official `mcr.microsoft.com/playwright` base image works out-of-the-box, 2 GB default machine fits the Inngest-capped 3-concurrent workload with headroom, ~1–3 s cold start, single-file `fly.toml` config, ~$5–15/mo at starter traffic. |
  | Railway | Workable runner-up | Simpler git-push UX but no real scale-to-zero → always-on baseline cost, no per-machine isolation, similar per-hour rate once warm. |
  | Render | Too expensive | Standard plan at $25/mo for 2 GB (Starter's 512 MB is too small for Chromium); no production scale-to-zero. |
  | AWS Lambda (container image) | Overkill | 10 GB memory + 15-min timeout are great, but ops surface (IAM, SAM/CDK/Terraform, ECR) is disproportionate for a 1-function worker; cold starts on a ~700 MB Chromium image are 3–8 s. |

  *Code + infra shipped in this commit:*

  - **`worker/server.ts`** — standalone Node process using `inngest/node` (already a sub-export of the installed `inngest@4.0.1` package — zero new dependencies). Serves `scanWebsiteJob` on `:8080/api/inngest`, answers `GET /health` for Fly's proxy probe, and handles `SIGINT`/`SIGTERM` with a 25 s request-drain for safe rolling deploys.
  - **`Dockerfile`** — 2-stage build on `mcr.microsoft.com/playwright:v1.58.2-noble` (pinned to the exact Playwright version in `package.json`), Corepack-managed pnpm, `prisma generate` cached in the deps stage, runtime stage ships only the generated `node_modules` + `src/` + `worker/`. Runs as the built-in `pwuser` — Chromium refuses to launch as root on some kernels.
  - **`fly.toml`** — `shared-cpu-1x` / 2 GB RAM / `primary_region = "iad"` (co-located with Supabase US-East), `auto_stop_machines="stop"` + `auto_start_machines=true` + `min_machines_running=0` for full scale-to-zero, 3/6 soft/hard concurrency limit matching Inngest's 3-way function concurrency, rolling deploy strategy, health check on `/health`.
  - **`.dockerignore`** — excludes `.next`, `.env*`, test output, docs, VCS, editor clutter so `fly deploy` uploads a minimal context.
  - **`src/app/api/inngest/route.ts`** — now conditionally excludes `scanWebsiteJob` from the Next.js serve handler. Default behaviour: register in dev (`NODE_ENV!=="production"`), exclude in prod. Opt-back-in via `RUN_SCANS_IN_NEXT=true`. This stops the web tier from advertising the function to Inngest Cloud in prod, so every `scan/website.requested` event is routed to the Fly worker.
  - **`worker/README.md`** — deploy runbook (flyctl install → `fly launch` → `fly secrets` → `fly deploy`), tuning guide (memory, regions, cold-start trade-off), shutdown semantics, local-dev topology.
  - **`package.json`** — added `worker:dev` (`tsx --watch worker/server.ts`) and `worker:start` scripts.
  - **`.env.example`** — replaced the stale `SCANNER_WORKER_URL` placeholder (vestige of a never-built HTTP direct-call design) with `RUN_SCANS_IN_NEXT` + `SCANNER_ENABLE_PA11Y` reflecting the actual shipped architecture.

  *Architecture shift.* Both web and worker share the same Inngest app id (`accesskit`), same Postgres (Supabase), and same Prisma schema. They differ only in which functions they register: web serves everything except `scan-website`; worker serves only `scan-website`. Inngest Cloud routes events to whichever endpoint advertises the function id — no web→worker HTTP call required, no shared secret to rotate, no HMAC duplication.

  *Remaining follow-ups (deploy-time, not code).* Run `fly launch --name accesskit-scanner --copy-config`, set Fly secrets (`DATABASE_URL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, optional `ANTHROPIC_API_KEY`), `fly deploy`, then set `RUN_SCANS_IN_NEXT` to unset/`false` in the web tier's production env. Full runbook in `worker/README.md`.

- [x] **H2.** `axe.min.js` path resolution is `cwd`-independent
  *Switched to `createRequire(import.meta.url)` + `require.resolve("axe-core/axe.min.js")`. Works in any Node cwd (Lambda `/var/task`, PM2, Fly.io) and survives pnpm hoisting / workspace layouts. No more hardcoded `node_modules` path.*
- [x] **H3.** pa11y parallel Chromium no longer doubles memory
  *Now opt-in behind `SCANNER_ENABLE_PA11Y=true` (off by default), and when enabled runs URLs **serially** rather than via `Promise.all`. Cap also reduced from 5 to 3 URLs. Peak memory overhead drops from ~5× Chromium to ~1× when enabled, and 0 when disabled.*

## Phase I — Advertised features that are stubbed (P1) 🚧 PARTIAL

- [x] **I1.** `generateAiFixSuggestion` wired into the scan pipeline
  *Added a `generate-ai-fixes` Inngest step that runs after `save-results`. For orgs on a plan with `hasAiFixes` (Agency+), it selects up to 15 CRITICAL/SERIOUS violations per scan and generates Anthropic fix suggestions with a concurrency cap of 3 to respect rate limits. Skips silently when `ANTHROPIC_API_KEY` is unset, when plan doesn't include AI fixes, or when a violation already has a cached suggestion. The existing lazy per-view generation in the issue detail page still functions as a fallback.*
- [x] **I2.** Cloudflare R2 screenshot storage — shipped

  *Installed `@aws-sdk/client-s3@^3.1032.0` (approved by user) and replaced the `captureScreenshot` stub with a production `uploadScreenshot` / `buildScreenshotKey` / `screenshotsEnabled` trio in `src/scanner/screenshot.ts`. R2 is an S3-compatible endpoint (`https://<accountId>.r2.cloudflarestorage.com`, `region: "auto"`) so no R2-specific SDK is needed — we use `PutObjectCommand` directly per Cloudflare's current docs.*

  *Design contract.* Four guarantees the implementation enforces:
    1. **Scans can't fail on screenshot errors.** Every upload path returns `null` instead of throwing — missing env, size-cap breach, SDK rejection, network 4xx/5xx all degrade to a null `screenshotUrl`.
    2. **Env-gated by default.** Uploads are skipped unless all five vars are set: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL`. Missing any → Playwright screenshot call is never even made (see `screenshotsEnabled()` gate in `axe-scanner.ts`), so there's no wasted CPU on local dev.
    3. **Size-capped at 5 MB.** Viewport PNGs are ~100–500 KB typically; the cap only trips on anomalies. `fullPage: false` in the Playwright call keeps buffers small.
    4. **Opt-out for staging.** `SCANNER_CAPTURE_SCREENSHOTS=false` disables the feature even with R2 configured — useful to save cost on environments where reports don't need visuals.

  *Schema.* `Page.screenshotUrl` and `Violation.screenshotUrl` columns already existed in `prisma/schema.prisma` (from an earlier phase). No migration needed — wired straight into the save-results Inngest step.

  *Wiring.* `scanPageWithAxe` now accepts an optional `scanId`, captures a viewport PNG after axe finishes (reusing the already-hydrated page — no second navigation), uploads under key `scans/{scanId}/{hostname-path-slug}-{timestamp}.png`, and returns the public URL on `PageScanResult.screenshotUrl`. `runScan` gained a `{ scanId }` options param threaded through from the Inngest job. The `demo-scan` public route omits `scanId` so it simply skips uploads (desired — demo scans shouldn't land screenshots in the customer R2 bucket).

  *Tests.* `tests/unit/scanner/screenshot.test.ts` — 15 new cases mocking `@aws-sdk/client-s3` at the module boundary: env-gating (partial + empty env), size cap (0 and >5 MB), happy path (asserts bucket/key/content-type/cache-control match + returns the correct public URL), trailing-slash normalization on `R2_PUBLIC_URL`, SDK rejection → null, key builder slug/timestamp/URL-fallback/length-cap invariants, and the opt-out flag's exact-match behaviour.

  *Docker.* No `Dockerfile` / `fly.toml` change needed — the scanner worker copies full `node_modules` from its deps stage, so `@aws-sdk/client-s3` is automatically included in the Fly.io image.

  *Deploy checklist (no code — requires Cloudflare account).*
    1. Create an R2 bucket (e.g. `accesskit-screenshots`) in the Cloudflare dashboard.
    2. Create an R2 API token with Read+Write access to that bucket; copy the Access Key ID + Secret.
    3. Either bind a custom domain to the bucket (e.g. `https://screenshots.accesskit.app`) or enable the public `r2.dev` subdomain — that URL becomes `R2_PUBLIC_URL`.
    4. `fly secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET_NAME=accesskit-screenshots R2_PUBLIC_URL=…` on the scanner app.
    5. Redeploy the worker. Next scan will populate `screenshotUrl` on every `Page` row.
- [ ] **I3.** CI/CD integrations (GitHub Action, CLI) — REST API already works, branded artifacts still pending
  *`POST /api/v1/scans` is implemented and authenticated via Bearer API keys, so any CI system can invoke it today. What's still missing is (a) an official GitHub Action repo that wraps the curl call, (b) a branded CLI binary, (c) a sample `.github/workflows/accessibility.yml`. Those live in separate repos.*

## Phase J — Code quality / follow-ups (P2) ✅ COMPLETED

- [x] **J1.** Adopt `permissions.ts` helpers (`hasRole`, `canManageTeam`, …) across server actions + API routes
  *Replaced every hardcoded `["OWNER","ADMIN"].includes(role)` / `role === "OWNER" || role === "ADMIN"` callsite with the matching helper from `@/lib/permissions`. Covered: team actions + page (`canManageTeam`), website settings actions/page + `new/actions.ts` (`canManageWebsites` / `canConfigureOrg`), client-portals create + PATCH + DELETE (`canConfigureOrg`), settings org/white-label/api-keys/webhooks (`canConfigureOrg`), Stripe & PayStack checkout + portal routes (`canManageBilling`), settings index + billing page (`canConfigureOrg` / `canManageBilling`). Also reconciled `canManageBilling` in `permissions.ts` to match actual codebase policy (ADMIN+) — previously defined as OWNER-only but every call site allowed ADMIN, so the helper was drift waiting to happen. Permissions unit tests updated (`canManageBilling` now covers ADMIN). Left the invitee-role-validation list in `team/actions.ts` intact with a clarifying comment (it's a list of permitted invitee roles, not a hierarchical permission check).*
- [x] **J2.** Clean up residual `Infinity` comparisons post-C3
  *Five remaining `=== Infinity` / `!== Infinity` callsites (team seat limit, billing usage card, competitor manager, `/api/v1/scans` pageLimit, team page) now use the `isUnlimited()` helper from `@/lib/plans`. Keeps the `UNLIMITED` sentinel policy consistent everywhere.*
- [x] **J3.** Audit server-action imports — remove remaining unused `db` imports after multi-org refactor
  *Ran a full-repo named-import audit (every `import { ... } from "@/lib/db"` plus a broader sweep of all named-import blocks in `src/`). Zero unused `db` imports remain and zero unused named imports overall — the multi-org refactor (B1) already cleaned them up as it touched each file. No code change required; item closed with verification recorded here.*

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

**Next up (all remaining items need user input or new scope):**

1. ▶ **I3 — CI/CD integrations** (GitHub Action repo + branded CLI + sample workflow — separate-repo work).
2. ▶ **Phase K — scanning accuracy audit** (WCAG 2.2 rule coverage, fingerprint stability, false-positive triage).
3. ▶ **Phase L — integration & E2E tests** (auth routes, multi-org switching, scanner fixture, Playwright UI flows).
4. ▶ **Phase M — product competitiveness** (remediation PR bot, VPAT styling, Slack/Teams native, email digest, public badges).

**Deploy follow-ups (no code — require external accounts):**
- **H1 (Fly.io):** `fly launch` → `fly secrets set` → `fly deploy`, then unset `RUN_SCANS_IN_NEXT` on the web tier. Runbook: `worker/README.md`.
- **I2 (Cloudflare R2):** create bucket + API token + public-bound domain, then `fly secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET_NAME=… R2_PUBLIC_URL=…` on the scanner app. Full checklist under § I2 above.

When resuming:
1. Read this file top-to-bottom to recover context.
2. Jump to the first `[ ]` item that doesn't require external sign-off.
3. After shipping each item: update its checkbox, run `pnpm type-check && pnpm lint && pnpm test`, and pause for user sign-off before starting the next.

**Current verification status (post-I2):** `pnpm type-check` ✅ · `pnpm lint` ⚠ pre-existing (`@rushstack/eslint-patch` vs ESLint 9 incompatibility — unrelated to I2, reproduces on clean `62d3484`; needs a separate fix either pinning the patch or migrating to `eslint-config-next`'s flat export) · `pnpm test` ✅ (205/205 pass — +15 new `screenshot.test.ts` cases)

**How the phases are ordered:**
G (remaining security) → H (scanner infra decisions) → I (stubbed features) → J/K (quality) → L (tests) → M (competitive features).

With Phases G, H, I1+I2, and J now fully green, every code-only P0/P1 item from the original audit is shipped. Everything left is either a separate-repo feature (I3), broader test authoring, or new product work.
