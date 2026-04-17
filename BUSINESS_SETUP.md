# AccessKit — Business & Payment Setup

*Last updated: 15 April 2026*

---

## Decision: UK Ltd Company

Register a UK Ltd company as the legal entity for AccessKit (and ComplianceKit).  
Do this **before** onboarding any paying customers — zero migration pain.

### Why UK Ltd and not SA company

| | SA Company | UK Ltd |
|---|---|---|
| **Stripe access** | ❌ Not available | ✅ Full access |
| **US/EU customer trust** | Lower | Higher (familiar jurisdiction) |
| **VAT handling** | Complex for EU sales | Straightforward |
| **Bank account** | SA bank only | Wise Business (multi-currency) |
| **Registration cost** | R1,000–R2,000 | £50 once |
| **Annual filing** | CIPC + SARS | Companies House (simple) |
| **Time to register** | 5–10 business days | 24–48 hours online |

### Target markets

AccessKit targets agencies and web teams in:
- 🇿🇦 South Africa
- 🇪🇺 European Union (EU Accessibility Act enforcement started June 2025)
- 🇺🇸 United States (ADA lawsuits ~4,500/year)

A UK Ltd is the right structure for all three markets.

---

## Step-by-Step Setup

### Step 1 — Register UK Ltd

**Option A — Direct (£50, 24 hours)**
- Go to [companieshouse.gov.uk](https://www.gov.uk/limited-company-formation)
- Register online, takes about 30 minutes
- Approved within 24–48 hours

**Option B — Formation agent (£12.99–£50, same day)**
- [1stformations.co.uk](https://www.1stformations.co.uk) — highly rated, fast
- They handle all the paperwork
- Recommended if you want it done in hours

What you'll need:
- Your full name and address (SA address is fine as director)
- Company name (e.g. "AccessKit Ltd")
- Email address
- Credit/debit card for the fee

---

### Step 2 — Open Wise Business Account

Go to [wise.com/business](https://wise.com/business)

- Free to open
- Accepts UK companies registered at Companies House
- Gives you a real UK bank account number (sort code + account number)
- Accepts USD, EUR, GBP payments into the same account
- Convert and withdraw to your SA bank account in ZAR at mid-market rates
- No monthly fees (small conversion fee ~0.4%)

Money flow:
```
Customer (USD/EUR/GBP) → Stripe → Wise Business UK account → ZAR → SA bank
```

---

### Step 3 — Sign up for Stripe

Go to [stripe.com](https://stripe.com)

- Select United Kingdom as your country
- Use your UK Ltd company details
- Use your Wise Business account as the bank account for payouts
- Full Stripe access — subscriptions, webhooks, customer portal, invoices

---

### Step 4 — Create Stripe Products & Prices

In the Stripe dashboard, create products for AccessKit:

| Plan | Monthly Price | Annual Price |
|---|---|---|
| Starter | $49/month | $39/month (billed $468/year) |
| Professional | $149/month | $119/month (billed $1,428/year) |
| Agency | $349/month | $279/month (billed $3,348/year) |
| One-time Audit | $499 one-time | — |

Copy each `price_xxx` ID into `.env`:

```env
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_...
STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID=price_...
STRIPE_AGENCY_MONTHLY_PRICE_ID=price_...
STRIPE_AGENCY_ANNUAL_PRICE_ID=price_...
STRIPE_AUDIT_PRICE_ID=price_...
```

---

### Step 5 — Add Stripe Keys to .env

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For development, use test keys (`sk_test_...`) first.  
The code is already written — zero changes needed.

---

### Step 6 — Set Up Stripe Webhook

In Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://yourdomain.com/api/webhooks/stripe`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET` in `.env`

---

## What Users See

Users in SA, EU, and US all see a standard Stripe credit card checkout form.  
It looks identical to any other SaaS they've subscribed to.  
They never know or care that the company is registered in the UK.

---

## ComplianceKit — Same Setup

Use the **same UK Ltd company** for both AccessKit and ComplianceKit.  
Create separate Stripe products for each app within the same Stripe account.  
Keep revenue reporting separate using Stripe's product metadata.

---

## You Still Live in SA

The UK Ltd is just the legal entity. You remain in South Africa.  
Tax obligations: consult a SA accountant — foreign income rules apply.  
Many SA SaaS founders use this exact structure.

---

## Summary Checklist

- [ ] Register UK Ltd at 1stformations.co.uk or Companies House
- [ ] Open Wise Business account with UK Ltd details
- [ ] Sign up for Stripe UK with Wise as the payout bank
- [ ] Create Stripe products (Starter, Professional, Agency, One-time Audit)
- [ ] Copy Stripe price IDs into AccessKit `.env`
- [ ] Copy Stripe price IDs into ComplianceKit `.env`
- [ ] Set up Stripe webhook endpoint for AccessKit
- [ ] Set up Stripe webhook endpoint for ComplianceKit
- [ ] Test checkout flow with Stripe test card `4242 4242 4242 4242`
- [ ] Switch to live keys when ready to launch
