# PayStack Setup Checklist

## 1. Create Account
- [ ] Go to https://paystack.com and sign up
- [ ] Verify email and complete business profile
- [ ] Enable your account for live payments (submit business details)

## 2. Create Subscription Plans (Dashboard → Products → Plans)

Create 6 plans. Use these exact names and amounts:

| Plan Name | Amount | Interval | Notes |
|---|---|---|---|
| AccessKit Starter Monthly | R499 | Monthly | |
| AccessKit Starter Annual | R4,790 | Annually | ~20% off |
| AccessKit Professional Monthly | R1,499 | Monthly | |
| AccessKit Professional Annual | R14,390 | Annually | ~20% off |
| AccessKit Agency Monthly | R3,499 | Monthly | |
| AccessKit Agency Annual | R33,590 | Annually | ~20% off |

> Adjust ZAR amounts as needed. After creating each plan, copy its **Plan Code** (format: `PLN_xxxxxxxx`).

## 3. Set Environment Variables

Add to your `.env` file:

```env
PAYSTACK_SECRET_KEY=sk_live_...          # Settings → API Keys & Webhooks

PAYSTACK_STARTER_MONTHLY_PLAN_CODE=PLN_...
PAYSTACK_STARTER_ANNUAL_PLAN_CODE=PLN_...
PAYSTACK_PROFESSIONAL_MONTHLY_PLAN_CODE=PLN_...
PAYSTACK_PROFESSIONAL_ANNUAL_PLAN_CODE=PLN_...
PAYSTACK_AGENCY_MONTHLY_PLAN_CODE=PLN_...
PAYSTACK_AGENCY_ANNUAL_PLAN_CODE=PLN_...
```

## 4. Register Webhook

- [ ] Go to **Settings → API Keys & Webhooks** in PayStack dashboard
- [ ] Add webhook URL: `https://accesskit.app/api/webhooks/paystack`
- [ ] No need to select specific events — PayStack sends all events to the URL

## 5. Test (before going live)

- [ ] Use test secret key (`sk_test_...`) first
- [ ] Use PayStack test card: `4084084084084081`, any future expiry, any CVV
- [ ] Subscribe to a plan → confirm org `subscriptionStatus` updates to `ACTIVE` in Supabase
- [ ] Check `paystackCustomerCode` and `paystackSubscriptionCode` are saved on the org row
- [ ] Open billing portal link → confirm PayStack management page loads

## 6. Go Live

- [ ] Swap `sk_test_...` for `sk_live_...` in `.env`
- [ ] Update plan codes to live plan codes (test and live plans are separate in PayStack)
- [ ] Re-register webhook with live URL if testing was done locally
