import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { WebhookEvent } from "@prisma/client";
import { randomBytes } from "crypto";

const VALID_EVENTS: WebhookEvent[] = [
  "SCAN_COMPLETED",
  "CRITICAL_ISSUES_FOUND",
  "SCORE_DROPPED",
  "ISSUE_STATUS_CHANGED",
];

// GET /api/settings/webhooks — list webhooks for current org
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const webhooks = await db.webhook.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      deliveries: {
        orderBy: { deliveredAt: "desc" },
        take: 5,
        select: { id: true, event: true, success: true, statusCode: true, deliveredAt: true },
      },
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ webhooks });
}

// POST /api/settings/webhooks — create a new webhook
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { url, events } = body as { url?: string; events?: string[] };

  if (!url || !events?.length) {
    return NextResponse.json({ error: "url and events are required" }, { status: 400 });
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL must use HTTP or HTTPS" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Validate events
  const validEvents = events.filter((e) => VALID_EVENTS.includes(e as WebhookEvent));
  if (validEvents.length === 0) {
    return NextResponse.json({ error: "At least one valid event is required" }, { status: 400 });
  }

  // Max 10 webhooks per org
  const count = await db.webhook.count({
    where: { organizationId: membership.organizationId },
  });
  if (count >= 10) {
    return NextResponse.json({ error: "Maximum 10 webhooks per organization" }, { status: 400 });
  }

  const secret = randomBytes(32).toString("hex");

  const webhook = await db.webhook.create({
    data: {
      organizationId: membership.organizationId,
      url,
      secret,
      events: validEvents as WebhookEvent[],
    },
  });

  // Return secret only on creation
  return NextResponse.json({ webhook: { ...webhook, secret } }, { status: 201 });
}

// PATCH /api/settings/webhooks — update a webhook
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { id, url, events, enabled } = body;

  if (!id) {
    return NextResponse.json({ error: "Webhook id required" }, { status: 400 });
  }

  const webhook = await db.webhook.findFirst({
    where: { id, organizationId: membership.organizationId },
  });
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (url !== undefined) updateData.url = url;
  if (events !== undefined) {
    const valid = (events as string[]).filter((e) => VALID_EVENTS.includes(e as WebhookEvent));
    updateData.events = valid;
  }
  if (enabled !== undefined) updateData.enabled = Boolean(enabled);

  const updated = await db.webhook.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ webhook: updated });
}

// DELETE /api/settings/webhooks — delete a webhook
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Webhook id required" }, { status: 400 });
  }

  await db.webhook.deleteMany({
    where: { id, organizationId: membership.organizationId },
  });

  return NextResponse.json({ success: true });
}
