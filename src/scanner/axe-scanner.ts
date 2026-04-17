import { readFileSync } from "fs";
import { createRequire } from "module";
import type { Browser } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

// Resolve axe-core's browser-compatible bundle relative to THIS module,
// not `process.cwd()`. In serverless runtimes (Lambda, Vercel, Fly.io
// Machines) the working directory is rarely the repo root, so a
// `resolve(process.cwd(), ...)` call blows up at runtime even though
// the file exists on disk. Using `require.resolve` also lets pnpm /
// hoisting / workspace layouts Just Work without a hardcoded path.
const nodeRequire = createRequire(import.meta.url);
const axeSource = readFileSync(nodeRequire.resolve("axe-core/axe.min.js"), "utf8");
import type { ScanViolation, PageScanResult } from "@/types/scan";
import {
  mapAxeViolationToSeverity,
  mapTagsToCategory,
  mapTagsToStandards,
  extractWcagCriterion,
  extractWcagLevel,
  standardsToAxeTags,
} from "./standards-mapper";
import { generateFixSuggestion, estimateEffort } from "./fix-generator";
import { generateFingerprint } from "./deduplicator";
import { applyPageResourceCap } from "./page-limits";
import {
  buildScreenshotKey,
  screenshotsEnabled,
  uploadScreenshot,
} from "./screenshot";

export async function scanPageWithAxe(
  browser: Browser,
  url: string,
  websiteOrigin: string,
  standards: string[],
  scanId?: string,
): Promise<PageScanResult> {
  const page = await browser.newPage();
  const startTime = Date.now();

  // Cap total page weight so a malicious or accidentally huge response
  // cannot OOM the worker. Installed before navigation so every request
  // (HTML + JS + CSS + images) is intercepted.
  const cap = await applyPageResourceCap(page);

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
          severity: mapAxeViolationToSeverity(violation.impact, violation.tags),
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

    // Capture + upload a viewport screenshot after axe finishes so the
    // page is already fully hydrated. Viewport (not fullPage) keeps the
    // buffer <500 KB typically and the Playwright call <1 s. Upload runs
    // in parallel-friendly fashion — all errors are swallowed by
    // `uploadScreenshot`, so the scan proceeds with a null URL on failure.
    // `scanId` is optional (demo-scan and other ad-hoc callers omit it)
    // in which case screenshots are skipped entirely.
    let screenshotUrl: string | null = null;
    if (scanId && screenshotsEnabled()) {
      try {
        const buffer = await page.screenshot({ type: "png", fullPage: false });
        screenshotUrl = await uploadScreenshot(
          buffer,
          buildScreenshotKey(scanId, url),
        );
      } catch (err) {
        console.warn(
          `[axe-scanner] screenshot capture failed for ${url}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return { url, title, loadTime, violations, score: 0, screenshotUrl };
  } finally {
    await cap.dispose();
    await page.close();
  }
}
