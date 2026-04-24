import type { BrowserContext } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
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
  context: BrowserContext,
  url: string,
  websiteOrigin: string,
  standards: string[],
  scanId?: string,
): Promise<PageScanResult> {
  const page = await context.newPage();
  const startTime = Date.now();

  // Auto-dismiss any JS dialogs (alert / confirm / prompt / beforeunload).
  // Without this, Playwright blocks page.goto and subsequent calls until the
  // dialog is handled — which hangs indefinitely on pages that fire alerts on
  // load (e.g. deque's `?a=send_me_to_mars` demo links). Axe analyses the
  // static DOM, so dismissing dialogs is semantically harmless.
  page.on("dialog", (dialog) => {
    dialog.dismiss().catch(() => {});
  });

  // Cap total page weight so a malicious or accidentally huge response
  // cannot OOM the worker. Installed before navigation so every request
  // (HTML + JS + CSS + images) is intercepted.
  const cap = await applyPageResourceCap(page);

  try {
    // Capture the main navigation response so we can short-circuit on
    // 4xx/5xx. Without this, axe happily scans the site's 404 page
    // (typically empty) and the page gets credited as a perfect 100.
    let response = await page
      .goto(url, { waitUntil: "networkidle", timeout: 30000 })
      .catch(() => null);
    if (!response) {
      // Fall back to domcontentloaded if networkidle times out (SPAs).
      response = await page
        .goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
        .catch(() => null);
    }

    const title = await page.title().catch(() => url);
    const loadTime = Date.now() - startTime;
    const statusCode = response?.status() ?? null;

    // Non-OK HTTP → mark the page UNREACHABLE and skip axe entirely.
    // Scanning a 404/500 page is meaningless; worse, the resulting
    // 0 violations would inflate the site's average to "perfect".
    if (statusCode !== null && statusCode >= 400) {
      return {
        url,
        title,
        loadTime,
        violations: [],
        score: null,
        status: "UNREACHABLE",
        statusCode,
        errorMessage: `Server returned HTTP ${statusCode}`,
        screenshotUrl: null,
      };
    }

    // Navigation itself failed (DNS, connection reset, crash). No
    // response object → no status code to check.
    if (!response) {
      return {
        url,
        title: url,
        loadTime,
        violations: [],
        score: null,
        status: "ERROR",
        statusCode: null,
        errorMessage: "Page failed to load",
        screenshotUrl: null,
      };
    }

    const axeTags = standardsToAxeTags(standards);

    // Don't pass axeSource — AxeBuilder falls back to axe-core's bundled
    // `source` export, which is webpack-safe. Passing a manually-read
    // file path breaks under Next.js bundling because `import.meta.url`
    // becomes a `webpack-internal://` URL with the route-group segment
    // (e.g. `(action-browser)`) baked in, which confuses createRequire.
    const results = await new AxeBuilder({ page })
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

    return {
      url,
      title,
      loadTime,
      violations,
      score: 0, // real score is filled in by addPageScores()
      status: "OK",
      statusCode,
      errorMessage: null,
      screenshotUrl,
    };
  } finally {
    await cap.dispose();
    await page.close();
  }
}
