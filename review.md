# AccessKit — Comprehensive Code Review

**Reviewed:** 22 March 2026
**Scope:** Full codebase audit — architecture, security, code quality, WCAG, GDPR, testing, performance
**Build status:** Clean (`npm run build` — 30 routes, 0 errors)
**Unit tests:** 103/103 passing across 7 suites

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Structure](#2-architecture--structure)
3. [Security](#3-security)
4. [Code Quality & Bugs](#4-code-quality--bugs)
5. [WCAG Accessibility Compliance](#5-wcag-accessibility-compliance)
6. [GDPR Compliance](#6-gdpr-compliance)
7. [Testing](#7-testing)
8. [Performance](#8-performance)
9. [Missing / Incomplete Features](#9-missing--incomplete-features)
10. [Remedial Action Summary](#10-remedial-action-summary)

---

## 1. Executive Summary

AccessKit is a well-structured Next.js 15 SaaS application with solid foundations. The core scanning pipeline (crawl → axe-core → score → persist) works end-to-end, the Prisma schema is comprehensive, and WCAG/GDPR compliance is materially addressed. Security headers, SSRF protection, rate limiting, and auth middleware are all in place.

The main areas requiring attention before production launch are:

- **Security:** DNS rebinding gap in SSRF guard, missing response size limits on verification fetches, crawler not SSRF-guarded
- **Code quality:** Inconsistent multi-org membership lookups (will cause bugs), overly permissive deletion roles, dead nav links
- **Completions:** Stripe billing, team invites, org switching, API keys, client portals, and reports are stub-only
- **Performance:** Sequential page scanning, N+1 queries in scan persistence

**Overall assessment:** Solid for an early-stage product. The security and multi-org bugs are the most urgent items.

---

## 2. Architecture & Structure

**Strengths:**
- Clean App Router layout with route groups `(auth)`, `(dashboard)`, `(marketing)`
- Prisma schema is well-normalised with 13 models, 11 enums, appropriate indexes and cascade deletes
- Scanner modules are pure-function where possible (scorer, deduplicator, standards-mapper, fix-generator) — easy to test
- Inngest for background job queue with step-based checkpointing and retry
- Server Actions for mutations (add website, trigger scan, delete website, update settings)
- Type definitions shared between scanner and DB layer via `src/types/scan.ts`

**Concerns:**
- The monolithic scanner runs inside Inngest serverless functions. Chromium + Playwright is memory-heavy; on serverless platforms (Vercel, AWS Lambda) this may exceed memory limits. The plan mentions a separate `SCANNER_WORKER_URL` but it's not wired up.
- No clear boundary between "which org am I acting as" — the codebase uses `findFirst` to pick a membership, which is non-deterministic for multi-org users.

---

## 3. Security

### 3.1 CRITICAL — DNS rebinding bypass in SSRF guard

**File:** `src/lib/ssrf-guard.ts`
**Issue:** The guard validates the hostname string against regex patterns (127.x, 10.x, etc.) but does not resolve the hostname to check if it points to a private IP. An attacker can register a domain (e.g. `evil.attacker.com`) that resolves to `127.0.0.1` or `169.254.169.254` and bypass all checks.

**Remediation:** After parsing the URL, perform a DNS lookup (`dns.promises.resolve4()`) and check the resolved IPs against the same blocklist before allowing the request. Alternatively, use a library like `ssrf-req-filter` that hooks into the HTTP agent.

### 3.2 HIGH — Crawler does not SSRF-check discovered URLs

**File:** `src/scanner/crawler.ts`
**Issue:** The crawler fetches URLs from sitemaps (line 58) and page links (line 88) without running them through `assertSafeFetchUrl`. If a target site's sitemap references `http://169.254.169.254/latest/meta-data/`, the scanner will fetch it.

**Remediation:** Call `assertSafeFetchUrl(url)` in `normalizeUrl()` or before each `page.goto()` call in the scanning pipeline. Wrap in try/catch and skip blocked URLs.

### 3.3 HIGH — No response size limit on verification fetches

**File:** `src/app/api/internal/verify-website/route.ts`
**Issue:** The verification endpoint fetches the entire HTML body of a user-provided URL into memory (line 89: `await response.text()`). An attacker could point to a multi-gigabyte response and exhaust server memory.

**Remediation:** Use a streaming reader with a size cap (e.g. read only the first 512KB, then abort). The meta tag will be in the `<head>` which is at the top of the document.

### 3.4 MEDIUM — Account deletion does not invalidate JWT sessions

**File:** `src/app/api/account/route.ts`
**Issue:** After account deletion, existing JWT session tokens remain valid until their `exp` claim. The user (or anyone with a stolen token) can continue making authenticated requests to the API.

**Remediation:** Either switch to database-backed sessions (easier to invalidate), add a token blacklist (Redis-backed), or set a short JWT `maxAge` (e.g. 15 minutes) with refresh tokens.

### 3.5 MEDIUM — No Content-Security-Policy header

**File:** `next.config.ts`
**Issue:** Good security headers are in place (X-Frame-Options, HSTS, etc.) but there is no `Content-Security-Policy` header. This leaves the app open to XSS via injected scripts.

**Remediation:** Add a CSP header. Start with a report-only policy, then tighten. At minimum: `default-src 'self'; script-src 'self' 'unsafe-inline'` (Next.js requires inline for hydration; use nonces with `next/headers` for strict CSP).

### 3.6 LOW — Rate limiter resets on restart/deploy

**File:** `src/lib/rate-limiter.ts`
**Issue:** The in-memory Map is wiped on each server restart or serverless cold start. This is acknowledged in the code comments but needs addressing before production.

**Remediation:** Replace with Upstash Redis (`@upstash/ratelimit`) for a persistent, multi-instance rate limiter.

### 3.7 LOW — Unvalidated search params used in Prisma filter

**File:** `src/app/(dashboard)/websites/[websiteId]/issues/page.tsx:42-43`
**Issue:** `statusFilter` and `severityFilter` from URL search params are cast with `as never` and passed directly to Prisma `where` clauses. While Prisma prevents SQL injection, invalid enum values will cause a runtime error instead of a graceful 400.

**Remediation:** Validate against the Prisma enum values before passing to the query. Return a 400 or ignore invalid values.

---

## 4. Code Quality & Bugs

### 4.1 BUG — Inconsistent membership lookup for multi-org users

**Files:** Multiple — `dashboard/page.tsx`, `websites/page.tsx`, `issues/page.tsx`, `scan-status/route.ts`, `verify-website/route.ts`, etc.
**Issue:** Most pages use `db.membership.findFirst({ where: { userId } })` which returns an arbitrary membership for users who belong to multiple organizations. This means a user could see org A's data while expecting org B.

Only `websites/new/actions.ts` correctly uses the compound key `userId_organizationId` to select the specific org.

**Remediation:** Implement org context selection (e.g. via a cookie or URL segment) and always pass `organizationId` alongside `userId` when looking up memberships. The `findFirst` pattern should be replaced project-wide.

### 4.2 BUG — MEMBER role can delete websites

**File:** `src/app/(dashboard)/websites/[websiteId]/settings/actions.ts:78`
**Issue:** The `deleteWebsite` function allows any MEMBER to delete a website (`["OWNER", "ADMIN", "MEMBER"].includes(membership.role)`). Website deletion is a destructive action that should require ADMIN or OWNER.

**Remediation:** Change the role check to `["OWNER", "ADMIN"].includes(membership.role)` or use the existing `canManageWebsites()` permission helper (which allows MEMBER for non-destructive actions, but a separate `canDeleteWebsite` check would be better).

### 4.3 BUG — Sidebar "Reports" link leads to 404

**File:** `src/components/dashboard/sidebar.tsx:36-39`
**Issue:** The sidebar navigation includes a "Reports" link to `/reports`, but no page exists at that route. Users clicking it get a 404 page.

**Remediation:** Either create a stub `/reports` page with a "Coming soon" message, or remove the Reports nav item from the sidebar until the feature is built.

### 4.4 BUG — Org switcher onClick is a no-op

**File:** `src/components/dashboard/org-switcher.tsx:71`
**Issue:** The org switcher dropdown renders all organizations but the onClick handler just closes the dropdown with a `// TODO` comment. Users see the switcher but can't actually switch orgs.

**Remediation:** Implement org switching via a server action that sets a cookie (e.g. `currentOrgId`) or via a URL-based approach (e.g. `/org/[slug]/dashboard`).

### 4.5 WARN — Inngest retry may overwrite FAILED status

**File:** `src/inngest/scan-website.ts:27-41`
**Issue:** In the `run-scan` step, if the scan fails, the code updates the DB status to FAILED and then re-throws. Inngest will retry (up to 2 times), which re-runs from step 1 (`mark-running`), overwriting the FAILED status back to RUNNING. If the scan consistently fails, the final state will correctly be FAILED after exhausting retries, but intermediate states may flicker.

**Remediation:** In the `mark-running` step, check if the scan is already in a terminal state before overwriting. Or, move error handling out of the step and into the function-level `onFailure` callback.

### 4.6 WARN — `Infinity` in plan limits won't serialize to JSON

**File:** `src/lib/plans.ts:63-74`
**Issue:** `PLAN_LIMITS.ENTERPRISE` uses `Infinity` for several fields. `JSON.stringify(Infinity)` returns `null`, which could cause issues if plan limits are ever sent to the client or stored as JSON.

**Remediation:** Use a large number (e.g. `999_999`) instead of `Infinity`, or handle serialization explicitly with `isFinite()` checks.

### 4.7 INFO — Duplicate `getInitials` function

**Files:** `src/components/dashboard/user-menu.tsx:25-35`, `src/app/(dashboard)/team/page.tsx:11-14`
**Issue:** The same initials-extraction function is defined in two places.

**Remediation:** Extract to `src/lib/utils.ts`.

### 4.8 INFO — `as ScanEventData` type assertion in Inngest handler

**File:** `src/inngest/scan-website.ts:15`
**Issue:** `event.data` is cast with `as ScanEventData` which bypasses type checking. Inngest v4 supports typed event schemas which would make this safe at compile time.

**Remediation:** Define Inngest event types using the `schemas` option when creating the Inngest client.

---

## 5. WCAG Accessibility Compliance

### What's done well

| WCAG Criterion | Level | Status |
|---|---|---|
| 1.1.1 Non-text content | A | All icons have `aria-hidden="true"`, buttons have labels |
| 1.3.1 Info and relationships | A | Proper `<table>` markup with `scope="col"`, lists with `role="list"` |
| 2.1.1 Keyboard | A | Focus-visible styles on all interactive elements |
| 2.4.1 Bypass blocks | A | Skip-to-content link in dashboard layout |
| 2.4.2 Page titled | A | Every page has a `<title>` via metadata export |
| 2.4.6 Headings and labels | AA | Consistent heading hierarchy (h1 → h2 → h3) |
| 3.1.1 Language of page | A | `<html lang="en">` on root layout |
| 4.1.2 Name, role, value | A | ARIA roles on org-switcher, tabs, dropdowns |
| 4.1.3 Status messages | AA | `aria-live="polite"` on scan poller status region |

### Issues found

### 5.1 Cookie consent `role="dialog"` without modal behavior

**File:** `src/components/cookie-consent.tsx:38-39`
**Issue:** The consent banner uses `role="dialog" aria-modal="false"`. A `dialog` role is typically used for modal or non-modal dialogs that require user interaction before continuing. For a passive notification banner, `role="region"` with `aria-label="Cookie consent"` would be more appropriate.

**Remediation:** Change to `role="region"` or `role="complementary"`.

### 5.2 Chart accessibility

**File:** `src/components/dashboard/score-trend-chart.tsx`
**Issue:** The SVG chart has `aria-label` on the `ResponsiveContainer` but SVG content from recharts is not screen-reader friendly. Screen readers will either skip the chart or read SVG coordinates.

**Remediation:** Add a visually hidden text summary below the chart: e.g. "Score trend: started at 72, current score is 89, improving over 5 scans."

### 5.3 Missing focus management after verification

**File:** `src/app/(dashboard)/websites/[websiteId]/settings/verification-panel.tsx:63`
**Issue:** After successful verification, the page reloads via `window.location.reload()` after a 1.5s delay. The reload doesn't preserve focus position, and the delay creates a confusing experience for screen reader users who hear the success message but then lose context.

**Remediation:** Use `router.refresh()` (which preserves client state and scroll position) instead of `window.location.reload()`.

---

## 6. GDPR Compliance

### What's done well

| Requirement | Status |
|---|---|
| Art. 6 — Lawful basis | Documented in privacy policy (consent, contract, legitimate interest) |
| Art. 7 — Cookie consent | Cookie consent banner with opt-in analytics, PostHog gated behind consent |
| Art. 13 — Information provision | Privacy policy with data categories, purposes, legal bases, retention |
| Art. 15 — Right of access | `GET /api/account/export` returns JSON of user data |
| Art. 17 — Right to erasure | `DELETE /api/account` removes user and sole-owned orgs |
| Art. 20 — Data portability | Export endpoint returns structured JSON, downloadable |

### Issues found

### 6.1 Data export is incomplete

**File:** `src/app/api/account/export/route.ts`
**Issue:** The export includes user profile, memberships, and linked accounts but omits:
- Violation comments authored by the user (`IssueComment` model)
- Scan history the user triggered
- Issue assignments (`Violation.assignedToId`)

These constitute personal data under GDPR as they reveal the user's activities.

**Remediation:** Include `IssueComment` records where `userId` matches, and scans triggered by the user (if `triggeredBy` is tracked per-user; currently it's per-type only). At minimum, include comments.

### 6.2 No data retention schedule enforced

**Issue:** The privacy policy states data retention periods but no automated cleanup exists. Scan data, violation records, and page screenshots accumulate indefinitely.

**Remediation:** Implement a scheduled cleanup job (Inngest cron) that deletes scans older than the retention period specified in the privacy policy.

### 6.3 Consent stored only in localStorage

**File:** `src/components/cookie-consent.tsx`, `src/components/posthog-provider.tsx`
**Issue:** Cookie consent choice is stored in `localStorage` under `accesskit_cookie_consent`. This has limitations:
- Cleared when user clears browser data (consent is lost, banner reappears)
- Not shared across subdomains
- Not auditable server-side

**Remediation:** Also persist consent as a server-side record (a simple `consent` column on the User model, or a dedicated cookie with an expiry matching GDPR requirements — typically 6-12 months).

---

## 7. Testing

### Current coverage

| Category | Files | Tests | Status |
|---|---|---|---|
| Scanner pure functions | scorer, standards-mapper, deduplicator, fix-generator | 67 | Passing |
| Lib utilities | ssrf-guard, rate-limiter | 20 | Passing |
| API routes | health | 4 | Passing (mocked) |
| E2E — public pages | public.spec.ts | 12 scenarios | Written |
| E2E — authenticated | dashboard.spec.ts | 14 scenarios | Written |
| E2E — setup | global-setup.spec.ts | Auth state | Written |

**Total: 103 unit tests passing, 3 E2E spec files**

### Gaps

### 7.1 No tests for server actions

**Files:** `websites/new/actions.ts`, `websites/[websiteId]/actions.ts`, `websites/[websiteId]/settings/actions.ts`
**Impact:** The `addWebsite`, `triggerScan`, `updateWebsiteSettings`, and `deleteWebsite` actions contain business logic (SSRF validation, plan limit checks, dedup checks) that is untested.

**Remediation:** Write Jest tests that mock `@/lib/db` and `@/lib/auth` to test the action logic in isolation.

### 7.2 No tests for crawler or axe-scanner

**Files:** `src/scanner/crawler.ts`, `src/scanner/axe-scanner.ts`
**Impact:** The crawl → scan pipeline is the core product feature but has zero test coverage. The robots.txt parser, sitemap parser, URL normalizer, and axe-core integration are untested.

**Remediation:** Unit test `parseSitemapUrls`, `isAllowedByRobots`, and `normalizeUrl` (these are pure functions). Integration test the crawler with a local HTTP server fixture.

### 7.3 No tests for Inngest job pipeline

**File:** `src/inngest/scan-website.ts`
**Impact:** The multi-step job (mark running → scan → persist results) contains complex transaction logic that is untested.

**Remediation:** Use Inngest's `inngest/test` utilities to test the function with mocked steps.

### 7.4 No tests for permissions module

**File:** `src/lib/permissions.ts`
**Impact:** The role hierarchy is simple but critical. A typo could grant CLIENT_VIEWER admin access.

**Remediation:** Add a small test file verifying each permission function returns the expected boolean for each role.

---

## 8. Performance

### 8.1 Sequential page scanning

**File:** `src/scanner/index.ts:23-26`
**Issue:** Pages are scanned one at a time in a `for...of` loop. For a 50-page scan, this is 50 sequential Playwright page navigations + axe-core runs.

**Remediation:** Use `Promise.all` with a concurrency limiter (e.g. `p-limit`) to scan 3-5 pages in parallel. Each `scanPageWithAxe` already creates its own page context.

### 8.2 N+1 query in scan result persistence

**File:** `src/inngest/scan-website.ts:62-65`
**Issue:** For each violation, the code does a `findFirst` query to check if an existing violation with the same fingerprint exists. For a scan with 200 violations, this is 200 individual DB queries inside a transaction.

**Remediation:** Pre-fetch all existing violation fingerprints for the website in a single query before the loop:
```ts
const existing = await tx.violation.findMany({
  where: { websiteId },
  select: { fingerprint: true, firstDetectedAt: true, status: true, assignedToId: true },
  distinct: ['fingerprint'],
  orderBy: { firstDetectedAt: 'asc' },
});
const existingMap = new Map(existing.map(v => [v.fingerprint, v]));
```

### 8.3 Header queries DB on every page load

**File:** `src/components/dashboard/header.tsx:14-18`
**Issue:** The `Header` component (rendered in the dashboard layout) runs a Prisma query for all user memberships on every page navigation. Since it's in a layout, Next.js should deduplicate this across sibling pages in the same layout — but this still runs on every navigation.

**Remediation:** Fetch memberships once in the dashboard layout and pass them as props. The layout already fetches a single membership — extend it to fetch all and pass to both Header and child pages.

### 8.4 Missing database indexes

**Issue:** Some frequently queried columns lack indexes:
- `Violation.ruleId` — used in fix-generator lookups
- `Scan.status` — filtered frequently in scan-status checks and scheduled scans
- `Website.url` — checked for duplicates in addWebsite

**Remediation:** Add `@@index` directives in `schema.prisma` for these columns.

---

## 9. Missing / Incomplete Features

Based on the `ACCESSKIT_PLAN.md`, `STATUS.md`, and code audit:

| Feature | Status | Notes |
|---|---|---|
| Stripe billing & webhooks | Stub | Webhook directory empty, billing page is placeholder |
| Team invitations | Not started | Team page shows members but no invite flow |
| Organization switching | Stub | UI exists, onClick is a TODO comment |
| Pa11y scanner engine | Stub | Returns empty array, commented-out code |
| Screenshot capture / R2 upload | Stub | Returns null, TODO comment |
| API key management | Stub | Settings page exists, no CRUD logic |
| White-label settings | Stub | Settings page exists, no CRUD logic |
| Client portals | Stub | Nav link exists, page likely placeholder |
| Reports / VPAT generation | Missing | Sidebar link 404s, no page exists |
| AI fix suggestions (Claude) | Not started | Schema has `aiFixSuggestion` field, no API call |
| CI/CD trigger endpoint | Not started | `TriggerType.CI_CD` in enum, no API route |
| Competitor benchmarking | Not started | `isCompetitor` flag in schema, no UI |
| Notification system | Not started | Referenced in plan, not implemented |
| Data retention cleanup | Not started | No automated data deletion job |
| Multi-instance rate limiting | Not started | In-memory only, needs Redis |

---

## 10. Remedial Action Summary

### Priority 1 — Security (fix before production)

| # | Issue | Severity | File(s) | Action |
|---|---|---|---|---|
| S1 | DNS rebinding SSRF bypass | CRITICAL | `ssrf-guard.ts` | Add DNS resolution check before allowing fetch |
| S2 | Crawler not SSRF-guarded | HIGH | `crawler.ts` | Run all discovered URLs through `assertSafeFetchUrl` |
| S3 | No response size limit on verification fetch | HIGH | `verify-website/route.ts` | Cap response body to 512KB using streaming reader |
| S4 | Session not invalidated on account deletion | MEDIUM | `account/route.ts` | Add token blacklist or switch to DB sessions |
| S5 | Missing CSP header | MEDIUM | `next.config.ts` | Add `Content-Security-Policy` header |

### Priority 2 — Bugs (fix before beta)

| # | Issue | Severity | File(s) | Action |
|---|---|---|---|---|
| B1 | Multi-org membership `findFirst` is non-deterministic | HIGH | 10+ files | Implement org context and always pass `organizationId` |
| B2 | MEMBER can delete websites | MEDIUM | `settings/actions.ts` | Restrict to ADMIN/OWNER |
| B3 | "Reports" sidebar link 404s | LOW | `sidebar.tsx` | Remove link or create stub page |
| B4 | Org switcher is non-functional | LOW | `org-switcher.tsx` | Implement or remove until built |
| B5 | Inngest retry may overwrite FAILED status | LOW | `scan-website.ts` | Check for terminal state before marking RUNNING |

### Priority 3 — WCAG / GDPR compliance

| # | Issue | Severity | File(s) | Action |
|---|---|---|---|---|
| C1 | Cookie consent role should not be dialog | LOW | `cookie-consent.tsx` | Change to `role="region"` |
| C2 | Chart not screen-reader accessible | LOW | `score-trend-chart.tsx` | Add hidden text summary |
| C3 | GDPR data export incomplete | MEDIUM | `account/export/route.ts` | Include comments and assigned violations |
| C4 | No data retention enforcement | MEDIUM | — | Create Inngest cleanup cron job |
| C5 | Consent not persisted server-side | LOW | `cookie-consent.tsx` | Store consent in DB alongside localStorage |

### Priority 4 — Testing gaps

| # | Gap | Impact | Action |
|---|---|---|---|
| T1 | Server actions untested | HIGH | Unit test `addWebsite`, `triggerScan`, `deleteWebsite` |
| T2 | Crawler/scanner untested | HIGH | Test `parseSitemapUrls`, `isAllowedByRobots`, `normalizeUrl` |
| T3 | Inngest pipeline untested | MEDIUM | Use `inngest/test` for step-based testing |
| T4 | Permissions module untested | LOW | Test role hierarchy functions |

### Priority 5 — Performance

| # | Issue | Impact | Action |
|---|---|---|---|
| P1 | Sequential page scanning | HIGH | Parallelize with concurrency limiter |
| P2 | N+1 violation fingerprint lookups | MEDIUM | Pre-fetch all fingerprints in one query |
| P3 | Header DB query on every page | LOW | Move to layout-level fetch |
| P4 | Missing DB indexes | LOW | Add indexes on `Violation.ruleId`, `Scan.status`, `Website.url` |

---

*Review completed by automated code audit. All findings are based on static analysis of the source code as of commit `955e572`.*
