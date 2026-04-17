import type { Category, EffortLevel, Engine, Severity } from "@prisma/client";

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
  score: number;
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
