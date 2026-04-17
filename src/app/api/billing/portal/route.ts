import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveMembership } from "@/lib/get-active-org";
import { canManageBilling } from "@/lib/permissions";
import { createPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !canManageBilling(membership.role)) {
    return NextResponse.json({ error: "No admin access" }, { status: 403 });
  }

  const org = membership.organization;

  if (!org.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe to a plan first." },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin") || process.env.AUTH_URL || "http://localhost:3000";

  try {
    const portalSession = await createPortalSession({
      customerId: org.stripeCustomerId,
      returnUrl: `${origin}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[Portal] Error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
