// Verify the per-page-failure fix against the actual failing URL from the DB.
// Runs the scanner end-to-end against the Deque Mars Commuter demo, which has
// JS-driven anchor links (`?a=send_me_to_mars`, `?a=ice_cream`) that used to
// fail with `chrome-error://chromewebdata/` and tank the whole scan.

import { runScan } from "../src/scanner";

(async () => {
  const url = "https://dequeuniversity.com/demo/mars2.html";
  console.log(`Scanning ${url} …\n`);

  const result = await runScan(url, 10, ["WCAG22_AA"]);

  console.log(`\n=== RESULT ===`);
  console.log(`Pages scanned: ${result.pages.length}`);
  console.log(`Total violations: ${result.totalViolations}`);
  console.log(`Score: ${result.score}`);
  console.log(
    `Critical: ${result.criticalCount} · Serious: ${result.seriousCount} · Moderate: ${result.moderateCount} · Minor: ${result.minorCount}`,
  );
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);

  for (const page of result.pages) {
    console.log(
      `\n  ${page.url}  (${page.violations.length} issues, ${page.loadTime}ms)`,
    );
  }
  process.exit(0);
})().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
