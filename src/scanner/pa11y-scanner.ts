import type { ScanViolation, PageScanResult } from "@/types/scan";
import {
  mapTagsToCategory,
  mapTagsToStandards,
  extractWcagCriterion,
  extractWcagLevel,
} from "./standards-mapper";
import { generateFixSuggestion, estimateEffort } from "./fix-generator";
import { generateFingerprint } from "./deduplicator";

interface Pa11yIssue {
  code: string;
  type: "error" | "warning" | "notice";
  typeCode: number;
  message: string;
  context: string;
  selector: string;
  runner: string;
}

function mapPa11yTypeToSeverity(type: string): "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR" {
  switch (type) {
    case "error": return "SERIOUS";
    case "warning": return "MODERATE";
    case "notice": return "MINOR";
    default: return "MODERATE";
  }
}

function extractWcagFromCode(code: string): { tags: string[]; criterion: string | null; level: string | null } {
  // pa11y codes look like: WCAG2AA.Principle1.Guideline1_1.1_1_1.H37
  const tags: string[] = [];
  let criterion: string | null = null;
  let level: string | null = null;

  if (code.includes("WCAG2AAA")) {
    tags.push("wcag2aaa");
    level = "AAA";
  } else if (code.includes("WCAG2AA")) {
    tags.push("wcag2aa");
    level = "AA";
  } else if (code.includes("WCAG2A")) {
    tags.push("wcag2a");
    level = "A";
  }

  // Extract criterion like 1_1_1 → 1.1.1
  const criterionMatch = code.match(/Guideline\d+_\d+\.(\d+_\d+_\d+)/);
  if (criterionMatch) {
    criterion = criterionMatch[1]?.replace(/_/g, ".") ?? null;
  }

  return { tags, criterion, level };
}

/**
 * Scan a single page using pa11y.
 * Returns results in the same ScanViolation format as axe-core scanner.
 */
export async function scanPageWithPa11y(
  url: string,
  websiteOrigin: string,
): Promise<PageScanResult> {
  try {
    const pa11y = (await import("pa11y")).default;

    const results = await pa11y(url, {
      standard: "WCAG2AA",
      timeout: 30000,
      wait: 1000,
      ignore: [
        "notice", // Ignore notices to reduce noise — focus on errors and warnings
      ],
    });

    const violations: ScanViolation[] = (results.issues as Pa11yIssue[]).map((issue) => {
      const { tags, criterion, level } = extractWcagFromCode(issue.code);
      const ruleId = `pa11y-${issue.code.split(".").pop() || issue.code}`;
      const severity = mapPa11yTypeToSeverity(issue.type);
      const category = mapTagsToCategory(tags);
      const standards = mapTagsToStandards(tags);

      return {
        ruleId,
        engine: "PA11Y" as const,
        severity,
        impact: issue.type,
        category,
        standards,
        wcagCriterion: criterion ?? extractWcagCriterion(tags),
        wcagLevel: level ?? extractWcagLevel(tags),
        description: issue.message,
        helpText: `pa11y rule: ${issue.code}`,
        helpUrl: undefined,
        htmlElement: issue.context || "",
        cssSelector: issue.selector,
        xpath: undefined,
        fixSuggestion: generateFixSuggestion(ruleId),
        effortEstimate: estimateEffort(ruleId),
        fingerprint: generateFingerprint(ruleId, issue.selector, websiteOrigin),
      };
    });

    // pa11y doesn't return a score — will be merged with axe results for scoring
    return {
      url,
      title: url,
      violations,
      score: 100, // Placeholder — real score comes from combined results
      loadTime: 0,
    };
  } catch (err) {
    // If pa11y fails, return empty results rather than crashing the scan
    console.error(`pa11y scan failed for ${url}:`, err);
    return {
      url,
      title: url,
      violations: [],
      score: 100,
      loadTime: 0,
    };
  }
}
