import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";

// GET /api/notifications — list notifications for current user
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const where: Record<string, unknown> = {
    userId: session.user.id,
    organizationId: membership.organizationId,
  };
  if (unreadOnly) where.read = false;

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  if (hasMore) notifications.pop();

  const unreadCount = await db.notification.count({
    where: {
      userId: session.user.id,
      organizationId: membership.organizationId,
      read: false,
    },
  });

  return NextResponse.json({
    notifications,
    unreadCount,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  });
}

// PATCH /api/notifications — mark read / mark all read
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await request.json();

  if (body.markAllRead) {
    await db.notification.updateMany({
      where: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        read: false,
      },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (body.notificationId) {
    await db.notification.updateMany({
      where: {
        id: body.notificationId,
        userId: session.user.id,
      },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
