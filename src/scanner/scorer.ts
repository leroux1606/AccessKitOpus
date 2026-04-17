import type { PageScanResult } from "@/types/scan";

/**
 * Weighted penalty formula: critical×10, serious×5, moderate×2, minor×1
 * Score = max(0, 100 − totalWeightedPenalty)
 */
export function calculateScore(
  critical: number,
  serious: number,
  moderate: number,
  minor: number,
): number {
  const penalty = critical * 10 + serious * 5 + moderate * 2 + minor;
  return Math.max(0, 100 - penalty);
}

export function addPageScores(pages: PageScanResult[]): PageScanResult[] {
  return pages.map((page) => {
    let critical = 0, serious = 0, moderate = 0, minor = 0;
    for (const v of page.violations) {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "SERIOUS") serious++;
      else if (v.severity === "MODERATE") moderate++;
      else if (v.severity === "MINOR") minor++;
    }
    return { ...page, score: calculateScore(critical, serious, moderate, minor) };
  });
}
