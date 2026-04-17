import { readFileSync } from "fs";
import { resolve } from "path";
import type { Browser } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

// Use the browser-compatible bundle — the CJS build fails in page context
const axeSource = readFileSync(resolve(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
import type { ScanViolation, PageScanResult } from "@/types/scan";
import {
  mapAxeImpactToSeverity,
  mapTagsToCategory,
  mapTagsToStandards,
  extractWcagCriterion,
  extractWcagLevel,
  standardsToAxeTags,
} from "./standards-mapper";
import { generateFixSuggestion, estimateEffort } from "./fix-generator";
import { generateFingerprint } from "./deduplicator";

export async function scanPageWithAxe(
  browser: Browser,
  url: string,
  websiteOrigin: string,
  standards: string[],
): Promise<PageScanResult> {
  const page = await browser.newPage();
  const startTime = Date.now();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() =>
      // Fall back to domcontentloaded if networkidle times out (SPAs)
      page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }),
    );

    const title = await page.title().catch(() => url);
    const loadTime = Date.now() - startTime;

    const axeTags = standardsToAxeTags(standards);

    const results = await new AxeBuilder({ page, axeSource })
      .withTags(axeTags)
      .analyze();

    const violations: ScanViolation[] = [];

    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const cssSelector = Array.isArray(node.target)
          ? node.target.join(", ")
          : String(node.target);

        violations.push({
          ruleId: violation.id,
          engine: "AXE_CORE",
          severity: mapAxeImpactToSeverity(violation.impact),
          impact: violation.impact ?? "moderate",
          category: mapTagsToCategory(violation.tags),
          standards: mapTagsToStandards(violation.tags),
          wcagCriterion: extractWcagCriterion(violation.tags),
          wcagLevel: extractWcagLevel(violation.tags),
          description: violation.description,
          helpText: violation.help,
          helpUrl: violation.helpUrl,
          htmlElement: node.html,
          cssSelector,
          xpath: Array.isArray(node.xpath) ? node.xpath[0] : undefined,
          fixSuggestion: generateFixSuggestion(violation.id),
          effortEstimate: estimateEffort(violation.id),
          fingerprint: generateFingerprint(violation.id, cssSelector, websiteOrigin),
        });
      }
    }

    return { url, title, loadTime, violations, score: 0 };
  } finally {
    await page.close();
  }
}
