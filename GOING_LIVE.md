# AccessKit — Production Go-Live Checklist

Use this file as the single source of truth before launching. Work through each section in order.

---

## 1. Infrastructure

### Hosting (Vercel)
- [ ] Create Vercel account at vercel.com
- [ ] Connect GitHub repo → import project
- [ ] Set framework to **Next.js** (auto-detected)
- [ ] Set root directory to `/` (default)
- [ ] Add all environment variables (see Section 4)
- [ ] Deploy — confirm build passes

### Database (Supabase — already configured)
- [ ] Run `npx prisma migrate deploy` against production DATABASE_URL
- [ ] Confirm all tables exist in Supabase dashboard → Table Editor
- [ ] Optionally run `npx prisma db seed` if you want seed data

### Domain
- [ ] Buy domain (e.g. accesskit.app) via Namecheap / Cloudflare
- [ ] In Vercel → Project Settings → Domains → add your domain
- [ ] Point DNS: add Vercel's A record or CNAME at your registrar
- [ ] Wait for SSL cert to provision (usually < 5 min on Vercel)
- [ ] Set `NEXTAUTH_URL` / `AUTH_URL` env var to `https://yourdomain.com`

---

## 2. Authentication

### GitHub OAuth
- [ ] Go to github.com → Settings → Developer Settings → OAuth Apps
- [ ] Update **Homepage URL** to `https://yourdomain.com`
- [ ] Update **Callback URL** to `https://yourdomain.com/api/auth/callback/github`
- [ ] Copy new Client ID + Secret → update env vars

### Google OAuth
- [ ] Go to console.cloud.google.com → APIs & Services → Credentials
- [ ] Create OAuth 2.0 Client ID (Web application)
- [ ] Add Authorized Redirect URI: `https://yourdomain.com/api/auth/callback/google`
- [ ] Copy Client ID + Secret → set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`

---

## 3. Services

### Paystack (Billing)
- [ ] Sign up at paystack.com (one account, multiple businesses)
- [ ] Complete KYC / business verification
- [ ] Create Plans for each tier:
  - Starter Monthly / Annual
  - Professional Monthly / Annual
  - Agency Monthly / Annual
- [ ] Copy each Plan Code → set env vars:
  ```
  PAYSTACK_SECRET_KEY=sk_live_...
  PAYSTACK_STARTER_MONTHLY_PLAN_CODE=PLN_...
  PAYSTACK_STARTER_ANNUAL_PLAN_CODE=PLN_...
  PAYSTACK_PROFESSIONAL_MONTHLY_PLAN_CODE=PLN_...
  PAYSTACK_PROFESSIONAL_ANNUAL_PLAN_CODE=PLN_...
  PAYSTACK_AGENCY_MONTHLY_PLAN_CODE=PLN_...
  PAYSTACK_AGENCY_ANNUAL_PLAN_CODE=PLN_...
  ```
- [ ] Set up Webhook in Paystack dashboard:
  - URL: `https://yourdomain.com/api/webhooks/paystack`
  - Events: `charge.success`, `subscription.create`, `subscription.disable`, `invoice.payment_failed`
  - Copy webhook secret → set `PAYSTACK_WEBHOOK_SECRET`
- [ ] Test payment end-to-end using Paystack test cards before going live
- [ ] Switch Paystack account from Test → Live mode

### Resend (Email)
- [ ] Sign up at resend.com
- [ ] Add and verify your sending domain (e.g. `mail.accesskit.app`)
  - Add DNS records Resend gives you at your registrar
- [ ] Create API key → set `RESEND_API_KEY`
- [ ] Set `EMAIL_FROM=noreply@accesskit.app`
- [ ] Test: trigger an invite email and confirm delivery

### Inngest (Background Scans)
- [ ] Sign up at inngest.com
- [ ] Create app → copy Event Key + Signing Key:
  ```
  INNGEST_EVENT_KEY=...
  INNGEST_SIGNING_KEY=signkey-prod-...
  ```
- [ ] In Inngest dashboard → Sync App → point to `https://yourdomain.com/api/inngest`
- [ ] Confirm functions appear: `scan/website.requested`, `scan/scheduled`
- [ ] Trigger a test scan and confirm it completes end-to-end

### Anthropic (AI Fix Suggestions)
- [ ] Sign up at console.anthropic.com
- [ ] Create API key → set `ANTHROPIC_API_KEY`
- [ ] Test: open an accessibility issue in the dashboard → click "AI Fix Suggestion"

### Cloudflare R2 (Screenshots)
- [ ] Sign up at cloudflare.com → R2 Object Storage
- [ ] Create bucket named `accesskit-screenshots`
- [ ] Create API token with R2 read+write permissions
- [ ] Set env vars:
  ```
  R2_ACCOUNT_ID=...
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  R2_BUCKET_NAME=accesskit-screenshots
  R2_PUBLIC_URL=https://pub-xxx.r2.dev
  ```

### Sentry (Error Tracking)
- [ ] Sign up at sentry.io → create Next.js project
- [ ] Copy DSN → set `SENTRY_DSN`
- [ ] Confirm errors appear in Sentry after a test exception

### PostHog (Analytics)
- [ ] Sign up at posthog.com → create project
- [ ] Copy Project API Key → set `NEXT_PUBLIC_POSTHOG_KEY`
- [ ] Set `NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com`
- [ ] Confirm events appear in PostHog after a test login

---

## 4. Environment Variables — Full Production List

Copy this into Vercel → Project Settings → Environment Variables:

```env
# Database
DATABASE_URL=postgresql://...         # Supabase pooled connection
DIRECT_URL=postgresql://...           # Supabase direct connection

# Auth
AUTH_SECRET=                          # Generate: openssl rand -base64 32
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://yourdomain.com

# OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# Paystack
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
PAYSTACK_STARTER_MONTHLY_PLAN_CODE=
PAYSTACK_STARTER_ANNUAL_PLAN_CODE=
PAYSTACK_PROFESSIONAL_MONTHLY_PLAN_CODE=
PAYSTACK_PROFESSIONAL_ANNUAL_PLAN_CODE=
PAYSTACK_AGENCY_MONTHLY_PLAN_CODE=
PAYSTACK_AGENCY_ANNUAL_PLAN_CODE=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# AI
ANTHROPIC_API_KEY=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=accesskit-screenshots
R2_PUBLIC_URL=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 5. Pre-Launch Testing Checklist

Run through these manually on the live URL before announcing:

### Auth
- [ ] Sign up with GitHub
- [ ] Sign up with Google
- [ ] Sign in / sign out
- [ ] Invite a team member → accept invite email

### Websites & Scanning
- [ ] Add a website you own
- [ ] Verify ownership via meta tag or DNS
- [ ] Trigger manual scan → wait for completion
- [ ] View results: score, issues list, history tab

### Billing
- [ ] Click Upgrade → redirects to Paystack checkout
- [ ] Complete payment with Paystack test card
- [ ] Confirm plan upgrades in dashboard (STARTER → plan badge changes)
- [ ] Cancel subscription → confirm downgrade

### Reports
- [ ] Generate a PDF report for a completed scan
- [ ] Download and verify content

### API
- [ ] Create API key in settings
- [ ] Call `GET /api/v1/websites` with the key — confirm response
- [ ] Call `POST /api/v1/scans` — confirm scan triggers

### AI Fix Suggestions
- [ ] Open any accessibility issue → click AI suggestion
- [ ] Confirm code snippet appears

---

## 6. Security Checks

- [ ] Confirm `.env.local` is in `.gitignore` (never committed)
- [ ] Confirm all API routes require auth (no public data leaks)
- [ ] Check Paystack webhook validates HMAC signature before processing
- [ ] SSRF guard active on verify-website route (only in production)
- [ ] Rate limiting active on verification endpoint
- [ ] No `console.log` with sensitive data in production

---

## 7. Legal Pages

- [ ] `/terms` — Terms of Service (already exists — review and finalise)
- [ ] `/privacy` — Privacy Policy (create before launch)
- [ ] Cookie banner (if serving EU users — GDPR)
- [ ] Company name and address in footer / legal pages

---

## 8. Launch Order (Recommended)

1. Deploy to Vercel with all env vars set
2. Run `prisma migrate deploy`
3. Sync Inngest functions
4. Test full flow end-to-end on prod URL
5. Switch Paystack from Test → Live
6. Announce / share the link

---

## Notes

- **Dev-mode bypass**: verification is auto-approved in `NODE_ENV=development`. Production enforces real meta tag / DNS / file checks.
- **Inngest local dev**: run `npx inngest-cli@latest dev` alongside `npm run dev` to process scan jobs locally.
- **Supabase connection pooling**: use `DATABASE_URL` (port 6543, pgbouncer) for app queries; `DIRECT_URL` (port 5432) for migrations only.
