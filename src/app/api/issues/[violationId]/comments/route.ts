import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";

/**
 * POST /api/issues/[violationId]/comments
 * Add a comment to an issue.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ violationId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { violationId } = await params;
  const body = await req.json();
  const { content } = body as { content?: string };

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (content.length > 5000) {
    return NextResponse.json({ error: "Content too long (max 5000 chars)" }, { status: 400 });
  }

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

  const comment = await db.issueComment.create({
    data: {
      violationId,
      violationFingerprint: violation.fingerprint,
      userId: session.user.id,
      content: content.trim(),
    },
    include: { user: true },
  });

  return NextResponse.json(comment, { status: 201 });
}

/**
 * GET /api/issues/[violationId]/comments
 * List all comments for an issue.
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
  });
  if (!violation) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const comments = await db.issueComment.findMany({
    where: { violationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}
