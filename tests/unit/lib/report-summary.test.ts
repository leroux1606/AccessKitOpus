/**
 * Unit tests for the executive-summary extractor (M2).
 *
 * Locks in:
 *   - Readiness label/color derives cleanly from critical/serious counts and
 *     score — the PDF's top-of-page headline can't drift from the metric.
 *   - Top-3 issues are aggregated across pages, deduped by ruleId, and sorted
 *     by severity first, then instance count, then pages-affected — the intent
 *     is "biggest wins first, stable ordering under equal severity".
 *   - Top-5 pages surface the *lowest-scoring* pages with violations so
 *     remediation effort is directed where it matters.
 *   - AA pass-rate is null for unscored scans (no false 0%), otherwise the
 *     share of pages scoring ≥80.
 */

import { buildExecSummary, computeAAPassRate } from "@/lib/report-summary";
import type { ScanReportData } from "@/components/reports/pdf-template";

function makeReport(overrides: Partial<ScanReportData> = {}): ScanReportData {
  return {
    websiteName: "Acme",
    websiteUrl: "https://acme.com",
    organizationName: "Acme Inc.",
    scanDate: "2026-04-17",
    score: 85,
    pagesScanned: 3,
    totalViolations: 5,
    criticalCount: 0,
    seriousCount: 2,
    moderateCount: 2,
    minorCount: 1,
    duration: 12_345,
    standards: ["WCAG_22_AA"],
    pages: [],
    whiteLabel: null,
    ...overrides,
  };
}

function makePage(
  url: string,
  score: number | null,
  violations: Array<{ ruleId: string; severity: string }> = [],
) {
  return {
    url,
    title: null,
    score,
    violationCount: violations.length,
    violations: violations.map((v) => ({
      severity: v.severity,
      description: `${v.ruleId} description`,
      ruleId: v.ruleId,
      wcagCriterion: "1.1.1",
      wcagLevel: "A",
      helpText: "",
      cssSelector: "body",
      fixSuggestion: null,
      category: "CONTENT",
    })),
  };
}

describe("buildExecSummary — readiness", () => {
  it("is red whenever critical > 0, regardless of score", () => {
    const r = buildExecSummary(makeReport({ criticalCount: 1, seriousCount: 0, score: 95 }));
    expect(r.readiness).toBe("red");
    expect(r.readinessLabel).toBe("Not ready");
    expect(r.readinessDetail).toMatch(/1 critical violation/);
  });

  it("is amber when serious > 0 and critical = 0", () => {
    const r = buildExecSummary(makeReport({ criticalCount: 0, seriousCount: 3, score: 85 }));
    expect(r.readiness).toBe("amber");
    expect(r.readinessDetail).toMatch(/3 serious issues/);
  });

  it("is amber when score < 80 even without serious issues", () => {
    const r = buildExecSummary(makeReport({ criticalCount: 0, seriousCount: 0, score: 72 }));
    expect(r.readiness).toBe("amber");
  });

  it("is green when no critical, no serious, score >= 80", () => {
    const r = buildExecSummary(makeReport({ criticalCount: 0, seriousCount: 0, score: 95 }));
    expect(r.readiness).toBe("green");
    expect(r.readinessLabel).toBe("WCAG ready");
  });

  it("is unknown when unscored (score null + no violations)", () => {
    const r = buildExecSummary(
      makeReport({ score: null, criticalCount: 0, seriousCount: 0, totalViolations: 0 }),
    );
    expect(r.readiness).toBe("unknown");
  });
});

describe("buildExecSummary — top issues", () => {
  it("aggregates instances across pages and returns at most 3", () => {
    const pages = [
      makePage("/a", 50, [
        { ruleId: "image-alt", severity: "CRITICAL" },
        { ruleId: "image-alt", severity: "CRITICAL" },
        { ruleId: "label", severity: "SERIOUS" },
      ]),
      makePage("/b", 60, [
        { ruleId: "image-alt", severity: "CRITICAL" },
        { ruleId: "color-contrast", severity: "SERIOUS" },
        { ruleId: "button-name", severity: "SERIOUS" },
      ]),
    ];
    const r = buildExecSummary(makeReport({ pages, pagesScanned: 2 }));
    expect(r.topIssues).toHaveLength(3);
    const imageAlt = r.topIssues.find((t) => t.ruleId === "image-alt");
    expect(imageAlt?.instances).toBe(3);
    expect(imageAlt?.pagesAffected).toBe(2);
  });

  it("sorts critical before serious, then by instance count", () => {
    const pages = [
      makePage("/a", 50, [
        { ruleId: "color-contrast", severity: "SERIOUS" },
        { ruleId: "color-contrast", severity: "SERIOUS" },
        { ruleId: "color-contrast", severity: "SERIOUS" },
        { ruleId: "color-contrast", severity: "SERIOUS" },
        { ruleId: "color-contrast", severity: "SERIOUS" },
        { ruleId: "image-alt", severity: "CRITICAL" },
      ]),
    ];
    const r = buildExecSummary(makeReport({ pages, pagesScanned: 1 }));
    expect(r.topIssues[0]?.ruleId).toBe("image-alt");
    expect(r.topIssues[0]?.severity).toBe("CRITICAL");
  });

  it("excludes MODERATE and MINOR from top issues", () => {
    const pages = [
      makePage("/a", 50, [
        { ruleId: "minor-thing", severity: "MINOR" },
        { ruleId: "moderate-thing", severity: "MODERATE" },
      ]),
    ];
    const r = buildExecSummary(makeReport({ pages }));
    expect(r.topIssues).toHaveLength(0);
  });

  it("is deterministic under equal (severity, instances, pagesAffected)", () => {
    const pages = [
      makePage("/a", 50, [
        { ruleId: "zzz-rule", severity: "SERIOUS" },
        { ruleId: "aaa-rule", severity: "SERIOUS" },
      ]),
    ];
    const r1 = buildExecSummary(makeReport({ pages }));
    const r2 = buildExecSummary(makeReport({ pages }));
    expect(r1.topIssues.map((i) => i.ruleId)).toEqual(r2.topIssues.map((i) => i.ruleId));
    // Alphabetical tie-break keeps "aaa-rule" ahead of "zzz-rule".
    expect(r1.topIssues[0]?.ruleId).toBe("aaa-rule");
  });
});

describe("buildExecSummary — top pages", () => {
  it("returns at most 5 pages, lowest-scoring first", () => {
    const pages = [
      makePage("/a", 80, [{ ruleId: "x", severity: "MINOR" }]),
      makePage("/b", 50, [{ ruleId: "x", severity: "CRITICAL" }]),
      makePage("/c", 20, [{ ruleId: "x", severity: "CRITICAL" }]),
      makePage("/d", 70, [{ ruleId: "x", severity: "SERIOUS" }]),
      makePage("/e", 40, [{ ruleId: "x", severity: "CRITICAL" }]),
      makePage("/f", 10, [{ ruleId: "x", severity: "CRITICAL" }]),
    ];
    const r = buildExecSummary(makeReport({ pages, pagesScanned: 6 }));
    expect(r.topPages.map((p) => p.url)).toEqual(["/f", "/c", "/e", "/b", "/d"]);
  });

  it("excludes pages with zero violations (nothing to fix)", () => {
    const pages = [
      makePage("/a", 100, []),
      makePage("/b", 50, [{ ruleId: "x", severity: "CRITICAL" }]),
    ];
    const r = buildExecSummary(makeReport({ pages, pagesScanned: 2 }));
    expect(r.topPages).toHaveLength(1);
    expect(r.topPages[0]?.url).toBe("/b");
  });

  it("tie-breaks by violation count then URL so ordering is stable", () => {
    const pages = [
      makePage("/b", 50, [{ ruleId: "x", severity: "CRITICAL" }, { ruleId: "y", severity: "SERIOUS" }]),
      makePage("/a", 50, [{ ruleId: "x", severity: "CRITICAL" }]),
      makePage("/c", 50, [{ ruleId: "x", severity: "CRITICAL" }]),
    ];
    const r = buildExecSummary(makeReport({ pages, pagesScanned: 3 }));
    // /b has most violations → first; then alphabetical between /a and /c.
    expect(r.topPages.map((p) => p.url)).toEqual(["/b", "/a", "/c"]);
  });
});

describe("buildExecSummary — AA pass-rate", () => {
  it("null when every page is unscored", () => {
    const pages = [makePage("/a", null), makePage("/b", null)];
    expect(computeAAPassRate(makeReport({ pages }))).toBeNull();
  });

  it("100% when every scored page is >= 80", () => {
    const pages = [makePage("/a", 80), makePage("/b", 100), makePage("/c", null)];
    expect(computeAAPassRate(makeReport({ pages }))).toBe(100);
  });

  it("correct fractional share when mixed", () => {
    const pages = [makePage("/a", 80), makePage("/b", 50), makePage("/c", 40), makePage("/d", 90)];
    expect(computeAAPassRate(makeReport({ pages }))).toBe(50);
  });
});

describe("buildExecSummary — aggregate stats", () => {
  it("counts pagesWithIssues and pagesScanned independently", () => {
    const pages = [
      makePage("/a", 100, []),
      makePage("/b", 80, [{ ruleId: "x", severity: "CRITICAL" }]),
      makePage("/c", 60, [{ ruleId: "y", severity: "SERIOUS" }]),
    ];
    const r = buildExecSummary(makeReport({ pages, pagesScanned: 3 }));
    expect(r.pagesScanned).toBe(3);
    expect(r.pagesWithIssues).toBe(2);
  });
});
