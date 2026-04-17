import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { NotificationType } from "@prisma/client";

const ALL_TYPES: NotificationType[] = [
  "SCAN_COMPLETE",
  "CRITICAL_ISSUES",
  "SCORE_DROP",
  "WEEKLY_DIGEST",
  "ISSUE_ASSIGNED",
];

// GET /api/settings/notifications — get current user's preferences
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: session.user.id,
      organizationId: membership.organizationId,
    },
  });

  // Merge with defaults (all enabled) for any types not yet saved
  const prefMap = new Map(prefs.map((p) => [p.type, p]));
  const merged = ALL_TYPES.map((type) => ({
    type,
    email: prefMap.get(type)?.email ?? true,
    inApp: prefMap.get(type)?.inApp ?? true,
  }));

  return NextResponse.json({ preferences: merged });
}

// PUT /api/settings/notifications — update preferences
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await request.json();
  const preferences = body.preferences as Array<{
    type: NotificationType;
    email: boolean;
    inApp: boolean;
  }>;

  if (!Array.isArray(preferences)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Upsert each preference
  for (const pref of preferences) {
    if (!ALL_TYPES.includes(pref.type)) continue;

    await db.notificationPreference.upsert({
      where: {
        userId_organizationId_type: {
          userId: session.user.id,
          organizationId: membership.organizationId,
          type: pref.type,
        },
      },
      update: {
        email: pref.email,
        inApp: pref.inApp,
      },
      create: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        type: pref.type,
        email: pref.email,
        inApp: pref.inApp,
      },
    });
  }

  return NextResponse.json({ success: true });
}
