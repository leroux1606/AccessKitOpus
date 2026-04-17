import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── WCAG 2.1 AA Criteria ──────────────────────────────────────────────────

const WCAG_CRITERIA = [
  { id: "1.1.1", name: "Non-text Content", level: "A", principle: "Perceivable" },
  { id: "1.2.1", name: "Audio-only and Video-only (Prerecorded)", level: "A", principle: "Perceivable" },
  { id: "1.2.2", name: "Captions (Prerecorded)", level: "A", principle: "Perceivable" },
  { id: "1.2.3", name: "Audio Description or Media Alternative", level: "A", principle: "Perceivable" },
  { id: "1.2.5", name: "Audio Description (Prerecorded)", level: "AA", principle: "Perceivable" },
  { id: "1.3.1", name: "Info and Relationships", level: "A", principle: "Perceivable" },
  { id: "1.3.2", name: "Meaningful Sequence", level: "A", principle: "Perceivable" },
  { id: "1.3.3", name: "Sensory Characteristics", level: "A", principle: "Perceivable" },
  { id: "1.4.1", name: "Use of Color", level: "A", principle: "Perceivable" },
  { id: "1.4.2", name: "Audio Control", level: "A", principle: "Perceivable" },
  { id: "1.4.3", name: "Contrast (Minimum)", level: "AA", principle: "Perceivable" },
  { id: "1.4.4", name: "Resize Text", level: "AA", principle: "Perceivable" },
  { id: "1.4.5", name: "Images of Text", level: "AA", principle: "Perceivable" },
  { id: "2.1.1", name: "Keyboard", level: "A", principle: "Operable" },
  { id: "2.1.2", name: "No Keyboard Trap", level: "A", principle: "Operable" },
  { id: "2.2.1", name: "Timing Adjustable", level: "A", principle: "Operable" },
  { id: "2.2.2", name: "Pause, Stop, Hide", level: "A", principle: "Operable" },
  { id: "2.3.1", name: "Three Flashes or Below Threshold", level: "A", principle: "Operable" },
  { id: "2.4.1", name: "Bypass Blocks", level: "A", principle: "Operable" },
  { id: "2.4.2", name: "Page Titled", level: "A", principle: "Operable" },
  { id: "2.4.3", name: "Focus Order", level: "A", principle: "Operable" },
  { id: "2.4.4", name: "Link Purpose (In Context)", level: "A", principle: "Operable" },
  { id: "2.4.5", name: "Multiple Ways", level: "AA", principle: "Operable" },
  { id: "2.4.6", name: "Headings and Labels", level: "AA", principle: "Operable" },
  { id: "2.4.7", name: "Focus Visible", level: "AA", principle: "Operable" },
  { id: "3.1.1", name: "Language of Page", level: "A", principle: "Understandable" },
  { id: "3.1.2", name: "Language of Parts", level: "AA", principle: "Understandable" },
  { id: "3.2.1", name: "On Focus", level: "A", principle: "Understandable" },
  { id: "3.2.2", name: "On Input", level: "A", principle: "Understandable" },
  { id: "3.2.3", name: "Consistent Navigation", level: "AA", principle: "Understandable" },
  { id: "3.2.4", name: "Consistent Identification", level: "AA", principle: "Understandable" },
  { id: "3.3.1", name: "Error Identification", level: "A", principle: "Understandable" },
  { id: "3.3.2", name: "Labels or Instructions", level: "A", principle: "Understandable" },
  { id: "3.3.3", name: "Error Suggestion", level: "AA", principle: "Understandable" },
  { id: "3.3.4", name: "Error Prevention (Legal, Financial, Data)", level: "AA", principle: "Understandable" },
  { id: "4.1.1", name: "Parsing", level: "A", principle: "Robust" },
  { id: "4.1.2", name: "Name, Role, Value", level: "A", principle: "Robust" },
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VpatReportData {
  websiteName: string;
  websiteUrl: string;
  organizationName: string;
  reportDate: string;
  evaluationPeriod: string;
  score: number | null;
  totalViolations: number;
  scansCount: number;
  violationsByCriterion: Record<string, number>;
  fixedByCriterion: Record<string, number>;
  whiteLabel?: { companyName?: string | null; primaryColor?: string | null } | null;
}

type ConformanceLevel = "Supports" | "Partially Supports" | "Does Not Support" | "Not Evaluated";

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF", padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#1F2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: "#8B5CF6" },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { fontSize: 8, color: "#6B7280", marginBottom: 2 },
  headerValue: { fontSize: 9 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6B7280", marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, color: "#1F2937" },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 6, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  summaryLabel: { fontSize: 7, color: "#6B7280", textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  // Table
  tableHeader: { flexDirection: "row", backgroundColor: "#F3F4F6", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  colCriterion: { width: "12%", fontSize: 8, fontFamily: "Helvetica-Bold" },
  colName: { width: "32%", fontSize: 8 },
  colLevel: { width: "8%", fontSize: 8, textAlign: "center" as const },
  colConformance: { width: "22%", fontSize: 8 },
  colRemarks: { width: "26%", fontSize: 7, color: "#6B7280" },
  thText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6B7280", textTransform: "uppercase" as const },
  // Conformance badge
  supports: { color: "#059669" },
  partial: { color: "#D97706" },
  doesNot: { color: "#DC2626" },
  notEval: { color: "#9CA3AF" },
  // Disclaimer
  disclaimer: { marginTop: 20, padding: 12, backgroundColor: "#FEF3C7", borderRadius: 6, borderWidth: 1, borderColor: "#FDE68A" },
  disclaimerText: { fontSize: 8, color: "#92400E", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8 },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getConformance(
  criterionId: string,
  violations: Record<string, number>,
  fixed: Record<string, number>,
): ConformanceLevel {
  const violationCount = violations[criterionId] ?? 0;
  const fixedCount = fixed[criterionId] ?? 0;

  if (violationCount === 0) return "Supports";
  if (fixedCount >= violationCount) return "Supports";
  if (fixedCount > 0) return "Partially Supports";
  return "Does Not Support";
}

function conformanceStyle(level: ConformanceLevel) {
  switch (level) {
    case "Supports": return s.supports;
    case "Partially Supports": return s.partial;
    case "Does Not Support": return s.doesNot;
    default: return s.notEval;
  }
}

// ─── Document ───────────────────────────────────────────────────────────────

export function VpatReportPDF({ data }: { data: VpatReportData }) {
  const brandName = data.whiteLabel?.companyName || "AccessKit";
  const brandColor = data.whiteLabel?.primaryColor || "#8B5CF6";

  const criterionConformance = WCAG_CRITERIA.map((c) => ({
    ...c,
    conformance: getConformance(c.id, data.violationsByCriterion, data.fixedByCriterion),
    violations: data.violationsByCriterion[c.id] ?? 0,
    fixed: data.fixedByCriterion[c.id] ?? 0,
  }));

  const supportsCount = criterionConformance.filter((c) => c.conformance === "Supports").length;
  const partialCount = criterionConformance.filter((c) => c.conformance === "Partially Supports").length;
  const doesNotCount = criterionConformance.filter((c) => c.conformance === "Does Not Support").length;

  return (
    <Document title={`VPAT — ${data.websiteName}`} author={brandName}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={{ ...s.header, borderBottomColor: brandColor }}>
          <View>
            <Text style={s.brandName}>{brandName}</Text>
            <Text style={{ fontSize: 8, color: "#6B7280", marginTop: 2 }}>Accessibility Conformance Report</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerLabel}>Report Date</Text>
            <Text style={s.headerValue}>{data.reportDate}</Text>
            <Text style={{ ...s.headerLabel, marginTop: 4 }}>Evaluation Period</Text>
            <Text style={s.headerValue}>{data.evaluationPeriod}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={s.title}>VPAT Compliance Report</Text>
        <Text style={s.subtitle}>{data.websiteName} — {data.websiteUrl}</Text>

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Score</Text>
            <Text style={{ ...s.summaryValue, color: (data.score ?? 0) >= 90 ? "#059669" : (data.score ?? 0) >= 70 ? "#D97706" : "#DC2626" }}>
              {data.score ?? "—"}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Criteria Met</Text>
            <Text style={{ ...s.summaryValue, color: "#059669" }}>{supportsCount}/{WCAG_CRITERIA.length}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Partial</Text>
            <Text style={{ ...s.summaryValue, color: "#D97706" }}>{partialCount}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Not Met</Text>
            <Text style={{ ...s.summaryValue, color: "#DC2626" }}>{doesNotCount}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>WCAG 2.1 Level A & AA Conformance</Text>
          <Text style={{ fontSize: 8, color: "#6B7280", marginBottom: 8 }}>
            Based on {data.scansCount} scan{data.scansCount !== 1 ? "s" : ""} · {data.totalViolations} total violations detected
          </Text>

          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={{ ...s.thText, ...s.colCriterion }}>Criterion</Text>
            <Text style={{ ...s.thText, ...s.colName }}>Name</Text>
            <Text style={{ ...s.thText, ...s.colLevel }}>Level</Text>
            <Text style={{ ...s.thText, ...s.colConformance }}>Conformance</Text>
            <Text style={{ ...s.thText, ...s.colRemarks }}>Remarks</Text>
          </View>

          {criterionConformance.map((c) => (
            <View key={c.id} style={s.tableRow} wrap={false}>
              <Text style={s.colCriterion}>{c.id}</Text>
              <Text style={s.colName}>{c.name}</Text>
              <Text style={s.colLevel}>{c.level}</Text>
              <Text style={{ ...s.colConformance, ...conformanceStyle(c.conformance) }}>
                {c.conformance}
              </Text>
              <Text style={s.colRemarks}>
                {c.violations > 0
                  ? `${c.violations} issue${c.violations > 1 ? "s" : ""} found${c.fixed > 0 ? `, ${c.fixed} fixed` : ""}`
                  : "No issues detected"}
              </Text>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            DISCLAIMER: This report is generated by automated accessibility scanning and provides a baseline assessment only.
            Automated tools typically detect 30-40% of all accessibility issues. Manual testing with assistive technologies
            is required for full WCAG conformance evaluation. This document does not constitute legal compliance certification.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by {brandName}{!data.whiteLabel?.companyName ? " · accesskit.app" : ""}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
