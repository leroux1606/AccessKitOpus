# Production Readiness Checklist

## 1. Dev bypasses — auto-succeed in dev, must work for real in production

**SSRF check skipped when adding websites**
`src/app/(dashboard)/websites/new/actions.ts:66`
The `assertSafeFetchUrl` call that blocks private IP ranges is skipped in `NODE_ENV === "development"`. In production this runs automatically — no code change needed, but don't copy `.env` dev values to production.

**Verification auto-approves in dev**
`src/app/api/internal/verify-website/route.ts:64`
In development, clicking "Verify ownership" immediately marks any website as verified without checking the meta tag, DNS, or file. In production the real checks run — no code change needed, but you must actually place one of the three verification tokens on your site before scanning.

**In-process scan fallback only runs in non-production**
`src/app/(dashboard)/websites/[websiteId]/actions.ts:126`
The `after()` block that runs scans directly inside Next.js if Inngest doesn't pick up the event is guarded by `NODE_ENV !== "production"`. In production scans only run via Inngest — which means **Inngest must be configured and the scanner worker must be running**, or scans silently never happen.

---

## 2. Infrastructure that must exist in production

**Inngest — mandatory**
Without it, no scans run in production (the in-process fallback is disabled). You need:
- An Inngest Cloud account
- `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` set on the Next.js deployment

**Dedicated scanner worker — mandatory**
The `scanWebsiteJob` (Playwright + Chromium) is intentionally excluded from the Next.js process in production (`src/app/api/inngest/route.ts`) because it needs ~1 GB RAM per concurrent scan and will OOM a serverless function. You need a long-running server (Fly.io machine, EC2, etc.) running the separate worker process that registers `scanWebsiteJob` with Inngest.

**Redis for rate limiting — recommended for multi-instance deployments**
The current rate limiter (`src/lib/rate-limiter.ts`) is in-memory. If you run multiple Next.js instances (e.g. Vercel with autoscaling), each has its own counter and rate limits are per-instance only. Replace with Upstash `@upstash/ratelimit` and add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

---

## 3. Environment variables that must be set in production

### Required (app breaks without these)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma DB connection (include `?pgbouncer=true` for pooler) |
| `DIRECT_URL` | Prisma direct connection (used for migrations) |
| `NEXTAUTH_URL` | Full app URL e.g. `https://app.accesskit.io` |
| `NEXTAUTH_SECRET` | Auth session signing key |
| `NEXT_PUBLIC_APP_URL` | Used in email links, badges, and webhooks |
| `INNGEST_EVENT_KEY` | Inngest event publishing |
| `INNGEST_SIGNING_KEY` | Inngest webhook signature verification |

### Required for payments (pick Stripe or Paystack)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | One required per plan × interval |
| `STRIPE_STARTER_ANNUAL_PRICE_ID` | |
| `STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID` | |
| `STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID` | |
| `STRIPE_AGENCY_MONTHLY_PRICE_ID` | |
| `STRIPE_AGENCY_ANNUAL_PRICE_ID` | |
| `STRIPE_AUDIT_PRICE_ID` | One-time audit product |
| — or — | |
| `PAYSTACK_SECRET_KEY` | Paystack billing |
| `PAYSTACK_STARTER_MONTHLY_PLAN_CODE` | One required per plan × interval |
| `PAYSTACK_STARTER_ANNUAL_PLAN_CODE` | |
| `PAYSTACK_PROFESSIONAL_MONTHLY_PLAN_CODE` | |
| `PAYSTACK_PROFESSIONAL_ANNUAL_PLAN_CODE` | |
| `PAYSTACK_AGENCY_MONTHLY_PLAN_CODE` | |
| `PAYSTACK_AGENCY_ANNUAL_PLAN_CODE` | |

### Required for emails

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Scan notifications, team invites, trial reminders |

### Optional — feature degrades silently if missing

| Variable | Feature lost |
|---|---|
| `ANTHROPIC_API_KEY` | AI fix suggestions |
| `R2_ACCOUNT_ID` | Screenshot storage per scanned page |
| `R2_ACCESS_KEY_ID` | |
| `R2_SECRET_ACCESS_KEY` | |
| `R2_BUCKET_NAME` | |
| `R2_PUBLIC_URL` | |
| `SCANNER_ENABLE_PA11Y=true` | pa11y secondary scanner (off by default) |
| `SCANNER_INCLUDE_BEST_PRACTICE=true` | axe best-practice rules (off by default) |

---

## 4. Incomplete features with a TODO

**Audit scan on Stripe purchase**
`src/app/api/webhooks/stripe/route.ts:89`
There is a `// TODO: trigger one-time audit scan via Inngest` in the Stripe webhook handler for one-time audit purchases. If you sell audit scans, this flow is not wired up yet.

---

## 5. Already production-safe — no action needed

- Dev bypass guards (`NODE_ENV === "development"`) will not fire in production
- `serverExternalPackages` for axe-core/playwright is in `next.config.ts` and applies in production
- Stuck-scan reclaim runs in all environments (not dev-only)
- `website.verified` is enforced server-side in `triggerScan`
- Plan limits enforcement is entirely server-side
- CSRF protection, SSRF guard, and CSP headers all apply in production
