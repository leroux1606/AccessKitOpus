import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_ORG_COOKIE } from "@/lib/get-active-org";

/**
 * POST /api/switch-org
 * Body: { orgId: string }
 *
 * Sets the active-org cookie so all subsequent server component renders
 * resolve to the correct organization. Redirects back to the dashboard.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json() as { orgId?: string };
  const { orgId } = body;

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  // Verify this user actually belongs to the requested org
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  });

  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  return res;
}
