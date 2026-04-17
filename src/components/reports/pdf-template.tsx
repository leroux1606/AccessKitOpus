import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { buildExecSummary, type ExecutiveSummary } from "@/lib/report-summary";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ViolationData {
  severity: string;
  description: string;
  ruleId: string;
  wcagCriterion: string | null;
  wcagLevel: string | null;
  helpText: string;
  cssSelector: string;
  fixSuggestion: string | null;
  category: string;
}

interface PageData {
  url: string;
  title: string | null;
  score: number | null;
  violationCount: number;
  violations: ViolationData[];
}

export interface WhiteLabelBranding {
  companyName?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
}

export interface ScanReportData {
  websiteName: string;
  websiteUrl: string;
  organizationName: string;
  scanDate: string;
  score: number | null;
  pagesScanned: number;
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  duration: number | null;
  pages: PageData[];
  standards: string[];
  whiteLabel?: WhiteLabelBranding | null;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const colors = {
  primary: "#8B5CF6",
  background: "#111827",
  cardBg: "#1F2937",
  text: "#F3F4F6",
  muted: "#9CA3AF",
  border: "#374151",
  critical: "#EF4444",
  serious: "#F97316",
  moderate: "#EAB308",
  minor: "#3B82F6",
  success: "#22C55E",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.white,
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  brandBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBox: {
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.white,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  brandName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 2,
  },
  headerValue: {
    fontSize: 10,
    color: "#1F2937",
  },
  // Title section
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6B7280",
  },
  // Score card
  scoreSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scoreCardLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  scoreCardValue: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  scoreCardSub: {
    fontSize: 8,
    color: "#9CA3AF",
    marginTop: 2,
  },
  // Severity breakdown
  severitySection: {
    marginBottom: 24,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityLabel: {
    fontSize: 9,
    color: "#6B7280",
    flex: 1,
  },
  severityCount: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  // Metadata
  metaRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  metaItem: {
    flexDirection: "row",
    gap: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: "#6B7280",
  },
  metaValue: {
    fontSize: 9,
    color: "#1F2937",
    fontFamily: "Helvetica-Bold",
  },
  // Section heading
  sectionHeading: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
    marginBottom: 12,
    marginTop: 8,
  },
  // Page card
  pageCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  pageUrl: {
    fontSize: 9,
    color: "#1F2937",
    fontFamily: "Helvetica-Bold",
    maxWidth: "70%",
  },
  pageScore: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  // Violation row
  violationRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  violationBadge: {
    width: 56,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignItems: "center",
  },
  violationBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    textTransform: "uppercase" as const,
  },
  violationContent: {
    flex: 1,
  },
  violationDesc: {
    fontSize: 9,
    color: "#1F2937",
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  violationMeta: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 2,
  },
  violationFix: {
    fontSize: 8,
    color: "#059669",
    marginTop: 4,
    backgroundColor: "#ECFDF5",
    padding: 6,
    borderRadius: 4,
  },
  // Exec summary
  readinessCard: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  readinessLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  readinessHeadline: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  readinessDetail: {
    fontSize: 10,
    color: "#1F2937",
  },
  execGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  execMetricCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  execMetricLabel: {
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  execMetricValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
  },
  execMetricSub: {
    fontSize: 8,
    color: "#9CA3AF",
    marginTop: 2,
  },
  topIssueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  topIssueRank: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#9CA3AF",
    width: 24,
  },
  topIssueContent: {
    flex: 1,
  },
  topIssueTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
    marginBottom: 2,
  },
  topIssueMeta: {
    fontSize: 8,
    color: "#6B7280",
  },
  topPageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topPageUrl: {
    fontSize: 9,
    color: "#1F2937",
    flex: 1,
    marginRight: 12,
  },
  topPageScore: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: "#9CA3AF",
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "#9CA3AF";
  if (score >= 90) return colors.success;
  if (score >= 70) return "#EAB308";
  if (score >= 50) return colors.serious;
  return colors.critical;
}

function severityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return colors.critical;
    case "SERIOUS": return colors.serious;
    case "MODERATE": return colors.moderate;
    case "MINOR": return colors.minor;
    default: return "#9CA3AF";
  }
}

function readinessPalette(readiness: ExecutiveSummary["readiness"]): {
  bg: string;
  border: string;
  text: string;
} {
  switch (readiness) {
    case "green":
      return { bg: "#F0FDF4", border: "#22C55E", text: "#166534" };
    case "amber":
      return { bg: "#FFFBEB", border: "#EAB308", text: "#854D0E" };
    case "red":
      return { bg: "#FEF2F2", border: "#EF4444", text: "#991B1B" };
    default:
      return { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151" };
  }
}

// ─── Components ─────────────────────────────────────────────────────────────

function ReportHeader({ data }: { data: ScanReportData }) {
  const brandName = data.whiteLabel?.companyName || "AccessKit";
  const brandColor = data.whiteLabel?.primaryColor || colors.primary;
  const initials = brandName.slice(0, 2).toUpperCase();

  return (
    <View style={{ ...styles.header, borderBottomColor: brandColor }}>
      <View style={styles.brandBox}>
        <View style={{ ...styles.logoBox, backgroundColor: brandColor }}>
          <Text style={styles.logoText}>{initials}</Text>
        </View>
        <Text style={styles.brandName}>{brandName}</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.headerLabel}>Organization</Text>
        <Text style={styles.headerValue}>{data.organizationName}</Text>
        <Text style={{ ...styles.headerLabel, marginTop: 6 }}>Generated</Text>
        <Text style={styles.headerValue}>{data.scanDate}</Text>
      </View>
    </View>
  );
}

function ScoreSection({ data }: { data: ScanReportData }) {
  return (
    <View style={styles.scoreSection}>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreCardLabel}>Accessibility Score</Text>
        <Text style={{ ...styles.scoreCardValue, color: scoreColor(data.score) }}>
          {data.score ?? "—"}
        </Text>
        <Text style={styles.scoreCardSub}>out of 100</Text>
      </View>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreCardLabel}>Total Issues</Text>
        <Text style={{ ...styles.scoreCardValue, color: data.totalViolations > 0 ? colors.critical : colors.success }}>
          {data.totalViolations}
        </Text>
        <Text style={styles.scoreCardSub}>across {data.pagesScanned} page{data.pagesScanned !== 1 ? "s" : ""}</Text>
      </View>
    </View>
  );
}

function SeverityBreakdown({ data }: { data: ScanReportData }) {
  const items = [
    { label: "Critical", count: data.criticalCount, color: colors.critical },
    { label: "Serious", count: data.seriousCount, color: colors.serious },
    { label: "Moderate", count: data.moderateCount, color: colors.moderate },
    { label: "Minor", count: data.minorCount, color: colors.minor },
  ];

  return (
    <View style={styles.severitySection}>
      <View style={styles.severityRow}>
        {items.map((item) => (
          <View key={item.label} style={styles.severityBadge}>
            <View style={{ ...styles.severityDot, backgroundColor: item.color }} />
            <Text style={styles.severityLabel}>{item.label}</Text>
            <Text style={{ ...styles.severityCount, color: item.count > 0 ? item.color : "#9CA3AF" }}>
              {item.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ViolationItem({ violation }: { violation: ViolationData }) {
  const bgColor = severityColor(violation.severity);
  return (
    <View style={styles.violationRow} wrap={false}>
      <View style={{ ...styles.violationBadge, backgroundColor: bgColor }}>
        <Text style={styles.violationBadgeText}>{violation.severity.toLowerCase()}</Text>
      </View>
      <View style={styles.violationContent}>
        <Text style={styles.violationDesc}>{violation.description}</Text>
        <Text style={styles.violationMeta}>
          {violation.ruleId}
          {violation.wcagCriterion ? ` · WCAG ${violation.wcagCriterion}` : ""}
          {violation.wcagLevel ? ` (Level ${violation.wcagLevel})` : ""}
        </Text>
        <Text style={styles.violationMeta}>{violation.cssSelector}</Text>
        {violation.fixSuggestion && (
          <Text style={styles.violationFix}>Fix: {violation.fixSuggestion}</Text>
        )}
      </View>
    </View>
  );
}

function PageSection({ page }: { page: PageData }) {
  return (
    <View style={styles.pageCard} wrap={false}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageUrl}>{page.title || page.url}</Text>
        <Text style={{ ...styles.pageScore, color: scoreColor(page.score) }}>
          {page.score ?? "—"} / 100
        </Text>
      </View>
      {page.violations.map((v, i) => (
        <ViolationItem key={i} violation={v} />
      ))}
    </View>
  );
}

// ─── Executive Summary Section ──────────────────────────────────────────────

function ReadinessCard({ summary }: { summary: ExecutiveSummary }) {
  const palette = readinessPalette(summary.readiness);
  return (
    <View
      style={{
        ...styles.readinessCard,
        backgroundColor: palette.bg,
        borderColor: palette.border,
      }}
    >
      <Text style={{ ...styles.readinessLabel, color: palette.text }}>Readiness</Text>
      <Text style={{ ...styles.readinessHeadline, color: palette.text }}>
        {summary.readinessLabel}
      </Text>
      <Text style={styles.readinessDetail}>{summary.readinessDetail}</Text>
    </View>
  );
}

function ExecMetrics({
  summary,
  data,
}: {
  summary: ExecutiveSummary;
  data: ScanReportData;
}) {
  const passRate = summary.wcagAAPassRate;
  return (
    <View style={styles.execGrid}>
      <View style={styles.execMetricCard}>
        <Text style={styles.execMetricLabel}>Pages passing AA</Text>
        <Text style={styles.execMetricValue}>
          {passRate === null ? "—" : `${passRate}%`}
        </Text>
        <Text style={styles.execMetricSub}>score ≥ 80</Text>
      </View>
      <View style={styles.execMetricCard}>
        <Text style={styles.execMetricLabel}>Pages with issues</Text>
        <Text style={styles.execMetricValue}>
          {summary.pagesWithIssues} / {summary.pagesScanned}
        </Text>
        <Text style={styles.execMetricSub}>of pages scanned</Text>
      </View>
      <View style={styles.execMetricCard}>
        <Text style={styles.execMetricLabel}>Critical + serious</Text>
        <Text style={{ ...styles.execMetricValue, color: data.criticalCount + data.seriousCount > 0 ? colors.critical : colors.success }}>
          {data.criticalCount + data.seriousCount}
        </Text>
        <Text style={styles.execMetricSub}>blocking issues</Text>
      </View>
    </View>
  );
}

function TopIssuesList({ summary }: { summary: ExecutiveSummary }) {
  if (summary.topIssues.length === 0) {
    return (
      <Text style={{ fontSize: 10, color: "#6B7280", marginBottom: 16 }}>
        No critical or serious issues detected — well done.
      </Text>
    );
  }
  return (
    <View style={{ ...styles.pageCard, marginBottom: 16 }}>
      {summary.topIssues.map((issue, i) => (
        <View key={issue.ruleId} style={styles.topIssueRow} wrap={false}>
          <Text style={styles.topIssueRank}>{i + 1}.</Text>
          <View style={styles.topIssueContent}>
            <Text style={styles.topIssueTitle}>{issue.description}</Text>
            <Text style={styles.topIssueMeta}>
              {issue.ruleId}
              {issue.wcagCriterion ? ` · WCAG ${issue.wcagCriterion}` : ""}
              {issue.wcagLevel ? ` (Level ${issue.wcagLevel})` : ""}
              {" · "}
              {issue.instances} instance{issue.instances === 1 ? "" : "s"} on {issue.pagesAffected} page{issue.pagesAffected === 1 ? "" : "s"}
            </Text>
          </View>
          <View
            style={{
              ...styles.violationBadge,
              backgroundColor: severityColor(issue.severity),
            }}
          >
            <Text style={styles.violationBadgeText}>{issue.severity.toLowerCase()}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TopPagesList({ summary }: { summary: ExecutiveSummary }) {
  if (summary.topPages.length === 0) return null;
  return (
    <View style={{ ...styles.pageCard, marginBottom: 16 }}>
      {summary.topPages.map((page) => (
        <View key={page.url} style={styles.topPageRow} wrap={false}>
          <Text style={styles.topPageUrl}>{page.title || page.url}</Text>
          <Text style={{ ...styles.topPageScore, color: scoreColor(page.score) }}>
            {page.score ?? "—"} · {page.violationCount} issue{page.violationCount === 1 ? "" : "s"}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Document ──────────────────────────────────────────────────────────

function ReportFooter({ data }: { data: ScanReportData }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Generated by {data.whiteLabel?.companyName || "AccessKit"}
        {!data.whiteLabel?.companyName ? " · accesskit.app" : ""}
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export function ScanReportPDF({ data }: { data: ScanReportData }) {
  const brandName = data.whiteLabel?.companyName || "AccessKit";
  const summary = buildExecSummary(data);

  return (
    <Document
      title={`Accessibility Report — ${data.websiteName}`}
      author={brandName}
      subject={`Scan report for ${data.websiteUrl}`}
    >
      {/* Executive summary page — designed for the one-page read */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} />

        <View style={styles.titleSection}>
          <Text style={styles.title}>Executive Summary</Text>
          <Text style={styles.subtitle}>{data.websiteName} — {data.websiteUrl}</Text>
        </View>

        <ReadinessCard summary={summary} />
        <ScoreSection data={data} />
        <ExecMetrics summary={summary} data={data} />

        <Text style={styles.sectionHeading}>Top issues to fix</Text>
        <TopIssuesList summary={summary} />

        {summary.topPages.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Pages needing attention</Text>
            <TopPagesList summary={summary} />
          </>
        )}

        <ReportFooter data={data} />
      </Page>

      {/* Full per-page drilldown page(s) */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} />

        <View style={styles.titleSection}>
          <Text style={styles.title}>Per-page detail</Text>
          <Text style={styles.subtitle}>All violations, grouped by page</Text>
        </View>

        <SeverityBreakdown data={data} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Pages scanned: </Text>
            <Text style={styles.metaValue}>{data.pagesScanned}</Text>
          </View>
          {data.duration && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration: </Text>
              <Text style={styles.metaValue}>{(data.duration / 1000).toFixed(1)}s</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Standards: </Text>
            <Text style={styles.metaValue}>{data.standards.join(", ")}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Issues by Page</Text>
        {data.pages.length === 0 ? (
          <Text style={{ fontSize: 10, color: "#6B7280" }}>
            No issues found — all pages passed the accessibility checks.
          </Text>
        ) : (
          data.pages.map((page, i) => <PageSection key={i} page={page} />)
        )}

        <ReportFooter data={data} />
      </Page>
    </Document>
  );
}
