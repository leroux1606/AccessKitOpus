import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { canManageBilling } from "@/lib/permissions";
import { initializeTransaction, createCustomer } from "@/lib/paystack";
import { PlanType } from "@prisma/client";

const PAYSTACK_PLAN_CODES: Partial<Record<PlanType, { monthly: string; annual: string }>> = {
  STARTER: {
    monthly: process.env.PAYSTACK_STARTER_MONTHLY_PLAN_CODE ?? "",
    annual: process.env.PAYSTACK_STARTER_ANNUAL_PLAN_CODE ?? "",
  },
  PROFESSIONAL: {
    monthly: process.env.PAYSTACK_PROFESSIONAL_MONTHLY_PLAN_CODE ?? "",
    annual: process.env.PAYSTACK_PROFESSIONAL_ANNUAL_PLAN_CODE ?? "",
  },
  AGENCY: {
    monthly: process.env.PAYSTACK_AGENCY_MONTHLY_PLAN_CODE ?? "",
    annual: process.env.PAYSTACK_AGENCY_ANNUAL_PLAN_CODE ?? "",
  },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { plan?: PlanType; interval?: "monthly" | "annual" };
  const { plan, interval } = body;

  if (!plan || !interval) {
    return NextResponse.json({ error: "Missing plan or interval" }, { status: 400 });
  }

  if (plan === "ENTERPRISE") {
    return NextResponse.json({ error: "Enterprise plans require custom setup" }, { status: 400 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !canManageBilling(membership.role)) {
    return NextResponse.json({ error: "No admin access" }, { status: 403 });
  }

  const org = membership.organization;
  const planCode = PAYSTACK_PLAN_CODES[plan]?.[interval];

  if (!planCode) {
    return NextResponse.json({ error: "Plan not configured" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.AUTH_URL || "http://localhost:3000";

  try {
    // Get or create PayStack customer
    let customerCode = org.paystackCustomerCode;
    if (!customerCode) {
      const nameParts = (session.user.name ?? "").split(" ");
      const customer = await createCustomer({
        email: session.user.email!,
        first_name: nameParts[0] || undefined,
        last_name: nameParts.slice(1).join(" ") || undefined,
        metadata: { organizationId: org.id },
      });
      customerCode = customer.customer_code;
      await db.organization.update({
        where: { id: org.id },
        data: { paystackCustomerCode: customerCode },
      });
    }

    const txn = await initializeTransaction({
      email: session.user.email!,
      amount: 0, // overridden by plan amount
      plan: planCode,
      callback_url: `${origin}/settings/billing?checkout=success`,
      metadata: { organizationId: org.id, plan, interval },
    });

    return NextResponse.json({ url: txn.authorization_url });
  } catch (err) {
    console.error("[PayStack Checkout] Error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
