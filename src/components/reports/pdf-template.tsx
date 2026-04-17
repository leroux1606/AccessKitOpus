import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

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

// ─── Main Document ──────────────────────────────────────────────────────────

export function ScanReportPDF({ data }: { data: ScanReportData }) {
  const brandName = data.whiteLabel?.companyName || "AccessKit";

  return (
    <Document
      title={`Accessibility Report — ${data.websiteName}`}
      author={brandName}
      subject={`Scan report for ${data.websiteUrl}`}
    >
      {/* Summary page */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} />

        <View style={styles.titleSection}>
          <Text style={styles.title}>Accessibility Report</Text>
          <Text style={styles.subtitle}>{data.websiteName} — {data.websiteUrl}</Text>
        </View>

        <ScoreSection data={data} />
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

        {/* Issues by page */}
        <Text style={styles.sectionHeading}>Issues by Page</Text>
        {data.pages.length === 0 ? (
          <Text style={{ fontSize: 10, color: "#6B7280" }}>
            No issues found — all pages passed the accessibility checks.
          </Text>
        ) : (
          data.pages.map((page, i) => (
            <PageSection key={i} page={page} />
          ))
        )}

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
      </Page>
    </Document>
  );
}
