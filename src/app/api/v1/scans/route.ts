import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

/** List scans, optionally filtered by websiteId */
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const websiteId = searchParams.get("websiteId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = {
    website: { organizationId: authResult.organizationId },
    ...(websiteId ? { websiteId } : {}),
  };

  const [scans, total] = await Promise.all([
    db.scan.findMany({
      where,
      select: {
        id: true,
        websiteId: true,
        status: true,
        score: true,
        pagesScanned: true,
        totalViolations: true,
        criticalCount: true,
        seriousCount: true,
        moderateCount: true,
        minorCount: true,
        duration: true,
        triggeredBy: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.scan.count({ where }),
  ]);

  return NextResponse.json({ data: scans, total, limit, offset });
}

/** Trigger a new scan */
export async function POST(req: NextRequest) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { websiteId } = body as { websiteId?: string };

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required" }, { status: 400 });
  }

  const website = await db.website.findFirst({
    where: { id: websiteId, organizationId: authResult.organizationId, verified: true },
    include: { organization: true },
  });

  if (!website) {
    return NextResponse.json(
      { error: "Website not found or not verified" },
      { status: 404 }
    );
  }

  // Check for already running scan
  const running = await db.scan.findFirst({
    where: { websiteId, status: { in: ["QUEUED", "RUNNING"] } },
  });

  if (running) {
    return NextResponse.json(
      { error: "A scan is already in progress", scanId: running.id },
      { status: 409 }
    );
  }

  const { getPlanLimits } = await import("@/lib/plans");
  const limits = getPlanLimits(website.organization.plan);

  const scan = await db.scan.create({
    data: {
      websiteId,
      status: "QUEUED",
      pageLimit: limits.pagesPerScan === Infinity ? 10000 : limits.pagesPerScan,
      triggeredBy: "API",
    },
  });

  // Fire scan event via Inngest
  try {
    const { inngest } = await import("@/inngest/client");
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
  } catch {
    // Inngest may not be available in all environments
  }

  return NextResponse.json({ data: scan }, { status: 201 });
}
