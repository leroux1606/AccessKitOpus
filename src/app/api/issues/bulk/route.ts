import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { IssueStatus } from "@prisma/client";

const VALID_STATUSES: IssueStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "WONT_FIX",
  "FALSE_POSITIVE",
];

/**
 * POST /api/issues/bulk
 * Bulk update issues: change status, assign, or mark won't fix.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { violationIds, status, assignedToId } = body as {
    violationIds: string[];
    status?: string;
    assignedToId?: string | null;
  };

  if (!Array.isArray(violationIds) || violationIds.length === 0) {
    return NextResponse.json({ error: "violationIds required" }, { status: 400 });
  }

  if (violationIds.length > 100) {
    return NextResponse.json({ error: "Max 100 issues at once" }, { status: 400 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No membership" }, { status: 403 });
  }

  // Verify all violations belong to user's org
  const violations = await db.violation.findMany({
    where: {
      id: { in: violationIds },
      website: { organizationId: membership.organizationId },
    },
    select: { id: true },
  });

  const validIds = violations.map((v) => v.id);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No valid issues found" }, { status: 404 });
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

  const result = await db.violation.updateMany({
    where: { id: { in: validIds } },
    data: updateData,
  });

  return NextResponse.json({ updated: result.count });
}
