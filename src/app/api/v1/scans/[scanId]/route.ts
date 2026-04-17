import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * Get a single scan by ID, scoped to the caller's organization.
 *
 * Added primarily so the CLI / GitHub Action can poll a specific scan
 * to completion without having to list-and-filter. Includes minimal
 * page-level metadata (url, score, violationCount, screenshotUrl) so
 * CI can surface a quick per-page breakdown without a second round-trip
 * to `/api/v1/issues?scanId=…`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { scanId } = await params;

  const scan = await db.scan.findFirst({
    where: {
      id: scanId,
      website: { organizationId: authResult.organizationId },
    },
    select: {
      id: true,
      websiteId: true,
      status: true,
      score: true,
      pagesScanned: true,
      pageLimit: true,
      totalViolations: true,
      criticalCount: true,
      seriousCount: true,
      moderateCount: true,
      minorCount: true,
      duration: true,
      triggeredBy: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      pages: {
        select: {
          id: true,
          url: true,
          title: true,
          score: true,
          violationCount: true,
          loadTime: true,
          screenshotUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({ data: scan });
}
