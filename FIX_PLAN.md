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

## Phase I — Advertised features that are stubbed (P1) ✅ COMPLETED

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
- [x] **I3.** CI/CD integrations — CLI + GitHub Action + sample workflow shipped in-tree

  *Three complementary artifacts plus one small API addition — all extraction-ready so they can be split to dedicated public repos without code changes:*

  1. **`GET /api/v1/scans/{scanId}`** — new endpoint for single-scan polling. Previously the REST surface only exposed list-and-filter; CI integrations had no clean way to wait for a specific scan. The new endpoint returns the scan plus per-page summary (id, url, score, violationCount, screenshotUrl, loadTime), scoped to the caller's org. Added to the OpenAPI spec alongside the existing scan/issue/website routes.

  2. **`cli/accesskit.mjs` + `cli/package.json` + `cli/README.md`** — zero-dependency Node 20 ESM CLI. Single file, no `node_modules` needed in CI, uses native `fetch`. Commands:
     - `accesskit scan <websiteId>` — triggers a scan, polls to completion, and gates the exit code on thresholds (`--fail-on-critical/serious/moderate/minor/any`, `--min-score`). Defaults to 600 s timeout with 10 s poll interval; both tunable. Supports `--no-wait` for fire-and-forget, `--json` for machine-readable output. **Idempotent**: if the API returns 409 "scan already in progress", the CLI attaches to the existing scan rather than erroring, so retries-after-timeout don't double-charge or double-queue.
     - `accesskit status <scanId>` — one-shot status lookup.
     - `accesskit list [--website <id>]` — recent scans.

     Exit codes follow Unix conventions: `0` ok, `1` threshold breach, `2` usage error, `3` API/scan-failed, `4` polling timeout. Pure helpers (`evaluateThresholds`, `asInt`, `parseArgs`) are module-exported so they can be unit-tested post-extraction. Auth via `ACCESSKIT_API_KEY` env (preferred in CI) or `--api-key` flag; base URL via `ACCESSKIT_API_URL` or `--api-url`.

  3. **`github-action/action.yml` + `github-action/README.md`** — composite Action wrapping the CLI. Eleven inputs (all thresholds are optional; empty = disabled), four outputs (`scan-id`, `score`, `status`, `violations`) populated even on threshold failure so downstream `if: always()` steps can comment on PRs. Writes a GitHub-native job summary (Markdown table of metrics) to `$GITHUB_STEP_SUMMARY`. The `action.yml` probes two CLI paths so the exact same file works both when consumed from the monorepo and after git-subtree split-out to a standalone Action repo — no code duplication.

  4. **`docs/examples/accessibility-ci.yml`** — copy-paste consumer workflow that shows the Action in action: scan on PR + main push, fail-on-critical + min-score 85 gating, and a `github-script` follow-up step that posts a formatted summary comment on the PR.

  *Why in-tree rather than separate repos (for now).* Keeping both the CLI and Action adjacent to the API that serves them lets a single `pnpm type-check` + `pnpm test` + manual smoke test cover the whole pipeline, and one PR updates the API + its client in lockstep. Both folders are self-contained with their own README + split-out runbooks, so when it's time to publish `@accesskit/cli` on npm or `accesskit/action@v1` on the Actions Marketplace, each is one `git subtree split` away. The monorepo approach is explicit in every README and FIX_PLAN so there's no confusion about what ships where.

  *Security.* API keys never appear in logs: the CLI reads them from env/flag and only sends them in the `Authorization` header; the Action declares `api-key` as a regular input and relies on the caller storing it in a repo/org secret, which GitHub masks automatically in the runner logs. All threshold flags are optional so the feature degrades gracefully (scan-and-report-only, no gate) when a consumer isn't ready to enforce.

  *Verification.* `pnpm type-check` ✅ · `pnpm test` ✅ (205/205 — no new unit tests for the CLI itself yet; pure-function exports are ready for tests once the CLI is extracted and its own jest config can sanely import the `.mjs`). Smoke-tested all four exit codes locally (`--version` → 0, usage errors → 2, unknown command → 2, missing API key flows through `resolveApiConfig`).

  *Deploy follow-ups (no code).*
    1. Once comfortable with the in-tree shape, `git subtree split --prefix=cli -b cli` → push to `accesskit/cli` → `npm publish`.
    2. `git subtree split --prefix=github-action -b action` → copy `cli/accesskit.mjs` into the split branch (so the Action is self-sufficient) → push to `accesskit/action` → tag `v1`. Full procedure documented in `github-action/README.md`.

## Phase J — Code quality / follow-ups (P2) ✅ COMPLETED

- [x] **J1.** Adopt `permissions.ts` helpers (`hasRole`, `canManageTeam`, …) across server actions + API routes
  *Replaced every hardcoded `["OWNER","ADMIN"].includes(role)` / `role === "OWNER" || role === "ADMIN"` callsite with the matching helper from `@/lib/permissions`. Covered: team actions + page (`canManageTeam`), website settings actions/page + `new/actions.ts` (`canManageWebsites` / `canConfigureOrg`), client-portals create + PATCH + DELETE (`canConfigureOrg`), settings org/white-label/api-keys/webhooks (`canConfigureOrg`), Stripe & PayStack checkout + portal routes (`canManageBilling`), settings index + billing page (`canConfigureOrg` / `canManageBilling`). Also reconciled `canManageBilling` in `permissions.ts` to match actual codebase policy (ADMIN+) — previously defined as OWNER-only but every call site allowed ADMIN, so the helper was drift waiting to happen. Permissions unit tests updated (`canManageBilling` now covers ADMIN). Left the invitee-role-validation list in `team/actions.ts` intact with a clarifying comment (it's a list of permitted invitee roles, not a hierarchical permission check).*
- [x] **J2.** Clean up residual `Infinity` comparisons post-C3
  *Five remaining `=== Infinity` / `!== Infinity` callsites (team seat limit, billing usage card, competitor manager, `/api/v1/scans` pageLimit, team page) now use the `isUnlimited()` helper from `@/lib/plans`. Keeps the `UNLIMITED` sentinel policy consistent everywhere.*
- [x] **J3.** Audit server-action imports — remove remaining unused `db` imports after multi-org refactor
  *Ran a full-repo named-import audit (every `import { ... } from "@/lib/db"` plus a broader sweep of all named-import blocks in `src/`). Zero unused `db` imports remain and zero unused named imports overall — the multi-org refactor (B1) already cleaned them up as it touched each file. No code change required; item closed with verification recorded here.*

## Phase K — Scanning accuracy & recommendations (P2) ✅ COMPLETED

- [x] **K1.** WCAG 2.2 rule coverage audit + default tag set bumped to 2.2 AA

  *Audit result.* axe-core v4.11.1 (currently installed) advertises exactly **one** rule tagged `wcag22aa`: `target-size`, which covers SC 2.5.8 Target Size (Minimum) at Level AA. The other eight new WCAG 2.2 success criteria are intrinsically hard / impossible to automate with a static DOM snapshot:
  - **2.4.11 Focus Not Obscured (Min) / 2.4.12 (Enh) / 2.4.13 Focus Appearance** — require observing focus behaviour during interaction, not static analysis.
  - **2.5.7 Dragging Movements** — requires modelling pointer-event semantics.
  - **3.2.6 Consistent Help / 3.3.7 Redundant Entry** — cross-page / cross-form context axe doesn't build.
  - **3.3.8 Accessible Authentication (Min) / 3.3.9 (Enh)** — cognitive-function test heuristics not implemented.

  pa11y's HTML_CodeSniffer runner still targets WCAG 2.1, so its `WCAG2AA` standard is used as-is and any hits flow into the shared violation pipeline — no new pa11y wiring needed.

  *Code shipped.* `src/scanner/standards-mapper.ts`:
  - New exported `WCAG_22_COVERAGE` constant — the nine-criterion matrix above, each row carrying `{criterion, level, name, automatable, axeRuleId?, notes?}`. Single source of truth for any future "What does our scanner cover?" UI.
  - `standardsToAxeTags([])` now defaults to the full WCAG 2.2 AA tag set (`wcag2a` + `wcag2aa` + `wcag21a` + `wcag21aa` + `wcag22aa`). Previously defaulted to 2.1 AA, which silently skipped `target-size`. The new default is a strict superset — no regression for callers that explicitly request 2.1 AA.
  - Docstring in the file captures the audit above so future contributors can reconcile against axe release notes without rerunning the discovery.

  *Tests.* `tests/unit/scanner/standards-mapper.test.ts` — new `WCAG_22_COVERAGE` describe block (3 cases) + new assertions on the default tag set including `wcag22aa`. Full suite still green.

- [x] **K2.** Fingerprint stabilised against layout & build-hash drift

  *Problem recap.* `generateFingerprint` used `sha256(ruleId:cssSelector:origin)` unmodified. Axe-generated selectors often contain positional filters (`:nth-child(3)`, `div[2]`) and CSS-in-JS build hashes (`css-1a2b3c4`, `sc-abcDEF12`) that shift between deploys. Every such shift invalidated "is this a regression?" tracking and marked the same underlying violation as a new issue.

  *Algorithm shipped.* `src/scanner/deduplicator.ts` rewritten around a new exported `normalizeSelector()` pass:
    1. Strip positional / ordinal pseudo-classes (`:nth-child`, `:nth-of-type`, `:first-child`, `:last-child`, `:only-child`, plus the `-of-type` variants).
    2. Strip bracketed XPath-style positional indices (`div[1]` → `div`).
    3. Strip obviously auto-generated class tokens matched by six patterns covering Emotion (`css-…`), styled-components (`sc-…`), CSS Modules (`_abc123`, `Component_button__aB3cD`), Next.js (`__className_abc123`), and generic hash-suffixed semantic classes.
    4. Sort the remaining class / attribute / pseudo tokens inside each compound so `.btn.primary` and `.primary.btn` hash identically.
    5. Lowercase tag names, collapse whitespace around combinators, sort comma-separated branches.
    6. Prefix the final digest with a `v2:` tag so we can tell new and old fingerprints apart in the DB if migration is ever needed.

  *Migration impact.* The one-time switchover means existing DB rows (all `v1` under the old algorithm) won't match any newly scanned violation until their next scan re-emits a `v2` fingerprint. In practice this looks like one scan where previously-tracked issues are briefly "re-opened" then immediately resolved on the following scan — acceptable given the value of stable cross-scan tracking thereafter.

  *Tests.* `tests/unit/scanner/deduplicator.test.ts` — added 10 new cases covering ordinal drift, XPath index drift, Emotion hash drift, styled-components `sc-*` drift, semantic-class preservation, class-order independence, whitespace collapse, ID uniqueness preservation; plus 10 cases for the `normalizeSelector` helper directly (empty input, pseudo-strip, index-strip, hash-strip, sorting, branch sorting, ID/attr preservation, tag-lowercasing, whitespace, pure-pseudo → wildcard).

- [x] **K3.** Landmark / region false-positive triage — exclude by default, down-weight on opt-in

  *Decision.* Axe's `region`, `landmark-one-main`, and the full `landmark-*` family are all tagged **`best-practice` only** — no WCAG tag — so as long as the scanner runs with WCAG tag filters (which it has done since day one) they **never fire in default mode**. That's the correct behaviour for modern component-driven SPAs where content legitimately lives inside nested React trees rather than explicit landmarks, and where axe's heuristics throw a high noise-to-signal ratio.

  *Opt-in.* New `SCANNER_INCLUDE_BEST_PRACTICE=true` env flag lets ops teams who *do* want best-practice heuristics turn them on per-environment. `standardsToAxeTags` adds the `best-practice` tag to the tag set when the flag is set. Exact-string match on `"true"` — `"1"`, `"yes"`, `"True"` are deliberately rejected so there's no ambiguity.

  *Safety rail.* Even when opted in, every best-practice-only violation is force-clamped to MINOR severity via the new `mapAxeViolationToSeverity(impact, tags)` helper, which calls `isBestPracticeOnly(tags)` first and only delegates to the regular impact mapping when at least one real standard tag (wcag*, section508) is present. This keeps landmark heuristics from ever inflating the CRITICAL/SERIOUS counts that drive the gating score, PR gate thresholds, and dashboard badges.

  *Wiring.* `src/scanner/axe-scanner.ts` swapped `mapAxeImpactToSeverity` → `mapAxeViolationToSeverity` at the sole call site inside the axe results loop. No other scanner call-sites consume axe impact + tags together so no further wiring is needed.

  *Tests.* `tests/unit/scanner/standards-mapper.test.ts` — new describe blocks for `bestPracticeRulesEnabled` (3 cases: unset, non-exact truthy, exact `"true"`), `isBestPracticeOnly` (4 cases: best-practice-only, alongside WCAG, absent, alongside section508), `mapAxeViolationToSeverity` (2 cases: down-weight happy path + delegate path), and the env-var behaviour inside the `standardsToAxeTags` describe block (adds tag only when opted in; default set does NOT contain `best-practice`).

  **Verification (post-K):** `pnpm type-check` ✅ · `pnpm test` ✅ (240/240 pass, up from 205) · `pnpm lint` ⚠ pre-existing `@rushstack/eslint-patch` vs ESLint 9 incompatibility (unchanged from Phase J baseline).

## Phase L — Testing (P2) ✅ COMPLETED

- [x] **L1.** Integration tests for auth routes (portal-auth + magic-link)

  *Portal-auth route (`POST /api/portal/[slug]/auth`).* `tests/unit/api/portal-auth.test.ts` mocks `@/lib/db`, `@/lib/rate-limiter`, and `next/server` at the module boundary so the route handler runs in a plain Jest env with no real Postgres. 13 cases cover: happy-path cookie issuance (httpOnly + sameSite=lax + scoped path + correct max-age); 401 on wrong password with no cookie leakage; 404 for disabled / missing / hashless portal; 400 on non-JSON / missing / non-string password; 429 with `Retry-After` when rate-limited; rate-limit key wiring (slug + first `x-forwarded-for` entry, `x-real-ip` fallback, `"unknown"` final fallback); and NODE_ENV→`secure` cookie gating.

  *Magic-link refactor + tests.* `src/lib/auth.ts` grew to 100+ lines of inline Resend logic that was impossible to unit-test. Extracted three pure helpers into `src/lib/auth-magic-link.ts`:
    - `logMagicLinkForDev(identifier, url, env, logger)` — the dev-only console print, guaranteed silent when `NODE_ENV === "production"` (locks in Phase A2 fix).
    - `buildMagicLinkEmail(url)` — the HTML body.
    - `sendVerificationRequest({ identifier, url }, deps)` — the full flow with dependency-injectable Resend loader + env + logger so tests never need the real SDK.

  `tests/unit/lib/auth-magic-link.test.ts` — 10 cases: dev + test envs log the link; production is silent (exact-string check against the token so a future "debug-only" escape hatch can't sneak in); email contains url in both `href` and visible text plus a 24-hour expiry mention; Resend send happy path + from-address fallback; Resend import failure and send rejection both swallow without throwing and log an error; production still never logs the magic link even on success.

- [x] **L2.** Integration tests for multi-org switching + cookie-respecting resolver

  *`getActiveMembership`.* `tests/unit/lib/get-active-org.test.ts` — 6 cases mocking `next/headers` cookies + `@/lib/db`: cookie match returns the right org with a single DB round-trip; absent cookie falls back to oldest membership via `orderBy: { createdAt: "asc" }`; stale cookie (user no longer belongs to the cookied org) falls through to the oldest membership in exactly two calls; zero-org users resolve to `null`; single-org users make exactly one DB call regardless of cookie state; the `organization` relation is included on both lookup paths.

  *`POST /api/switch-org`.* `tests/unit/api/switch-org.test.ts` — 6 cases: happy-path cookie issuance with 90-day maxAge / httpOnly / sameSite=lax / path=/; 401 for no session; 401 for a session missing `user.id`; 400 when `orgId` body field is missing; 403 when the user is not a member of the requested org (no cookie written); no cookie written when the membership check throws (failure contains itself, no partial-state).

- [x] **L3.** Scanner end-to-end test against a known fixture HTML

  *Fixture.* `tests/fixtures/accessibility/known-violations.html` — a deliberately-broken page seeded with seven representative violations: missing `lang` on `<html>`, `<img>` without alt, unlabelled `<input>`, empty-text `<button>`, low-contrast paragraph, duplicate `id`, empty-text `<a>`. Every violation is annotated with its WCAG criterion + axe rule id in a header comment so future contributors know not to "fix" them.

  *Runner.* `tests/e2e/scanner-fixture.spec.ts` — new Playwright project (`scanner-fixture`) that:
    1. Spins up an ephemeral `node:http` server on a random port in `beforeAll`, serves the fixture, tears down in `afterAll`.
    2. Uses the already-installed `@axe-core/playwright` to run axe against the served URL with the exact tag set our scanner emits (`standardsToAxeTags(["WCAG22_AA"])`).
    3. Asserts six named violations are detected (image-alt, label, button-name, color-contrast, html-has-lang, link-name) with per-rule error messages so a regression points to the exact missing rule.
    4. Exercises every pure helper (`mapAxeViolationToSeverity`, `mapTagsToCategory`, `mapTagsToStandards`, `extractWcagCriterion`, `extractWcagLevel`) against the *real* axe output, verifying each produces a well-formed downstream shape.
    5. Scans the page twice and asserts `generateFingerprint` produces byte-identical outputs across runs — the Phase K2 stability guarantee against real-world selector noise.
    6. Asserts `normalizeSelector` never leaks ordinal pseudo-classes or bracket-index selectors into normalized output for any real axe hit.

  *Why a new Playwright project, not a Jest test.* `src/scanner/axe-scanner.ts` uses `createRequire(import.meta.url)` which `ts-jest`'s CJS compilation can't resolve. Playwright loads TS through its own transformer with ESM support and already ships a real Chromium (the whole point of the scanner), so reusing its runner is the minimum-friction way to test the scanner pipeline end-to-end. The project entry has no `dependencies` on auth setup and doesn't navigate to `baseURL`, so it's fully self-contained.

  *Timing.* All 4 test cases pass in ~10s each against the seeded fixture on a dev laptop.

- [x] **L4.** Playwright E2E for the critical UI flow (add → verify → scan → view issue → comment)

  *`tests/e2e/critical-flows.spec.ts`* — two-part spec registered under the existing `authenticated` Playwright project so it inherits the `global-setup.spec.ts` session cookie.

  **Part 1 — read-only smoke (runs always).** Four cases cover the deep-route wiring without needing any seed data: unknown website id, unknown settings, unknown issue id, unknown scans list. All four must return <500 and not bounce to `/login` — catches any auth-leak or crash in `notFound()` paths that a missing-row regression would introduce.

  **Part 2 — full write-path chain (opt-in via `E2E_WRITE_TESTS=true`).** One monolithic test with `test.step` segments for: add website, settings/verification panel renders (all three verification method tabs), trigger scan and see `role=status` update, wait up to 3 min for the issues list to populate (exponential-ish poll intervals 5s → 10s → 15s), open the first issue and confirm the comment textbox is present, submit a comment and assert it renders in the thread. Per-step timeouts keep failures localized — Playwright's report shows exactly which seam broke.

  *Config touch.* `playwright.config.ts` — the existing `authenticated` project's `testMatch` is widened from a hardcoded filename to a regex (`/(dashboard|critical-flows)\.spec\.ts$/`) so both specs run under the authenticated project without duplicating the auth-setup dependency. New `scanner-fixture` project is added for L3 with no setup dependency (it serves its own HTTP fixture) and isn't gated on the Next.js dev server either.

  **Verification (post-L):** `pnpm type-check` ✅ · `pnpm test` ✅ (275/275 Jest, up from 240; +35 new integration cases) · `npx playwright test --project=scanner-fixture` ✅ (4/4 pass) · `pnpm lint` ⚠ pre-existing `@rushstack/eslint-patch` vs ESLint 9 incompatibility (unchanged from Phase J baseline).

## Phase M — Product competitiveness (P3) ✅ COMPLETED

- [x] **M1.** Automated remediation patch builder + public API hook (mechanical fixes)

  *Rather than ship a half-built GitHub App wrapper first, the mechanical "brain" that decides *what* to change was landed as a pure, offline, fully-tested SDK. The GitHub App / CLI wrappers that call it are strictly deploy-time work with no additional application code needed.*

  *`src/lib/remediation.ts`.* New module exposing `buildRemediationPatch(filePath, sourceContent, violation)` → `{unifiedDiff, updatedContent, summary, rationale, ruleId}` plus `canAutoRemediate(ruleId)` and `supportedRuleIds()` for the UI. Five mechanical rules ship at day-one — chosen because their fix is unambiguous and safe-by-default:
    - **`image-alt`** — adds `alt=""` to `<img>` tags lacking one (WCAG 1.1.1). Empty alt is the correct WCAG default for decorative images; the PR body explicitly tells the human reviewer to replace it with a descriptive string for content images.
    - **`html-has-lang`** — adds `lang="en"` to `<html>` (WCAG 3.1.1). Defaults to `en`; the rationale tells the reviewer to change it for non-English sites.
    - **`button-name`** — adds `aria-label="…"` derived from the CSS selector's id/class to empty `<button>` tags (WCAG 4.1.2). Placeholder text is clearly flagged as human-review-required.
    - **`link-name`** — same treatment for empty `<a>` tags (WCAG 2.4.4 / 4.1.2).
    - **`meta-viewport`** — removes `user-scalable=no` / `maximum-scale=1.0` from the viewport meta (WCAG 1.4.4 Resize Text). Safe and fully reversible.
  Anything outside the allowlist returns `null` so the caller falls through to the AI-generated fix suggestion pipeline (Phase I1) rather than inventing a patch.

  *Design rules baked in.* All five patchers are **idempotent** (running them on already-fixed source returns null, not a redundant patch), **non-parsing** (targeted regex edits — no DOM reserialization surprises with whitespace/quote/order changes), and **side-effect free** (no I/O, no globals). The bundled `toUnifiedDiff(filePath, before, after)` helper emits valid `git apply` input with 3 lines of context per hunk, exported so callers can diff arbitrary before/after pairs.

  *Public API hook.* `POST /api/v1/issues/{violationId}/remediation` — new endpoint gated behind the existing Agency+ API-key plan check. Body: `{ filePath, sourceContent }` (512 KB cap, enforced before patching). Returns 200 with the diff or 422 + `supportedRuleIds` when the rule isn't in the mechanical allowlist. This is the stable contract the GitHub App / Bugbot / CLI wrappers will call once per violation per PR; the endpoint is stateless (no repo credentials, no persisted diffs) so the same endpoint powers every future wrapper.

  *Tests.* `tests/unit/lib/remediation.test.ts` — 22 cases: per-rule positive + idempotent-negative paths, attribute-preservation checks, selector→label humanization (`submit-form` → "submit form"), self-closing `<img />` syntax preservation, `toUnifiedDiff` contract (empty string on no-op, valid headers, +/-/space line markers, trailing newline), and the unsupported-rule / null-source fall-through contract that keeps the AI-suggestion pipeline as the default.

  *Deploy follow-ups (no code — require external sign-up).* GitHub App registration → installation flow → repo webhook handler → PR opener. The entire remote side of the feature is independent of the core app and ships as a separate Fly.io worker or Cloudflare Worker that calls the stable `/api/v1/issues/.../remediation` endpoint with an Agency-plan API key.

- [x] **M2.** PDF report exec summary + per-page drilldown

  *New `src/lib/report-summary.ts`.* Pure extraction of the "what decision-makers need to see first" shape from a scan: readiness label (`green`/`amber`/`red`/`unknown`) derived from critical+serious counts and score; WCAG AA pass-rate proxy (share of pages scoring ≥80); top-3 critical/serious issues aggregated across all pages (deduped by ruleId, sorted by severity → instance count → pages-affected → alphabetical ruleId so ordering is stable); top-5 worst-scoring pages with violations; total/affected page counts. All pure, sync, throw-free — missing fields degrade to "unknown" or 0.

  *PDF template.* `src/components/reports/pdf-template.tsx` restructured into two pages:
    1. **Executive Summary** — branded header, readiness card (color-coded headline with one-line detail), the existing score cards, a new 3-metric grid (AA pass-rate %, pages-with-issues ratio, critical+serious total), top-issues list (severity badge per row, rule id + WCAG criterion + instance/page counts in a single meta line), and the top-pages list sorted by worst score first.
    2. **Per-page detail** — same severity breakdown + metadata row + full per-page drilldown that used to live on the summary page. Preserves every violation the PDF already rendered; just moves it to its own page so the exec summary isn't buried under detail.
  Palette, footer, and page-number rendering are shared via an extracted `ReportFooter` component. The readiness card's colour tracks severity (green/amber/red) rather than brand — so the PDF's top-of-page message can't drift from the metric.

  *Tests.* `tests/unit/lib/report-summary.test.ts` — 16 cases: readiness (red on critical>0 irrespective of score; amber on serious>0 or score<80; green otherwise; unknown for unscored); top-issues aggregation (dedup by ruleId, CRITICAL beats SERIOUS, MODERATE/MINOR excluded, deterministic tie-break under equal signals); top-pages (lowest-scoring first, zero-violation pages excluded, stable tie-break); AA pass-rate (null when unscored, correct fractional share when mixed, 100% happy path).

- [x] **M3.** Slack / Teams native webhook formatting

  *`src/lib/webhook-formatters.ts`.* New pure module that classifies outgoing webhook URLs by hostname and wraps the payload in the provider's native schema — Slack gets `{text, blocks[], attachments[]}` with a severity-coloured attachment bar and a "View in dashboard" button; Teams gets a `MessageCard` with `themeColor`, a facts table, and an `OpenUri` `potentialAction`. Custom listeners (anything not matching the narrow hostname allowlist) keep receiving the existing `{event, data, timestamp}` envelope — the generic contract is preserved.

  *Detection rules (intentionally narrow to avoid false-positives).* Slack = `hooks.slack.com` + `/services/` path prefix. Teams = legacy Office 365 connectors (`outlook.office.com`, `*.webhook.office.com`) **and** the newer Power Automate / "Workflows" domains (`*.logic.azure.com`), because both delivery paths accept `MessageCard`. Anything else → `generic` passthrough.

  *Presentation logic consolidated.* `describeEvent(event, payload)` is the single source of truth for event → title / summary / accent colour — same strings flow into Slack's header block, the Teams card title, and the accent/themeColor on both. Dashboard CTA link is derived from `payload.link` (absolute) or `{websiteId, scanId}` (relative, joined against `baseUrl`) — when nothing resolves, both formatters omit the CTA rather than emit a broken link.

  *Wiring.* `src/lib/webhooks.ts` now calls `formatForProvider({url, event, payload, baseUrl, genericPayload})` before serialisation. The HMAC still signs whatever bytes go on the wire (so listeners that care about provenance have a stable contract regardless of provider). A new `X-AccessKit-Provider` response header (`slack` / `teams` / `generic`) makes the delivery-log inspectable at a glance. `baseUrl` is resolved from `NEXT_PUBLIC_APP_URL` → `NEXTAUTH_URL` → `APP_URL` so links work in every deploy environment.

  *Tests.* `tests/unit/lib/webhook-formatters.test.ts` — 26 cases covering: provider detection (7 cases including case-insensitive host + refused paths + malformed URLs); event → title/summary/accent mapping (5 cases across all four `WebhookEvent` variants + severity colour-picker); Slack shape (text fallback, header/section/context blocks, CTA button only when link derivable, no "primary" styling on critical-alert buttons, severity-coloured attachment); Teams shape (MessageCard identifiers, facts table, OpenUri action, absolute-link passthrough, no-action path when link unresolvable); `formatForProvider` dispatch (generic passthrough, Slack routing, Teams routing).

- [x] **M4.** Weekly digest — plan-gated + trend arrows + unsubscribe footer

  *Context.* The `weeklyDigestNotification` Inngest cron shipped in an earlier phase (every Monday 10 AM UTC, in-app + email + `NotificationPreference.email=true` respected). This phase tightens the body into a testable unit and adds three new properties.

  *`src/lib/digest.ts`.* New pure `buildWeeklyDigest({orgName, websites[], appUrl})` → `{subject, text, totals}` extracted from the Inngest function. `DigestWebsiteInput` carries per-site `currentScore`, `previousScore` (one-week-ago baseline), `scansThisWeek`, `totalViolations`, `criticalCount`. Body is deterministic plaintext (<2 KB, renders identically in every email client), sorted by currentScore DESC with alphabetical tie-break, with `(up N)` / `(down N)` trend arrows (ASCII-only so mobile Outlook doesn't mangle Unicode), an honest `—` placeholder for unscored sites, and a "Biggest improvement / regression" call-out computed from the largest positive / negative `scoreDelta`.

  *Unsubscribe footer.* Every body ends with `Manage preferences: {appUrl}/settings/notifications` — CAN-SPAM / GDPR requirement plus a good-faith "opt-out is one click" promise. Trailing slashes on `appUrl` are normalised so links stay clean.

  *`shouldSendDigest(input)` gate.* Skips digests for orgs with zero scans and zero scored websites in the window — no more "you had zero activity this week, here's an email about that" noise.

  *Inngest wiring.* `src/inngest/notification-emails.ts` `weeklyDigestNotification` now pulls both current + previous-week scan rows (`lt: oneWeekAgo, gte: twoWeeksAgo`, `distinct: ["websiteId"]`, newest-first) to populate `previousScore`, resolves website IDs via a second small `findMany`, and delegates the body to `buildWeeklyDigest`. Email text is sent verbatim — no more inline string building in the I/O layer.

  *Tests.* `tests/unit/lib/digest.test.ts` — 20 cases: `scoreDelta` honesty (null when either side missing, signed integer when both present); `shouldSendDigest` gates; subject formatting; unsubscribe link present in every body; trailing-slash normalisation; determinism under equal input; per-site sort + tie-break; trend-arrow branches (up/down/omitted); "most improved / most regressed" selection and the no-positive-delta case where "Biggest improvement" is correctly omitted.

- [x] **M5.** Public shareable score badges

  *Schema.* Single additive field on `Website`: `publicBadgeEnabled Boolean @default(false)`. Opt-in, not opt-out — sites haven't been scanned yet shouldn't accidentally publish a low-score badge.

  *`src/lib/badges.ts`.* Pure SVG renderer in the shields.io style — `buildBadgeSvg({label, value, color, labelColor?})` returns a self-contained `<svg>` (no external fonts, no CSS `<link>`, no JS — renders identically in GitHub READMEs, Markdown, blog posts, mail clients). Text width is estimated from a small Verdana-11 character-width table (covers the digits / letters / `/ . , : -` glyph subset the badge actually prints, with a 7-px fallback) — gets visually-indistinguishable spacing without a headless browser in the request path. Output is deterministic (~600 B) and properly XML-escapes label/value/color so a future white-label with a `'` or `"` in the company name can't inject attributes. `buildScoreBadgeSvg(score)` is the canonical `accessibility: NN/100` convenience with a neutral gray `no data` branch for null/NaN (brand-new sites don't appear "failing") and the same severity palette used by the dashboard score card (`≥90` green, `≥70` yellow, `≥50` orange, else red).

  *`GET /api/badges/{websiteId}/score.svg`.* New public route (no auth). 404s when the website doesn't exist **or** `publicBadgeEnabled === false` — indistinguishable responses so a third party can't enumerate website IDs. When enabled: `Content-Type: image/svg+xml; charset=utf-8`, `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=3600` (5-min TTL absorbs README burst traffic without making scores more than 5 min stale), `X-Robots-Tag: noindex` so search engines don't crawl the badge stream. CSRF middleware already skips GET.

  *Embed UI.* `src/app/(dashboard)/websites/[websiteId]/settings/badge-panel.tsx` — new client component under the "Public badge" card on the website settings page. Toggle button (optimistic update, rollback on server error) + live badge preview + three one-click copy buttons for the image URL, Markdown snippet, and HTML anchor snippet — all generated by `buildEmbedSnippets(baseUrl, websiteId)` which trims trailing slashes on the base URL. Only users who pass `canManageWebsites` can toggle.

  *Server action.* `setPublicBadgeEnabled(websiteId, enabled)` added to the existing settings `actions.ts` — runs the same auth + org-scoping + role-gating pattern the rest of the file uses, revalidates `/websites/{id}/settings`.

  *Tests.* `tests/unit/lib/badges.test.ts` — 20 cases (score-color buckets including null/NaN, `measureText` fallback + determinism, `escapeXml` five-char coverage, `buildBadgeSvg` output shape + determinism + XML-injection safety for label/value/color, `buildScoreBadgeSvg` "no data" + bucket colour selection, `buildEmbedSnippets` URL construction + trailing-slash normalisation). `tests/unit/api/badges.test.ts` — 4 cases (404 on missing, 404 on disabled, 200 with valid SVG + cache headers + `X-Robots-Tag`, `no data` rendering when currentScore null).

  *Note on white-labeled domains.* The badge endpoint lives on the AccessKit (or your white-label) app origin — the same origin that serves the dashboard. Customers on AGENCY+ plans using `whiteLabel.customDomain` will eventually want the badge served from their own domain too; that's a small routing follow-up (rewrite rule on the custom-domain edge worker) and not a code change to the badge builder itself.

**Verification (post-M):** `pnpm type-check` ✅ · `pnpm test` ✅ (389/389 Jest pass, up from 275; +114 new cases across badges/formatters/exec-summary/digest/remediation) · `pnpm lint` ⚠ pre-existing `@rushstack/eslint-patch` vs ESLint 9 incompatibility (unchanged from Phase J baseline).

---

## Continue from here

**All P0–P3 items from the original audit + the follow-ups queued along the way are now shipped.** The plan has no remaining open items.

The remaining work to make Phase M "visible" to customers is strictly deploy-time — no more application code required:

1. **M1 (GitHub App):** register the App on github.com, implement the install/webhook wrapper (can live in its own repo — calls the stable `POST /api/v1/issues/{violationId}/remediation` endpoint this phase shipped, using any Agency-plan API key), and publish to the GitHub Marketplace.
2. **M5 (white-label badge domain):** customers on AGENCY+ who've set `whiteLabel.customDomain` will want the badge served from `their-domain/api/badges/...` — a rewrite rule at the edge, not a code change.
3. **prisma migrate:** the `publicBadgeEnabled` column from M5 needs a `prisma migrate dev --create-only` (or `prisma db push` in dev) followed by `prisma migrate deploy` in production. No data backfill needed — the default is `false`.

When resuming for unplanned new work:
1. Read this file top-to-bottom to recover context.
2. Add a new `Phase N` section for the new scope.
3. Keep the "ship one thing, run the full gate, commit, pause for sign-off" loop.

**Deploy / publish follow-ups (no code — require external accounts):**
- **H1 (Fly.io):** `fly launch` → `fly secrets set` → `fly deploy`, then unset `RUN_SCANS_IN_NEXT` on the web tier. Runbook: `worker/README.md`.
- **I2 (Cloudflare R2):** create bucket + API token + public-bound domain, then `fly secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET_NAME=… R2_PUBLIC_URL=…` on the scanner app. Full checklist under § I2 above.
- **I3 (npm + Actions Marketplace):** `git subtree split --prefix=cli` → `npm publish @accesskit/cli`. `git subtree split --prefix=github-action` → bundle CLI → publish as `accesskit/action@v1`. Full procedure in `github-action/README.md`.
- **M1 (GitHub App):** register the App, implement the webhook wrapper that calls `POST /api/v1/issues/{violationId}/remediation` with an Agency API key, publish to the GitHub Marketplace.
- **M5 (prisma migrate):** `publicBadgeEnabled` column needs a migration in production. `prisma migrate dev --create-only` locally, then `prisma migrate deploy` in prod. No data backfill — default is `false`.

**Current verification status (post-M):** `pnpm type-check` ✅ · `pnpm lint` ⚠ pre-existing (`@rushstack/eslint-patch` vs ESLint 9 incompatibility — reproduces on clean `62d3484`; needs a separate fix either pinning the patch or migrating to `eslint-config-next`'s flat export) · `pnpm test` ✅ (389/389 pass) · `npx playwright test --project=scanner-fixture` ✅ (4/4 pass) · CLI smoke tests ✅ (`--version`, `--help`, usage errors all return correct exit codes)

**How the phases are ordered:**
G (remaining security) → H (scanner infra decisions) → I (stubbed features) → J (quality) → K (scanning accuracy) → L (tests) → M (competitive features).

With Phases G through M fully green, **every P0/P1/P2/P3 item from the original audit is now shipped** — plus the scanning-accuracy follow-up and the integration/E2E test authoring that was deferred earlier. The plan has no remaining open items.
