// Test the exact URL stored in the DB for the Mars Demo website (no .html)
// to reproduce the hang the Inngest path exhibits.

import { runScan } from "../src/scanner";

(async () => {
  const url = "https://dequeuniversity.com/demo/mars";
  console.log(`Scanning ${url} (pageLimit=10) …\n`);

  const t0 = Date.now();
  try {
    const result = await runScan(url, 10, ["WCAG22_AA"]);
    console.log(`\n=== RESULT in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
    console.log(`Pages: ${result.pages.length}, violations: ${result.totalViolations}, score: ${result.score}`);
    for (const page of result.pages) {
      console.log(`  ${page.url}  (${page.violations.length} issues, ${page.loadTime}ms)`);
    }
  } catch (err) {
    console.error(`\nFAILED in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, err instanceof Error ? err.message.split("\n")[0] : err);
  }
  process.exit(0);
})();
