import { calculateScore, addPageScores } from "@/scanner/scorer";
import type { PageScanResult, ScanViolation } from "@/types/scan";

// Minimal violation stub for building PageScanResult fixtures
const makeViolation = (
  severity: "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR",
): ScanViolation => ({
  ruleId: "test-rule",
  engine: "AXE_CORE",
  severity,
  impact: severity.toLowerCase(),
  category: "STRUCTURE",
  standards: [] as string[],
  description: "test",
  helpText: "test",
  htmlElement: "<div>",
  cssSelector: "div",
  effortEstimate: "LOW",
  fingerprint: "abc123",
});

const makePage = (violations: ReturnType<typeof makeViolation>[]): PageScanResult => ({
  url: "https://example.com",
  title: "Home",
  loadTime: 100,
  score: 0,
  violations,
});

// ─── calculateScore ───────────────────────────────────────────────────────────

describe("calculateScore", () => {
  it("returns 100 for a page with no violations", () => {
    expect(calculateScore(0, 0, 0, 0)).toBe(100);
  });

  it("applies critical weight of 10", () => {
    expect(calculateScore(1, 0, 0, 0)).toBe(90);
    expect(calculateScore(5, 0, 0, 0)).toBe(50);
  });

  it("applies serious weight of 5", () => {
    expect(calculateScore(0, 1, 0, 0)).toBe(95);
    expect(calculateScore(0, 4, 0, 0)).toBe(80);
  });

  it("applies moderate weight of 2", () => {
    expect(calculateScore(0, 0, 1, 0)).toBe(98);
    expect(calculateScore(0, 0, 10, 0)).toBe(80);
  });

  it("applies minor weight of 1", () => {
    expect(calculateScore(0, 0, 0, 1)).toBe(99);
    expect(calculateScore(0, 0, 0, 10)).toBe(90);
  });

  it("combines all severity penalties correctly", () => {
    // 1×10 + 2×5 + 3×2 + 4×1 = 10+10+6+4 = 30 → 70
    expect(calculateScore(1, 2, 3, 4)).toBe(70);
  });

  it("clamps at 0 — never returns negative", () => {
    expect(calculateScore(100, 100, 100, 100)).toBe(0);
    expect(calculateScore(11, 0, 0, 0)).toBe(0); // 110 penalty > 100
  });
});

// ─── addPageScores ────────────────────────────────────────────────────────────

describe("addPageScores", () => {
  it("sets score on a page with no violations to 100", () => {
    const results = addPageScores([makePage([])]);
    const result = results[0]!;
    expect(result.score).toBe(100);
  });

  it("calculates per-page score from violation severities", () => {
    // 1 critical (10) + 1 minor (1) = 11 → 89
    const results = addPageScores([
      makePage([makeViolation("CRITICAL"), makeViolation("MINOR")]),
    ]);
    const result = results[0]!;
    expect(result.score).toBe(89);
  });

  it("does not mutate the original violations array", () => {
    const page = makePage([makeViolation("SERIOUS")]);
    const results = addPageScores([page]);
    const result = results[0]!;
    expect(result.violations).toBe(page.violations); // same reference
    expect(result.score).toBe(95);
  });

  it("processes multiple pages independently", () => {
    const pages = [
      makePage([makeViolation("CRITICAL")]), // 90
      makePage([]),                           // 100
      makePage([makeViolation("MODERATE"), makeViolation("MODERATE")]), // 96
    ];
    const results = addPageScores(pages);
    expect(results.map((p) => p.score)).toEqual([90, 100, 96]);
  });
});
