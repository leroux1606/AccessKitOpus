import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

/** Map PayStack plan codes → our PlanType (built from env vars at runtime) */
function mapPlanCodeToPlan(planCode: string): PlanType | null {
  const defs: { env: string; plan: PlanType }[] = [
    { env: "PAYSTACK_STARTER_MONTHLY_PLAN_CODE", plan: "STARTER" },
    { env: "PAYSTACK_STARTER_ANNUAL_PLAN_CODE", plan: "STARTER" },
    { env: "PAYSTACK_PROFESSIONAL_MONTHLY_PLAN_CODE", plan: "PROFESSIONAL" },
    { env: "PAYSTACK_PROFESSIONAL_ANNUAL_PLAN_CODE", plan: "PROFESSIONAL" },
    { env: "PAYSTACK_AGENCY_MONTHLY_PLAN_CODE", plan: "AGENCY" },
    { env: "PAYSTACK_AGENCY_ANNUAL_PLAN_CODE", plan: "AGENCY" },
  ];

  for (const { env, plan } of defs) {
    if (process.env[env] === planCode) return plan;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature || !verifyWebhookSignature(payload, signature)) {
    console.warn("[PayStack Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(payload) as { event: string; data: unknown };

  try {
    switch (event.event) {
      case "subscription.create":
        await handleSubscriptionCreate(event.data as SubscriptionCreateData);
        break;
      case "subscription.enable":
        await handleSubscriptionEnable(event.data as SubscriptionUpdateData);
        break;
      case "subscription.not_renew":
      case "subscription.disable":
        await handleSubscriptionDisable(event.data as SubscriptionUpdateData);
        break;
      case "charge.success":
        await handleChargeSuccess(event.data as ChargeSuccessData);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data as InvoiceFailedData);
        break;
      default:
        // Unhandled event — no-op
        break;
    }
  } catch (err) {
    console.error(`[PayStack Webhook] Error handling ${event.event}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionCreateData {
  subscription_code: string;
  customer: { email: string; customer_code: string };
  plan: { plan_code: string };
  next_payment_date: string;
}

interface SubscriptionUpdateData {
  subscription_code: string;
  customer: { email: string; customer_code: string };
  plan?: { plan_code: string };
  next_payment_date?: string;
}

interface ChargeSuccessData {
  reference: string;
  customer: { email: string; customer_code: string };
  metadata?: { organizationId?: string };
}

interface InvoiceFailedData {
  subscription?: { subscription_code: string };
  customer: { email: string };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleSubscriptionCreate(data: SubscriptionCreateData) {
  // Prefer lookup by customer code (set before checkout); fall back to owner email
  let org = await db.organization.findFirst({
    where: { paystackCustomerCode: data.customer.customer_code },
  });

  if (!org) {
    org = await db.organization.findFirst({
      where: {
        memberships: {
          some: { user: { email: data.customer.email }, role: "OWNER" },
        },
      },
    });
  }

  if (!org) {
    console.warn("[PayStack Webhook] Org not found for customer:", data.customer.email);
    return;
  }

  const plan = mapPlanCodeToPlan(data.plan.plan_code);

  await db.organization.update({
    where: { id: org.id },
    data: {
      paystackCustomerCode: data.customer.customer_code,
      paystackSubscriptionCode: data.subscription_code,
      subscriptionStatus: "ACTIVE",
      ...(plan ? { plan } : {}),
      trialEndsAt: null,
    },
  });
}

async function handleSubscriptionEnable(data: SubscriptionUpdateData) {
  const org = await db.organization.findFirst({
    where: { paystackSubscriptionCode: data.subscription_code },
  });
  if (!org) return;

  await db.organization.update({
    where: { id: org.id },
    data: { subscriptionStatus: "ACTIVE" },
  });
}

async function handleSubscriptionDisable(data: SubscriptionUpdateData) {
  const org = await db.organization.findFirst({
    where: { paystackSubscriptionCode: data.subscription_code },
  });
  if (!org) return;

  await db.organization.update({
    where: { id: org.id },
    data: {
      plan: "STARTER",
      subscriptionStatus: "CANCELED",
      paystackSubscriptionCode: null,
    },
  });
}

async function handleChargeSuccess(data: ChargeSuccessData) {
  const org = await db.organization.findFirst({
    where: { paystackCustomerCode: data.customer.customer_code },
  });
  if (!org) return;

  if (org.subscriptionStatus !== "ACTIVE") {
    await db.organization.update({
      where: { id: org.id },
      data: { subscriptionStatus: "ACTIVE" },
    });
  }
}

async function handleInvoicePaymentFailed(data: InvoiceFailedData) {
  if (!data.subscription?.subscription_code) return;

  await db.organization.updateMany({
    where: { paystackSubscriptionCode: data.subscription.subscription_code },
    data: { subscriptionStatus: "PAST_DUE" },
  });
}
