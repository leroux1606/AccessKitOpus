import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import {
  createCheckoutSession,
  createAuditCheckoutSession,
  getOrCreateCustomer,
  getStripePriceId,
} from "@/lib/stripe";
import { PlanType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { plan, interval, type } = body as {
    plan?: PlanType;
    interval?: "monthly" | "annual";
    type?: "subscription" | "one-time-audit";
  };

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "No admin access" }, { status: 403 });
  }

  const org = membership.organization;
  const origin = req.headers.get("origin") || process.env.AUTH_URL || "http://localhost:3000";

  try {
    // One-time audit purchase
    if (type === "one-time-audit") {
      const customerId = org.stripeCustomerId
        ? org.stripeCustomerId
        : await getOrCreateCustomer({
            email: session.user.email!,
            name: org.name,
            organizationId: org.id,
          });

      const checkoutSession = await createAuditCheckoutSession({
        organizationId: org.id,
        customerId,
        successUrl: `${origin}/settings/billing?audit=success`,
        cancelUrl: `${origin}/settings/billing?audit=canceled`,
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    // Subscription checkout
    if (!plan || !interval) {
      return NextResponse.json(
        { error: "Missing plan or interval" },
        { status: 400 }
      );
    }

    if (plan === "ENTERPRISE") {
      return NextResponse.json(
        { error: "Enterprise plans require custom setup" },
        { status: 400 }
      );
    }

    const priceId = getStripePriceId(plan, interval);
    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured" },
        { status: 400 }
      );
    }

    const customerId = org.stripeCustomerId
      ? org.stripeCustomerId
      : await getOrCreateCustomer({
          email: session.user.email!,
          name: org.name,
          organizationId: org.id,
        });

    // Save customer ID if new
    if (!org.stripeCustomerId) {
      await db.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkoutSession = await createCheckoutSession({
      organizationId: org.id,
      customerId,
      priceId,
      successUrl: `${origin}/settings/billing?checkout=success`,
      cancelUrl: `${origin}/settings/billing?checkout=canceled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[Checkout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
