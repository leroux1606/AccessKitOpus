import { chromium } from "playwright";
import type { ScanResult, ScanViolation } from "@/types/scan";
import { crawlWebsite } from "./crawler";
import { scanPageWithAxe } from "./axe-scanner";
import { scanPageWithPa11y } from "./pa11y-scanner";
import { addPageScores, calculateScore } from "./scorer";
import { assertSafeFetchUrl } from "@/lib/ssrf-guard";

export async function runScan(
  websiteUrl: string,
  pageLimit: number,
  standards: string[],
): Promise<ScanResult> {
  const startTime = Date.now();
  const websiteOrigin = new URL(websiteUrl).origin;

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Discover pages to scan
    const discovered = await crawlWebsite(websiteUrl, pageLimit, browser);

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

    // 2. Scan each page with axe-core (max 3 concurrent to balance speed vs. memory)
    const CONCURRENCY = 3;
    const rawPages = [];
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((url) => scanPageWithAxe(browser, url, websiteOrigin, standards)),
      );
      rawPages.push(...results);
    }

    // 2b. Run pa11y in parallel for additional coverage (best-effort)
    try {
      const pa11yResults = await Promise.all(
        urls.slice(0, Math.min(urls.length, 5)).map((url) => scanPageWithPa11y(url, websiteOrigin)),
      );

      // Merge pa11y violations into axe results, deduplicating by fingerprint
      for (const pa11yPage of pa11yResults) {
        const matchingPage = rawPages.find((p) => p.url === pa11yPage.url);
        if (!matchingPage) continue;

        const existingFingerprints = new Set(matchingPage.violations.map((v) => v.fingerprint));
        const newViolations = pa11yPage.violations.filter(
          (v: ScanViolation) => !existingFingerprints.has(v.fingerprint),
        );
        matchingPage.violations.push(...newViolations);
      }
    } catch {
      // pa11y is supplementary — don't fail the scan if it errors
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
    await browser.close();
  }
}
