import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { name } = await req.json() as { name?: string };
  const trimmed = name?.trim();

  if (!trimmed || trimmed.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  if (trimmed.length > 64) {
    return NextResponse.json({ error: "Name must be 64 characters or less" }, { status: 400 });
  }

  const org = await db.organization.update({
    where: { id: membership.organizationId },
    data: { name: trimmed },
    select: { id: true, name: true },
  });

  return NextResponse.json(org);
}
