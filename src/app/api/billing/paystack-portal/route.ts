import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveMembership } from "@/lib/get-active-org";
import { generateSubscriptionLink } from "@/lib/paystack";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "No admin access" }, { status: 403 });
  }

  const org = membership.organization;

  if (!org.paystackSubscriptionCode) {
    return NextResponse.json(
      { error: "No PayStack subscription found. Please subscribe to a plan first." },
      { status: 400 }
    );
  }

  try {
    const { link } = await generateSubscriptionLink(org.paystackSubscriptionCode);
    return NextResponse.json({ url: link });
  } catch (err) {
    console.error("[PayStack Portal] Error:", err);
    return NextResponse.json({ error: "Failed to get management link" }, { status: 500 });
  }
}
