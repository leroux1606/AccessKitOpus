import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value).replace(/\r?\n/g, " ");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

/**
 * GET /api/websites/[websiteId]/violations/export
 * Downloads all violations for a website as a CSV file.
 * Phase 4 — CSV export feature.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { websiteId } = await params;

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No membership" }, { status: 403 });
  }

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const violations = await db.violation.findMany({
    where: { websiteId },
    include: { page: { select: { url: true, title: true } } },
    orderBy: [{ severity: "asc" }, { firstDetectedAt: "desc" }],
  });

  const CSV_HEADERS = [
    "ID",
    "Severity",
    "Status",
    "Category",
    "Rule ID",
    "WCAG Criterion",
    "WCAG Level",
    "Standards",
    "Description",
    "Help Text",
    "CSS Selector",
    "HTML Element",
    "Page URL",
    "Page Title",
    "First Detected",
    "Effort",
    "Fix Suggestion",
    "Help URL",
  ];

  const rows = violations.map((v) =>
    [
      v.id,
      v.severity,
      v.status,
      v.category,
      v.ruleId,
      v.wcagCriterion ?? "",
      v.wcagLevel ?? "",
      v.standards.join("; "),
      v.description,
      v.helpText,
      v.cssSelector,
      v.htmlElement,
      v.page?.url ?? "",
      v.page?.title ?? "",
      v.firstDetectedAt.toISOString(),
      v.effortEstimate ?? "",
      v.fixSuggestion ?? "",
      v.helpUrl ?? "",
    ]
      .map(escapeCsv)
      .join(","),
  );

  const csv = [CSV_HEADERS.join(","), ...rows].join("\r\n");
  const safeWebsiteName = website.name
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .slice(0, 40);
  const date = new Date().toISOString().split("T")[0];
  const filename = `${safeWebsiteName}-violations-${date}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
