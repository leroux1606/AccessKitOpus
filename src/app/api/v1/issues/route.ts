import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import type { Severity, IssueStatus } from "@prisma/client";

/** List issues (violations), optionally filtered */
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const websiteId = searchParams.get("websiteId");
  const scanId = searchParams.get("scanId");
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = {
    website: { organizationId: authResult.organizationId },
    ...(websiteId ? { websiteId } : {}),
    ...(scanId ? { scanId } : {}),
    ...(severity ? { severity: severity.toUpperCase() as Severity } : {}),
    ...(status ? { status: status.toUpperCase() as IssueStatus } : {}),
  };

  const [issues, total] = await Promise.all([
    db.violation.findMany({
      where,
      select: {
        id: true,
        scanId: true,
        websiteId: true,
        ruleId: true,
        severity: true,
        category: true,
        description: true,
        helpText: true,
        htmlElement: true,
        cssSelector: true,
        fixSuggestion: true,
        aiFixSuggestion: true,
        fixedHtml: true,
        effortEstimate: true,
        status: true,
        assignedToId: true,
        wcagCriterion: true,
        wcagLevel: true,
        standards: true,
        fingerprint: true,
        firstDetectedAt: true,
        createdAt: true,
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    db.violation.count({ where }),
  ]);

  return NextResponse.json({ data: issues, total, limit, offset });
}
