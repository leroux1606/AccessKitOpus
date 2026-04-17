import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";

/** Update a client portal */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  const { portalId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const portal = await db.clientPortal.findFirst({
    where: { id: portalId, organizationId: membership.organizationId },
  });

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const body = await req.json();
  const { companyName, enabled, password, primaryColor, logoUrl } = body as {
    companyName?: string;
    enabled?: boolean;
    password?: string | null;
    primaryColor?: string | null;
    logoUrl?: string | null;
  };

  let passwordHash: string | undefined | null = undefined;
  if (password !== undefined) {
    if (password === null || password === "") {
      passwordHash = null;
    } else {
      const { createHash } = await import("crypto");
      passwordHash = createHash("sha256").update(password).digest("hex");
    }
  }

  const updated = await db.clientPortal.update({
    where: { id: portalId },
    data: {
      ...(companyName !== undefined ? { companyName } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      ...(primaryColor !== undefined ? { primaryColor } : {}),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
    },
  });

  return NextResponse.json(updated);
}

/** Delete a client portal */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  const { portalId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const portal = await db.clientPortal.findFirst({
    where: { id: portalId, organizationId: membership.organizationId },
  });

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  await db.clientPortal.delete({ where: { id: portalId } });

  return NextResponse.json({ success: true });
}
