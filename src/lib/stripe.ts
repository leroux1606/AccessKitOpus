import Stripe from "stripe";
import { PlanType } from "@prisma/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/** Map plan types to their Stripe Price IDs (set in env) */
const PLAN_PRICE_IDS: Partial<Record<PlanType, { monthly: string; annual: string }>> = {
  STARTER: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? "",
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? "",
  },
  PROFESSIONAL: {
    monthly: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID ?? "",
    annual: process.env.STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID ?? "",
  },
  AGENCY: {
    monthly: process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID ?? "",
    annual: process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID ?? "",
  },
};

export function getStripePriceId(
  plan: PlanType,
  interval: "monthly" | "annual"
): string | null {
  return PLAN_PRICE_IDS[plan]?.[interval] || null;
}

/** One-time audit product price */
export const AUDIT_PRICE_ID = process.env.STRIPE_AUDIT_PRICE_ID ?? "";

/** Create a Stripe Checkout session for a subscription */
export async function createCheckoutSession({
  organizationId,
  customerId,
  priceId,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  organizationId: string;
  customerId?: string;
  priceId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    ...(customerId ? { customer: customerId } : { customer_email: customerEmail }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { organizationId },
      trial_period_days: customerId ? undefined : 14,
    },
    metadata: { organizationId },
    allow_promotion_codes: true,
  });
}

/** Create a Stripe Checkout session for one-time audit purchase */
export async function createAuditCheckoutSession({
  organizationId,
  customerId,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  organizationId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    ...(customerId ? { customer: customerId } : { customer_email: customerEmail }),
    line_items: [{ price: AUDIT_PRICE_ID, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { organizationId, type: "one-time-audit" },
  });
}

/** Create a Stripe Customer Portal session for self-service billing */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/** Create or retrieve a Stripe customer for an organization */
export async function getOrCreateCustomer({
  email,
  name,
  organizationId,
}: {
  email: string;
  name: string;
  organizationId: string;
}): Promise<string> {
  // Check if customer already exists by metadata
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0]!.id;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { organizationId },
  });

  return customer.id;
}
