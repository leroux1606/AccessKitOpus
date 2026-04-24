/**
 * Unit tests for the pure (non-browser) functions exported from crawler.ts.
 *
 * crawlWebsite itself (which needs a real Playwright Browser) is tested via
 * the E2E suite; here we only cover the deterministic utility functions that
 * can run in a plain Node/Jest environment.
 */

import { parseSitemapUrls, isAllowedByRobots, normalizeUrl } from "@/scanner/crawler";

// ─── parseSitemapUrls ─────────────────────────────────────────────────────────

describe("parseSitemapUrls", () => {
  it("extracts URLs from a standard sitemap", () => {
    const xml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/contact</loc></url>
</urlset>`;
    expect(parseSitemapUrls(xml)).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/contact",
    ]);
  });

  it("trims whitespace inside <loc> tags", () => {
    const xml = `<urlset><url><loc>  https://example.com/page  </loc></url></urlset>`;
    expect(parseSitemapUrls(xml)).toEqual(["https://example.com/page"]);
  });

  it("returns empty array for XML with no <loc> elements", () => {
    expect(parseSitemapUrls("<urlset></urlset>")).toEqual([]);
    expect(parseSitemapUrls("")).toEqual([]);
  });

  it("ignores non-HTTP URLs inside <loc>", () => {
    const xml = `<urlset>
      <url><loc>https://example.com/valid</loc></url>
      <url><loc>ftp://example.com/ignored</loc></url>
    </urlset>`;
    expect(parseSitemapUrls(xml)).toEqual(["https://example.com/valid"]);
  });

  it("handles sitemap index files with multiple <loc> entries", () => {
    const xml = `<sitemapindex>
      <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
      <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
    </sitemapindex>`;
    const result = parseSitemapUrls(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("https://example.com/sitemap1.xml");
  });
});

// ─── isAllowedByRobots ────────────────────────────────────────────────────────

describe("isAllowedByRobots", () => {
  const robots = `
User-agent: *
Disallow: /admin
Disallow: /private/

User-agent: Googlebot
Disallow: /no-google
`.trim();

  it("allows paths not in any Disallow rule", () => {
    expect(isAllowedByRobots(robots, "/")).toBe(true);
    expect(isAllowedByRobots(robots, "/public/page")).toBe(true);
  });

  it("blocks paths that match a Disallow rule for *", () => {
    expect(isAllowedByRobots(robots, "/admin")).toBe(false);
    expect(isAllowedByRobots(robots, "/private/data")).toBe(false);
  });

  it("does not apply rules for other user-agents to *", () => {
    // /no-google is only disallowed for Googlebot, not for *
    expect(isAllowedByRobots(robots, "/no-google")).toBe(true);
  });

  it("allows everything when robots.txt is empty", () => {
    expect(isAllowedByRobots("", "/anything")).toBe(true);
  });

  it("handles robots.txt with no wildcard user-agent", () => {
    const noWildcard = `User-agent: Googlebot\nDisallow: /google-only\n`;
    expect(isAllowedByRobots(noWildcard, "/google-only")).toBe(true);
    expect(isAllowedByRobots(noWildcard, "/other")).toBe(true);
  });
});

// ─── normalizeUrl ─────────────────────────────────────────────────────────────

describe("normalizeUrl", () => {
  const origin = "https://example.com";

  it("returns a fully-qualified URL for same-origin relative hrefs", () => {
    expect(normalizeUrl("https://example.com/page", origin)).toBe(
      "https://example.com/page",
    );
  });

  it("resolves relative paths against the origin", () => {
    expect(normalizeUrl("/about", origin)).toBe("https://example.com/about");
  });

  it("strips fragment identifiers", () => {
    expect(normalizeUrl("https://example.com/page#section", origin)).toBe(
      "https://example.com/page",
    );
  });

  it("strips trailing slashes on non-root paths", () => {
    expect(normalizeUrl("https://example.com/about/", origin)).toBe(
      "https://example.com/about",
    );
  });

  it("preserves the root slash", () => {
    expect(normalizeUrl("https://example.com/", origin)).toBe(
      "https://example.com/",
    );
  });

  it("returns null for external (cross-origin) URLs", () => {
    expect(normalizeUrl("https://other.com/page", origin)).toBeNull();
    expect(normalizeUrl("https://subdomain.example.com/page", origin)).toBeNull();
  });

  it("returns null for non-HTTP protocol hrefs", () => {
    // javascript: and mailto: have a different origin, so they are filtered out
    expect(normalizeUrl("javascript:void(0)", origin)).toBeNull();
    expect(normalizeUrl("mailto:user@example.com", origin)).toBeNull();
  });

  it("preserves query strings", () => {
    expect(normalizeUrl("https://example.com/search?q=test", origin)).toBe(
      "https://example.com/search?q=test",
    );
  });

  // Repro for the scanoutput.txt bug: target pages with sloppy relative hrefs
  // (e.g. an <a href="demo/mars"> on a page already at /demo/mars) cause the
  // browser to produce URLs like /demo/demo/mars. The server 404s those, and
  // they pollute the scan with unreachable-but-previously-"score 100" pages.
  it("returns null for URLs whose path contains consecutive duplicate segments", () => {
    expect(normalizeUrl("https://example.com/demo/demo/mars", origin)).toBeNull();
    expect(normalizeUrl("https://example.com/a/a/b", origin)).toBeNull();
    expect(
      normalizeUrl("https://example.com/foo/bar/bar/baz", origin),
    ).toBeNull();
  });

  it("accepts similar-but-non-adjacent path segments", () => {
    // /docs/api/docs is legitimate (no adjacent duplicate), must pass through.
    expect(normalizeUrl("https://example.com/docs/api/docs", origin)).toBe(
      "https://example.com/docs/api/docs",
    );
  });
});
