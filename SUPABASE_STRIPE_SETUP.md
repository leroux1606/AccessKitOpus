# Supabase + Stripe Setup Guide for AccessKit

This guide walks through everything needed to connect your Supabase PostgreSQL database with Stripe billing.

---

## Architecture Overview

```
User → AccessKit (Next.js) → Stripe Checkout → Stripe
                                                  │
                                                  ▼
Stripe webhooks → /api/webhooks/stripe → Prisma → Supabase (PostgreSQL)
```

- **Prisma** manages all database tables via migrations — you do NOT create tables manually in Supabase
- **Stripe** handles payment processing, subscriptions, and the customer portal
- **Webhooks** sync Stripe subscription state back to your database

---

## Step 1: Supabase Setup

### 1.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name (e.g., `accesskit-prod`) and strong database password
3. Select the nearest region to your users
4. Wait for the project to provision

### 1.2 Get the connection string

1. Go to **Project Settings → Database**
2. Scroll to **Connection string → URI**
3. Copy the connection string — it looks like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. **Important:** Use the **Transaction Mode** (port 6543) connection for Prisma in serverless (Vercel). For migrations, use the **Session Mode** (port 5432) direct connection.

### 1.3 Configure your `.env` file

```env
# Transaction pooler for app queries (port 6543)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection for migrations (port 5432)
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

### 1.4 Update prisma/schema.prisma datasource (if not already done)

Your schema should have:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 1.5 Run migrations to create all tables

```bash
npx prisma migrate deploy
```

This creates ALL tables from the Prisma schema, including the billing-related fields.

---

## Step 2: Database Tables (Auto-Created by Prisma)

These are the tables and fields Prisma creates that are relevant to billing. **You do NOT create these manually** — they're defined in `prisma/schema.prisma` and applied via migrations.

### Organization table (billing-relevant fields)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `String` (cuid) | Primary key |
| `name` | `String` | Organization name |
| `slug` | `String` (unique) | URL-safe identifier |
| `plan` | `PlanType` enum | STARTER, PROFESSIONAL, AGENCY, ENTERPRISE |
| `stripeCustomerId` | `String?` | Stripe `cus_xxx` ID — links org to Stripe customer |
| `stripeSubscriptionId` | `String?` | Stripe `sub_xxx` ID — links to active subscription |
| `subscriptionStatus` | `SubscriptionStatus` enum | TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID, INCOMPLETE |
| `trialEndsAt` | `DateTime?` | When the 14-day trial expires |

### How billing state flows

```
New user signs up → Organization created with:
  plan = STARTER
  subscriptionStatus = TRIALING
  trialEndsAt = now + 14 days
  stripeCustomerId = null
  stripeSubscriptionId = null

User clicks "Upgrade" → Stripe Checkout → Stripe creates customer + subscription

Webhook: checkout.session.completed →
  stripeCustomerId = cus_xxx
  stripeSubscriptionId = sub_xxx

Webhook: customer.subscription.updated →
  plan = mapped from Stripe price ID
  subscriptionStatus = ACTIVE (or TRIALING if trial subscription)

Webhook: invoice.paid →
  subscriptionStatus = ACTIVE

Webhook: invoice.payment_failed →
  subscriptionStatus = PAST_DUE

Webhook: customer.subscription.deleted →
  plan = STARTER
  subscriptionStatus = CANCELED
  stripeSubscriptionId = null
```

---

## Step 3: Stripe Setup

### 3.1 Create a Stripe account

1. Go to [stripe.com](https://stripe.com) → Sign up
2. Complete business verification (can use test mode for development)

### 3.2 Create Products and Prices in Stripe Dashboard

Go to **Products** → **+ Add product** and create the following:

#### Product 1: AccessKit Starter
- Name: `AccessKit Starter`
- Description: `3 websites, 50 pages/scan, monthly scans`
- **Price 1 (monthly):** $49.00 / month (recurring)
- **Price 2 (annual):** $39.00 / month → create as $468.00 / year (recurring)

#### Product 2: AccessKit Professional
- Name: `AccessKit Professional`
- Description: `25 websites, 250 pages/scan, weekly scans, CI/CD`
- **Price 1 (monthly):** $149.00 / month (recurring)
- **Price 2 (annual):** $119.00 / month → create as $1,428.00 / year (recurring)

#### Product 3: AccessKit Agency
- Name: `AccessKit Agency`
- Description: `150 websites, 1000 pages/scan, daily scans, white-label, API`
- **Price 1 (monthly):** $349.00 / month (recurring)
- **Price 2 (annual):** $279.00 / month → create as $3,348.00 / year (recurring)

#### Product 4: One-Time Accessibility Audit
- Name: `One-Time Accessibility Audit`
- Description: `Full audit of 1 website (up to 500 pages), compliance report, 1 re-scan`
- **Price:** $499.00 (one-time, NOT recurring)

### 3.3 Copy the Price IDs

After creating each price, copy the `price_xxx` IDs and add them to your `.env`:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...          # Settings → Developers → API keys → Secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Settings → Developers → API keys → Publishable key

# Stripe Price IDs (from Products → each price)
STRIPE_STARTER_MONTHLY_PRICE_ID=price_1xxx...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_2xxx...
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_3xxx...
STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID=price_4xxx...
STRIPE_AGENCY_MONTHLY_PRICE_ID=price_5xxx...
STRIPE_AGENCY_ANNUAL_PRICE_ID=price_6xxx...
STRIPE_AUDIT_PRICE_ID=price_7xxx...
```

### 3.4 Set up the Stripe Customer Portal

1. Go to **Settings → Billing → Customer portal**
2. Enable:
   - ✅ Invoices — customers can view invoice history
   - ✅ Subscriptions — allow canceling
   - ✅ Subscriptions — allow switching plans (add all 3 subscription products)
   - ✅ Payment methods — allow updating
3. Save

### 3.5 Set up the Webhook

#### For local development:

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe

# Login
stripe login

# Forward webhooks to your local server
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

The CLI will give you a webhook signing secret (`whsec_xxx`) — copy it to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx...
```

#### For production (Vercel/deployed):

1. Go to **Developers → Webhooks → + Add endpoint**
2. URL: `https://your-domain.com/api/webhooks/stripe`
3. Events to listen for (select these):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret to your production env vars

---

## Step 4: Vercel Environment Variables

In your Vercel project settings (**Settings → Environment Variables**), add ALL of these:

```
DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_...
STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID=price_...
STRIPE_AGENCY_MONTHLY_PRICE_ID=price_...
STRIPE_AGENCY_ANNUAL_PRICE_ID=price_...
STRIPE_AUDIT_PRICE_ID=price_...
```

---

## Step 5: Test the Full Flow

### 5.1 Start local dev

```bash
# Terminal 1: run Next.js
npm run dev

# Terminal 2: forward Stripe webhooks
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

### 5.2 Test subscription flow

1. Sign up / log in → you'll be on STARTER plan, TRIALING status
2. Go to **Settings → Billing** → click **Upgrade** on Professional or Agency
3. You'll be redirected to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC
5. Complete checkout → redirected back to `/settings/billing?checkout=success`
6. Check your database — organization should now have:
   - `stripeCustomerId` = `cus_xxx`
   - `stripeSubscriptionId` = `sub_xxx`
   - `plan` = your chosen plan
   - `subscriptionStatus` = `ACTIVE`

### 5.3 Test Customer Portal

1. On billing page → click **Open billing portal**
2. You should see Stripe's hosted portal with:
   - Payment method management
   - Subscription details
   - Invoice history
   - Cancel subscription option

### 5.4 Test webhook events

In the terminal running `stripe listen`, you should see events like:
```
  --> checkout.session.completed
  --> customer.subscription.created
  --> invoice.paid
```

### 5.5 Test failed payment

```bash
# Trigger a failed payment event
stripe trigger invoice.payment_failed
```

Check that your org's `subscriptionStatus` changes to `PAST_DUE`.

---

## Stripe Test Cards Reference

| Card Number | Scenario |
|------------|----------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0341` | Attaches, but charge fails |
| `4000 0000 0000 9995` | Payment is declined |
| `4000 0025 0000 3155` | Requires 3D Secure |

---

## Code Files Reference

| File | Purpose |
|------|---------|
| `src/lib/stripe.ts` | Stripe client, checkout/portal session helpers |
| `src/app/api/webhooks/stripe/route.ts` | Webhook handler — syncs Stripe → database |
| `src/app/api/billing/checkout/route.ts` | Creates Stripe Checkout sessions |
| `src/app/api/billing/portal/route.ts` | Creates Stripe Customer Portal sessions |
| `src/app/(dashboard)/settings/billing/page.tsx` | Billing settings page |
| `src/components/dashboard/billing-actions.tsx` | Client-side upgrade/portal buttons |
| `src/app/pricing/page.tsx` | Public pricing page |
| `src/inngest/trial-reminders.ts` | Cron job for trial expiry emails |
| `src/lib/plans.ts` | Plan definitions, limits, prices |
| `prisma/schema.prisma` | Database schema (Organization model has billing fields) |
