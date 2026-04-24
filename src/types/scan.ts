import type { Category, EffortLevel, Engine, Severity } from "@prisma/client";

/**
 * Load status of a scanned page. Mirrors the `PageStatus` enum in
 * `schema.prisma` — declared locally as a string union so type-checking
 * still passes when `prisma generate` has not yet been re-run after a
 * schema change. The string values must stay in sync with the enum.
 */
export type PageStatus = "OK" | "UNREACHABLE" | "ERROR";

export type ScanViolation = {
  ruleId: string;
  engine: Engine;
  severity: Severity;
  impact: string;
  category: Category;
  standards: string[];
  wcagCriterion?: string;
  wcagLevel?: string;
  description: string;
  helpText: string;
  helpUrl?: string;
  htmlElement: string;
  cssSelector: string;
  xpath?: string;
  fixSuggestion?: string;
  effortEstimate: EffortLevel;
  fingerprint: string;
};

export type PageScanResult = {
  url: string;
  title: string;
  loadTime: number;
  violations: ScanViolation[];
  /**
   * 0-100 accessibility score. `null` when the page could not be evaluated
   * (unreachable / navigation error) — those pages are excluded from the
   * site-wide score so a broken page does not get credited as "perfect".
   */
  score: number | null;
  /**
   * Load status of the page itself. `OK` = page loaded with 2xx/3xx.
   * `UNREACHABLE` = server returned 4xx/5xx. `ERROR` = navigation failed
   * (DNS, timeout, crash). Only `OK` pages are scanned by axe and scored.
   */
  status: PageStatus;
  /** HTTP status code observed on the main navigation response, if any. */
  statusCode?: number | null;
  /** Human-readable error message for non-OK pages. */
  errorMessage?: string | null;
  /**
   * Public URL of the page screenshot uploaded to Cloudflare R2, or
   * `null` / `undefined` when screenshots are disabled (no R2 config,
   * opt-out flag set) or the upload failed. Never blocks a scan —
   * treated as a best-effort enhancement for reports.
   */
  screenshotUrl?: string | null;
};

export type ScanResult = {
  pages: PageScanResult[];
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  score: number;
  duration: number;
};

export type ScanEventData = {
  scanId: string;
  websiteId: string;
  organizationId: string;
  websiteUrl: string;
  pageLimit: number;
  standards: string[];
};
