/**
 * Scanner end-to-end fixture test (Phase L3).
 *
 * Spins up an ephemeral http server that serves a deliberately-broken
 * HTML page (tests/fixtures/accessibility/known-violations.html), runs
 * axe-core in Playwright's real Chromium against it, and asserts:
 *
 *   1. Every violation we expect from the fixture is actually detected.
 *   2. Our standards-mapper + deduplicator + severity helpers produce
 *      the correct downstream shape for each detected violation.
 *
 * This gives us coverage of the whole scanner pipeline (page load →
 * axe analysis → tag mapping → fingerprint) against a known input
 * without needing the full crawler, Inngest job, or database. It does
 * not import `src/scanner/axe-scanner.ts` directly because that module
 * uses `createRequire(import.meta.url)` which Playwright's CJS loader
 * doesn't support — but the pure helpers (`standards-mapper`,
 * `deduplicator`) are pure and CJS-safe so we exercise them here.
 */

import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import http from "http";
import fs from "fs";
import path from "path";
import {
  mapAxeViolationToSeverity,
  mapTagsToCategory,
  mapTagsToStandards,
  extractWcagCriterion,
  extractWcagLevel,
  standardsToAxeTags,
} from "../../src/scanner/standards-mapper";
import { generateFingerprint, normalizeSelector } from "../../src/scanner/deduplicator";

const FIXTURE_PATH = path.resolve(
  __dirname,
  "../fixtures/accessibility/known-violations.html",
);

let server: http.Server;
let baseUrl: string;

test.beforeAll(async () => {
  const html = fs.readFileSync(FIXTURE_PATH, "utf8");
  server = http.createServer((req, res) => {
    if (req.url === "/known-violations.html" || req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("server bind failed");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.describe("Scanner fixture — known WCAG violations", () => {
  test("detects every seeded violation in the fixture page", async ({ page }) => {
    await page.goto(`${baseUrl}/known-violations.html`);

    const results = await new AxeBuilder({ page })
      .withTags(standardsToAxeTags(["WCAG22_AA"]))
      .analyze();

    const ids = new Set(results.violations.map((v) => v.id));

    // Each fixture violation is individually asserted so a missing rule
    // produces a precise failure message rather than a single "0 !== N".
    expect(ids, "missing image-alt").toContain("image-alt");
    expect(ids, "missing label (input without label)").toContain("label");
    expect(ids, "missing button-name (empty <button>)").toContain("button-name");
    expect(ids, "missing color-contrast").toContain("color-contrast");
    expect(ids, "missing html-has-lang").toContain("html-has-lang");
    expect(ids, "missing link-name (empty <a>)").toContain("link-name");
  });

  test("standards-mapper produces well-formed output for every detected violation", async ({ page }) => {
    await page.goto(`${baseUrl}/known-violations.html`);
    const results = await new AxeBuilder({ page })
      .withTags(standardsToAxeTags(["WCAG22_AA"]))
      .analyze();

    expect(results.violations.length).toBeGreaterThan(0);

    for (const violation of results.violations) {
      const severity = mapAxeViolationToSeverity(violation.impact, violation.tags);
      expect(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"]).toContain(severity);

      const category = mapTagsToCategory(violation.tags);
      expect(typeof category).toBe("string");
      expect(category.length).toBeGreaterThan(0);

      // Every WCAG-tagged violation should map to at least one standard
      const standards = mapTagsToStandards(violation.tags);
      const hasWcagTag = violation.tags.some((t: string) => /^wcag/.test(t));
      if (hasWcagTag) {
        expect(standards.length).toBeGreaterThan(0);
      }

      const level = extractWcagLevel(violation.tags);
      if (hasWcagTag && level) {
        expect(["A", "AA"]).toContain(level);
      }

      const criterion = extractWcagCriterion(violation.tags);
      if (criterion) expect(criterion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  test("fingerprint is stable for the same violation across two scans of the same page", async ({ page }) => {
    const scan = async () => {
      await page.goto(`${baseUrl}/known-violations.html`);
      const r = await new AxeBuilder({ page })
        .withTags(standardsToAxeTags(["WCAG22_AA"]))
        .analyze();
      return r.violations
        .filter((v) => v.id === "image-alt")
        .flatMap((v) =>
          v.nodes.map((node) => {
            const cssSelector = Array.isArray(node.target)
              ? node.target.join(", ")
              : String(node.target);
            return generateFingerprint(v.id, cssSelector, baseUrl);
          }),
        );
    };

    const first = await scan();
    const second = await scan();

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  test("normalizeSelector strips axe's positional qualifiers on real selectors", async ({ page }) => {
    await page.goto(`${baseUrl}/known-violations.html`);
    const results = await new AxeBuilder({ page })
      .withTags(standardsToAxeTags(["WCAG22_AA"]))
      .analyze();

    const rawSelectors = results.violations.flatMap((v) =>
      v.nodes.map((node) =>
        Array.isArray(node.target) ? node.target.join(", ") : String(node.target),
      ),
    );
    expect(rawSelectors.length).toBeGreaterThan(0);

    for (const selector of rawSelectors) {
      const normalized = normalizeSelector(selector);
      // nth-child / nth-of-type / bracket indices should NEVER appear in
      // the normalized output — Phase K2 stability guarantee.
      expect(normalized).not.toMatch(/:nth-(child|of-type)/);
      expect(normalized).not.toMatch(/\[\d+\]/);
    }
  });
});
