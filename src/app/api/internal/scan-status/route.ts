import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 120 polls per user per minute (3s interval × 40 concurrent scans max)
  const { allowed } = checkRateLimit(`poll:${session.user.id}`, 120, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const scanId = request.nextUrl.searchParams.get("scanId");
  if (!scanId) {
    return NextResponse.json({ error: "Missing scanId" }, { status: 400 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No membership" }, { status: 403 });
  }

  const scan = await db.scan.findFirst({
    where: {
      id: scanId,
      website: { organizationId: membership.organizationId },
    },
    select: { status: true, createdAt: true, startedAt: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Auto-reclaim scans that are stuck so the poller stops spinning on its own
  // rather than waiting for the 10-minute UI timeout. This handles the common
  // dev case where a hot-reload kills the after() callback mid-scan, leaving
  // the status frozen in QUEUED or RUNNING forever.
  const QUEUE_STUCK_MS = 2 * 60 * 1000;  // 2 min — fallback waits 3 s to start
  const RUN_STUCK_MS   = 5 * 60 * 1000;  // 5 min — real scans finish in <2 min
  const now = Date.now();
  const isStuckQueued = scan.status === "QUEUED" && now - scan.createdAt.getTime() > QUEUE_STUCK_MS;
  const isStuckRunning = scan.status === "RUNNING" && scan.startedAt && now - scan.startedAt.getTime() > RUN_STUCK_MS;

  if (isStuckQueued || isStuckRunning) {
    await db.scan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        errorMessage: "Scan did not progress — reclaimed automatically",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ status: "FAILED" });
  }

  return NextResponse.json({ status: scan.status });
}
