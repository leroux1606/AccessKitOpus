import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { PlanType, SubscriptionStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Unhandled event type — no-op
        break;
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** When checkout completes, link the Stripe customer to the org */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) return;

  // One-time audit purchase — don't change subscription
  if (session.metadata?.type === "one-time-audit") {
    // TODO: trigger one-time audit scan via Inngest
    console.log("[Stripe] One-time audit purchased for org:", organizationId);
    return;
  }

  // Subscription checkout — save Stripe customer ID
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (customerId) {
    await db.organization.update({
      where: { id: organizationId },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? undefined,
      },
    });
  }
}

/** Map Stripe subscription to org plan + status */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) return;

  const plan = mapPriceIdToPlan(subscription.items.data[0]?.price?.id);
  const status = mapStripeStatus(subscription.status);

  await db.organization.update({
    where: { id: organizationId },
    data: {
      ...(plan ? { plan } : {}),
      subscriptionStatus: status,
      stripeSubscriptionId: subscription.id,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  });
}

/** When subscription is canceled, downgrade to STARTER */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) return;

  await db.organization.update({
    where: { id: organizationId },
    data: {
      plan: "STARTER",
      subscriptionStatus: "CANCELED",
      stripeSubscriptionId: null,
    },
  });
}

/** Extract subscription ID from invoice (Stripe API 2026+) */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/** Invoice paid — ensure subscription status is ACTIVE */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (org && org.subscriptionStatus !== "ACTIVE") {
    await db.organization.update({
      where: { id: org.id },
      data: { subscriptionStatus: "ACTIVE" },
    });
  }
}

/** Invoice payment failed — mark subscription as PAST_DUE */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  await db.organization.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { subscriptionStatus: "PAST_DUE" },
  });
}

/** Map a Stripe Price ID to our PlanType */
function mapPriceIdToPlan(priceId: string | undefined): PlanType | null {
  if (!priceId) return null;

  const mapping: Record<string, PlanType> = {};

  // Build mapping from env vars (monthly + annual for each plan)
  const plans: { env: string; plan: PlanType }[] = [
    { env: "STRIPE_STARTER_MONTHLY_PRICE_ID", plan: "STARTER" },
    { env: "STRIPE_STARTER_ANNUAL_PRICE_ID", plan: "STARTER" },
    { env: "STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID", plan: "PROFESSIONAL" },
    { env: "STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID", plan: "PROFESSIONAL" },
    { env: "STRIPE_AGENCY_MONTHLY_PRICE_ID", plan: "AGENCY" },
    { env: "STRIPE_AGENCY_ANNUAL_PRICE_ID", plan: "AGENCY" },
  ];

  for (const { env, plan } of plans) {
    const id = process.env[env];
    if (id) mapping[id] = plan;
  }

  return mapping[priceId] ?? null;
}

/** Map Stripe subscription status to our SubscriptionStatus enum */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE";
    default:
      return "ACTIVE";
  }
}
