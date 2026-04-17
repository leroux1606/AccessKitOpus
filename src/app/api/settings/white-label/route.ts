import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { canConfigureOrg } from "@/lib/permissions";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !canConfigureOrg(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["AGENCY", "ENTERPRISE"].includes(membership.organization.plan)) {
    return NextResponse.json({ error: "Agency plan required" }, { status: 403 });
  }

  const body = await req.json();
  const { companyName, primaryColor, secondaryColor, logoUrl } = body as {
    companyName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };

  // Validate color format
  const colorRegex = /^#[0-9a-fA-F]{6}$/;
  if (primaryColor && !colorRegex.test(primaryColor)) {
    return NextResponse.json({ error: "Invalid primary color format" }, { status: 400 });
  }
  if (secondaryColor && !colorRegex.test(secondaryColor)) {
    return NextResponse.json({ error: "Invalid secondary color format" }, { status: 400 });
  }

  const whiteLabel = {
    companyName: companyName?.trim() || null,
    primaryColor: primaryColor || null,
    secondaryColor: secondaryColor || null,
    logoUrl: logoUrl || null,
  };

  await db.organization.update({
    where: { id: membership.organizationId },
    data: { whiteLabel },
  });

  return NextResponse.json({ success: true, whiteLabel });
}
