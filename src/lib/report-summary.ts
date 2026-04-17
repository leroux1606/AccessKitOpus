/**
 * Executive-summary extraction for PDF reports (M2).
 *
 * Turns a raw `ScanReportData` payload into a denser "what decision-makers
 * need to see first" shape:
 *
 *   - Top 3 critical/serious issues by instance count across the whole scan.
 *   - Readiness posture (severity pass-rate → simple green/amber/red label).
 *   - The pages that most drag the score down, so a reader can jump straight
 *     to the biggest wins.
 *
 * All logic is pure and synchronous so it can be unit-tested without touching
 * the PDF renderer, Prisma, or the network.
 */

import type { ScanReportData } from "@/components/reports/pdf-template";

export type Readiness = "green" | "amber" | "red" | "unknown";

export interface TopIssue {
  ruleId: string;
  description: string;
  severity: string;
  instances: number;
  pagesAffected: number;
  wcagCriterion: string | null;
  wcagLevel: string | null;
}

export interface TopPage {
  url: string;
  title: string | null;
  score: number | null;
  violationCount: number;
}

export interface ExecutiveSummary {
  readiness: Readiness;
  readinessLabel: string;
  readinessDetail: string;
  /** Percentage of AA-level checks passed, 0–100, or null when no data. */
  wcagAAPassRate: number | null;
  topIssues: TopIssue[];
  topPages: TopPage[];
  /** Total pages with at least one violation. */
  pagesWithIssues: number;
  /** Total pages scanned. */
  pagesScanned: number;
}

const MAX_TOP_ISSUES = 3;
const MAX_TOP_PAGES = 5;

/**
 * Compute the executive summary from a scan report.
 *
 * Contract:
 *  - Never throws. Missing / null / empty fields degrade to "unknown" or 0.
 *  - Deterministic: same input → same output (stable sort + tie-break on ruleId).
 */
export function buildExecSummary(data: ScanReportData): ExecutiveSummary {
  const readiness = computeReadiness(
    data.criticalCount,
    data.seriousCount,
    data.totalViolations,
    data.score,
  );

  const pagesWithIssues = data.pages.filter((p) => p.violationCount > 0).length;

  return {
    readiness: readiness.value,
    readinessLabel: readiness.label,
    readinessDetail: readiness.detail,
    wcagAAPassRate: computeAAPassRate(data),
    topIssues: computeTopIssues(data),
    topPages: computeTopPages(data),
    pagesWithIssues,
    pagesScanned: data.pagesScanned,
  };
}

// ─── Readiness ────────────────────────────────────────────────────────────────

interface ReadinessResult {
  value: Readiness;
  label: string;
  detail: string;
}

function computeReadiness(
  critical: number,
  serious: number,
  total: number,
  score: number | null,
): ReadinessResult {
  if (score === null && total === 0) {
    return {
      value: "unknown",
      label: "Not yet scored",
      detail: "Run a scan to establish a baseline.",
    };
  }

  if (critical > 0) {
    return {
      value: "red",
      label: "Not ready",
      detail: `${critical} critical violation${critical === 1 ? "" : "s"} must be fixed before publishing a VPAT.`,
    };
  }

  if (serious > 0 || (score !== null && score < 80)) {
    return {
      value: "amber",
      label: "Close to compliant",
      detail:
        serious > 0
          ? `${serious} serious issue${serious === 1 ? "" : "s"} remain — likely WCAG AA blockers.`
          : "Score is below the 80-point WCAG readiness threshold.",
    };
  }

  return {
    value: "green",
    label: "WCAG ready",
    detail: "No critical or serious issues across scanned pages.",
  };
}

// ─── WCAG AA pass-rate ────────────────────────────────────────────────────────

/**
 * Approximate AA pass-rate from the scan's severity buckets.
 *
 * We don't have per-success-criterion data in the aggregated report shape,
 * but we can give a useful proxy: the share of pages whose score is at or
 * above 80. An "AA-ready" page is widely treated as 80+ internally; pages
 * below that threshold almost always have a critical or serious AA-level
 * violation. Null when there are no scored pages.
 */
export function computeAAPassRate(data: ScanReportData): number | null {
  const scored = data.pages.filter((p) => p.score !== null);
  if (scored.length === 0) return null;

  const passing = scored.filter((p) => (p.score ?? 0) >= 80).length;
  return Math.round((passing / scored.length) * 100);
}

// ─── Top issues (by aggregated instance count) ───────────────────────────────

function computeTopIssues(data: ScanReportData): TopIssue[] {
  const byRule = new Map<string, TopIssue>();

  for (const page of data.pages) {
    const perPageRules = new Set<string>();
    for (const v of page.violations) {
      if (v.severity !== "CRITICAL" && v.severity !== "SERIOUS") continue;

      perPageRules.add(v.ruleId);
      const existing = byRule.get(v.ruleId);
      if (existing) {
        existing.instances += 1;
      } else {
        byRule.set(v.ruleId, {
          ruleId: v.ruleId,
          description: v.description,
          severity: v.severity,
          instances: 1,
          pagesAffected: 0,
          wcagCriterion: v.wcagCriterion,
          wcagLevel: v.wcagLevel,
        });
      }
    }
    for (const ruleId of perPageRules) {
      const entry = byRule.get(ruleId);
      if (entry) entry.pagesAffected += 1;
    }
  }

  const SEVERITY_RANK: Record<string, number> = {
    CRITICAL: 0,
    SERIOUS: 1,
    MODERATE: 2,
    MINOR: 3,
  };

  return Array.from(byRule.values())
    .sort((a, b) => {
      const sevDelta = (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99);
      if (sevDelta !== 0) return sevDelta;
      if (b.instances !== a.instances) return b.instances - a.instances;
      if (b.pagesAffected !== a.pagesAffected) return b.pagesAffected - a.pagesAffected;
      return a.ruleId.localeCompare(b.ruleId);
    })
    .slice(0, MAX_TOP_ISSUES);
}

// ─── Top pages (worst-scoring, with at least one violation) ───────────────────

function computeTopPages(data: ScanReportData): TopPage[] {
  return [...data.pages]
    .filter((p) => p.violationCount > 0)
    .sort((a, b) => {
      // Lowest score first — that's where the biggest wins are.
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      // Tie-break: more violations first.
      if (b.violationCount !== a.violationCount) return b.violationCount - a.violationCount;
      return a.url.localeCompare(b.url);
    })
    .slice(0, MAX_TOP_PAGES)
    .map((p) => ({
      url: p.url,
      title: p.title,
      score: p.score,
      violationCount: p.violationCount,
    }));
}
