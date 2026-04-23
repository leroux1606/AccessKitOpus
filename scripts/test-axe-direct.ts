import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://example.com", { waitUntil: "networkidle", timeout: 30000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  console.log(`Violations: ${results.violations.length}`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
    for (const node of v.nodes.slice(0, 2)) {
      console.log(`    html: ${node.html}`);
    }
  }

  console.log(`\nPasses: ${results.passes.length}`);
  console.log(`Incomplete: ${results.incomplete.length}`);
  console.log(`\nHTML lang attr: checking...`);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(`document.documentElement.lang = "${lang}"`);

  await context.close();
  await browser.close();
})();
