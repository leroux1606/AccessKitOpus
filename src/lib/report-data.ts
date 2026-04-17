import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import type { ScanReportData } from "@/components/reports/pdf-template";
import type { VpatReportData } from "@/components/reports/vpat-template";

/**
 * Build the data object needed for a PDF report from a scan ID.
 */
export async function buildScanReportData(scanId: string): Promise<ScanReportData | null> {
  const scan = await db.scan.findUnique({
    where: { id: scanId },
    include: {
      website: {
        include: { organization: true },
      },
      pages: {
        include: {
          violations: {
            orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: { violationCount: "desc" },
      },
    },
  });

  if (!scan || scan.status !== "COMPLETED") return null;

  const whiteLabel = scan.website.organization.whiteLabel as {
    companyName?: string | null;
    primaryColor?: string | null;
    logoUrl?: string | null;
  } | null;

  return {
    websiteName: scan.website.name,
    websiteUrl: scan.website.url,
    organizationName: scan.website.organization.name,
    scanDate: formatDate(scan.completedAt ?? scan.createdAt),
    whiteLabel: ["AGENCY", "ENTERPRISE"].includes(scan.website.organization.plan)
      ? whiteLabel
      : null,
    score: scan.score,
    pagesScanned: scan.pagesScanned,
    totalViolations: scan.totalViolations ?? 0,
    criticalCount: scan.criticalCount ?? 0,
    seriousCount: scan.seriousCount ?? 0,
    moderateCount: scan.moderateCount ?? 0,
    minorCount: scan.minorCount ?? 0,
    duration: scan.duration,
    standards: scan.website.standards,
    pages: scan.pages.map((page) => ({
      url: page.url,
      title: page.title,
      score: page.score,
      violationCount: page.violationCount,
      violations: page.violations.map((v) => ({
        severity: v.severity,
        description: v.description,
        ruleId: v.ruleId,
        wcagCriterion: v.wcagCriterion,
        wcagLevel: v.wcagLevel,
        helpText: v.helpText,
        cssSelector: v.cssSelector,
        fixSuggestion: v.fixSuggestion,
        category: v.category,
      })),
    })),
  };
}

/**
 * Build data for a VPAT compliance evidence report.
 * Aggregates violation data across all scans for a website.
 */
export async function buildVpatReportData(websiteId: string): Promise<VpatReportData | null> {
  const website = await db.website.findUnique({
    where: { id: websiteId },
    include: { organization: true },
  });

  if (!website) return null;

  // Get all violations for this website (latest per fingerprint)
  const violations = await db.violation.findMany({
    where: { websiteId },
    select: { wcagCriterion: true, status: true },
  });

  const scansCount = await db.scan.count({
    where: { websiteId, status: "COMPLETED" },
  });

  // Count violations and fixes per WCAG criterion
  const violationsByCriterion: Record<string, number> = {};
  const fixedByCriterion: Record<string, number> = {};

  for (const v of violations) {
    const criterion = v.wcagCriterion;
    if (!criterion) continue;
    violationsByCriterion[criterion] = (violationsByCriterion[criterion] ?? 0) + 1;
    if (v.status === "FIXED" || v.status === "VERIFIED") {
      fixedByCriterion[criterion] = (fixedByCriterion[criterion] ?? 0) + 1;
    }
  }

  // Determine evaluation period from first and last scan
  const [firstScan, lastScan] = await Promise.all([
    db.scan.findFirst({ where: { websiteId, status: "COMPLETED" }, orderBy: { completedAt: "asc" }, select: { completedAt: true } }),
    db.scan.findFirst({ where: { websiteId, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
  ]);

  const startDate = firstScan?.completedAt ? formatDate(firstScan.completedAt) : "N/A";
  const endDate = lastScan?.completedAt ? formatDate(lastScan.completedAt) : "N/A";

  const whiteLabel = website.organization.whiteLabel as {
    companyName?: string | null;
    primaryColor?: string | null;
  } | null;

  return {
    websiteName: website.name,
    websiteUrl: website.url,
    organizationName: website.organization.name,
    reportDate: formatDate(new Date()),
    evaluationPeriod: `${startDate} — ${endDate}`,
    score: website.currentScore,
    totalViolations: violations.length,
    scansCount,
    violationsByCriterion,
    fixedByCriterion,
    whiteLabel: ["AGENCY", "ENTERPRISE"].includes(website.organization.plan)
      ? whiteLabel
      : null,
  };
}
