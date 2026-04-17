import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { IssueStatus } from "@prisma/client";
import { createNotifications, getEmailRecipients } from "@/lib/notifications";

const VALID_STATUSES: IssueStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "WONT_FIX",
  "FALSE_POSITIVE",
];

/**
 * PATCH /api/issues/[violationId]
 * Update issue status and/or assignee.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ violationId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { violationId } = await params;
  const body = await req.json();
  const { status, assignedToId } = body as {
    status?: string;
    assignedToId?: string | null;
  };

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No membership" }, { status: 403 });
  }

  // Verify violation belongs to user's org
  const violation = await db.violation.findFirst({
    where: {
      id: violationId,
      website: { organizationId: membership.organizationId },
    },
  });
  if (!violation) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as IssueStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updateData.status = status;
    if (status === "FIXED") updateData.resolvedAt = new Date();
    if (status === "VERIFIED") updateData.verifiedAt = new Date();
    if (status === "OPEN") {
      updateData.resolvedAt = null;
      updateData.verifiedAt = null;
    }
  }

  if (assignedToId !== undefined) {
    if (assignedToId !== null) {
      // Verify assignee belongs to the same org
      const assigneeMembership = await db.membership.findFirst({
        where: {
          userId: assignedToId,
          organizationId: membership.organizationId,
        },
      });
      if (!assigneeMembership) {
        return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
      }
    }
    updateData.assignedToId = assignedToId;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await db.violation.update({
    where: { id: violationId },
    data: updateData,
    include: { assignedTo: true, website: true },
  });

  // Send assignment notification if assignee changed
  if (
    assignedToId &&
    assignedToId !== violation.assignedToId
  ) {
    const assigner = session.user.name ?? session.user.email ?? "Someone";
    const title = `Issue assigned to you: ${updated.description.slice(0, 60)}`;
    const message = `${assigner} assigned you an issue on ${updated.website.name} (${updated.severity} severity).`;
    const link = `/websites/${updated.websiteId}/issues/${updated.id}`;

    // In-app notification
    createNotifications({
      organizationId: membership.organizationId,
      type: "ISSUE_ASSIGNED",
      title,
      message,
      link,
      userIds: [assignedToId],
    }).catch(() => {});

    // Email notification
    getEmailRecipients(membership.organizationId, "ISSUE_ASSIGNED", [assignedToId])
      .then(async (recipients) => {
        if (recipients.length === 0) return;
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) return;
        const { Resend } = await import("resend");
        const resend = new Resend(resendApiKey);
        const baseUrl = process.env.AUTH_URL ?? "https://app.accesskit.io";
        for (const r of recipients) {
          await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
            to: r.email,
            subject: title,
            text: `Hi ${r.name ?? "there"},\n\n${message}\n\nView issue: ${baseUrl}${link}\n\n— The AccessKit Team`,
          });
        }
      })
      .catch(() => {});
  }

  return NextResponse.json(updated);
}

/**
 * GET /api/issues/[violationId]
 * Fetch a single issue with full details.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ violationId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { violationId } = await params;

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No membership" }, { status: 403 });
  }

  const violation = await db.violation.findFirst({
    where: {
      id: violationId,
      website: { organizationId: membership.organizationId },
    },
    include: {
      page: true,
      website: true,
      assignedTo: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!violation) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json(violation);
}
