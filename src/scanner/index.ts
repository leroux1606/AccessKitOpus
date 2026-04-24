import { chromium } from "playwright";
import type { PageScanResult, ScanResult, ScanViolation } from "@/types/scan";
import { crawlWebsite } from "./crawler";
import { scanPageWithAxe } from "./axe-scanner";
import { scanPageWithPa11y } from "./pa11y-scanner";
import { addPageScores, calculateScore } from "./scorer";
import { assertSafeFetchUrl } from "@/lib/ssrf-guard";

/**
 * Optional runtime context for a scan.
 *
 * `scanId` is threaded through to the axe scanner so each uploaded
 * screenshot can be namespaced under its scan's R2 prefix
 * (`scans/{scanId}/…`). Ad-hoc callers like the public `demo-scan`
 * route omit it — those scans simply don't produce screenshots.
 */
export interface RunScanOptions {
  scanId?: string;
}

export async function runScan(
  websiteUrl: string,
  pageLimit: number,
  standards: string[],
  options: RunScanOptions = {},
): Promise<ScanResult> {
  const startTime = Date.now();
  const websiteOrigin = new URL(websiteUrl).origin;
  const { scanId } = options;

  const browser = await chromium.launch({ headless: true });
  // `@axe-core/playwright` opens a blank page in the current BrowserContext
  // at the end of every `analyze()` call (cross-frame result postprocessing).
  // Using the `browser.newPage()` shortcut creates an anonymous context that
  // the blank-page open rejects with "Please use browser.newContext()".
  // Create one context explicitly and share it across crawl + scan.
  const context = await browser.newContext({
    userAgent: "AccessKit-Scanner/1.0",
  });

  try {
    // 1. Discover pages to scan
    const discovered = await crawlWebsite(websiteUrl, pageLimit, context);

    // 1b. SSRF-guard every discovered URL. Sitemaps and anchor hrefs can
    //     point anywhere — including private IPs / cloud metadata endpoints —
    //     so we re-validate before loading them in the browser. Invalid URLs
    //     are silently dropped; the scan proceeds with what remains.
    const urls: string[] = [];
    for (const url of discovered) {
      try {
        await assertSafeFetchUrl(url);
        urls.push(url);
      } catch {
        // Skip URLs that fail the guard
      }
    }

    // 2. Scan each page with axe-core (max 3 concurrent to balance speed vs. memory).
    //    Per-page failures are non-fatal: one bad URL (e.g. a JS-driven anchor
    //    that triggers chrome-error://) must not tank the whole scan — we
    //    collect what we can and surface the failures in logs. The scan only
    //    fails as a whole if every discovered page failed (see check below).
    const CONCURRENCY = 3;
    const rawPages: PageScanResult[] = [];
    const pageFailures: { url: string; error: string }[] = [];
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((url) => scanPageWithAxe(context, url, websiteOrigin, standards, scanId)),
      );
      settled.forEach((r, j) => {
        const url = batch[j]!;
        if (r.status === "fulfilled") {
          rawPages.push(r.value);
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          pageFailures.push({ url, error: msg });
          console.warn(`[scanner] page scan failed for ${url}: ${msg.split("\n")[0]}`);
        }
      });
    }

    if (rawPages.length === 0) {
      const sample = pageFailures
        .slice(0, 3)
        .map((f) => `${f.url}: ${f.error.split("\n")[0]}`)
        .join("; ");
      throw new Error(
        `All ${urls.length} discovered page(s) failed to load. ${sample}`,
      );
    }

    // 2b. Run pa11y for additional coverage. pa11y spawns its own headless
    // Chromium via puppeteer, so each parallel call adds ~300 MB of RSS on
    // top of the Playwright browser we already have open. That doubling
    // is what OOMs 1 GB workers. We therefore:
    //   1. Make it opt-in behind SCANNER_ENABLE_PA11Y (off by default).
    //   2. Run the URLs serially instead of via Promise.all so peak memory
    //      is bounded to one extra Chromium at a time.
    //   3. Cap the number of URLs at 3 (down from 5).
    if (process.env.SCANNER_ENABLE_PA11Y === "true") {
      const pa11yUrls = urls.slice(0, Math.min(urls.length, 3));
      for (const url of pa11yUrls) {
        try {
          const pa11yPage = await scanPageWithPa11y(url, websiteOrigin);
          const matchingPage = rawPages.find((p) => p.url === pa11yPage.url);
          if (!matchingPage) continue;

          const existingFingerprints = new Set(matchingPage.violations.map((v) => v.fingerprint));
          const newViolations = pa11yPage.violations.filter(
            (v: ScanViolation) => !existingFingerprints.has(v.fingerprint),
          );
          matchingPage.violations.push(...newViolations);
        } catch {
          // pa11y is supplementary — don't fail the scan if it errors
        }
      }
    }

    // 3. Add per-page scores
    const pages = addPageScores(rawPages);

    // 4. Aggregate violation counts
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;

    for (const page of pages) {
      for (const v of page.violations) {
        if (v.severity === "CRITICAL") criticalCount++;
        else if (v.severity === "SERIOUS") seriousCount++;
        else if (v.severity === "MODERATE") moderateCount++;
        else if (v.severity === "MINOR") minorCount++;
      }
    }

    const totalViolations = criticalCount + seriousCount + moderateCount + minorCount;
    const score = calculateScore(criticalCount, seriousCount, moderateCount, minorCount);
    const duration = Date.now() - startTime;

    return {
      pages,
      totalViolations,
      criticalCount,
      seriousCount,
      moderateCount,
      minorCount,
      score,
      duration,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close();
  }
}
