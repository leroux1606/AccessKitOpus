import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { getPlanLimits } from "@/lib/plans";
import { inngest } from "@/inngest/client";

// POST /api/benchmarking/competitors/scan — trigger a scan for a competitor
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const org = membership.organization;
  const limits = getPlanLimits(org.plan);

  if (!limits.hasBenchmarking) {
    return NextResponse.json({ error: "Benchmarking not available on your plan" }, { status: 403 });
  }

  const body = await request.json();
  const { websiteId } = body;

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required" }, { status: 400 });
  }

  // Verify the website is a competitor belonging to this org
  const website = await db.website.findFirst({
    where: {
      id: websiteId,
      organizationId: org.id,
      isCompetitor: true,
    },
  });

  if (!website) {
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  // Check for existing active scan
  const activeScan = await db.scan.findFirst({
    where: {
      websiteId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeScan) {
    return NextResponse.json({ error: "A scan is already in progress" }, { status: 409 });
  }

  // Create scan and fire event
  const scan = await db.scan.create({
    data: {
      websiteId,
      pageLimit: Math.min(limits.pagesPerScan, 50), // Limit competitor scans to 50 pages
      triggeredBy: "MANUAL",
      status: "QUEUED",
    },
  });

  await inngest.send({
    name: "scan/website.requested",
    data: {
      scanId: scan.id,
      websiteId: website.id,
      websiteUrl: website.url,
      pageLimit: scan.pageLimit,
      standards: website.standards,
    },
  });

  return NextResponse.json({ scan: { id: scan.id, status: scan.status } });
}
