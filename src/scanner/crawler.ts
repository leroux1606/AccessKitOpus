import type { Browser } from "playwright";
import { assertSafeFetchUrl } from "@/lib/ssrf-guard";
import { DEFAULT_LIMITS, fetchWithSizeLimit } from "@/lib/http-limits";
import { applyPageResourceCap } from "./page-limits";

// Extracts URLs from a sitemap.xml string using regex (avoids XML parser dep)
export function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1];
    if (url) urls.push(url.trim());
  }
  return urls;
}

// Convert a robots.txt pattern (supports * wildcard and $ end-anchor) to a RegExp.
function robotsPatternToRegex(pattern: string): RegExp {
  // Escape regex special chars except * and $
  const escaped = pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&");
  const withStar = escaped.replace(/\*/g, ".*");
  // If pattern ends with $, anchor it; otherwise allow anything to follow
  const anchored = withStar.endsWith("$") ? `^${withStar}` : `^${withStar}`;
  return new RegExp(anchored);
}

/**
 * Robots.txt parser that follows the Google / RFC 9309 algorithm:
 *
 * 1. Collect rules from every group whose User-agent matches our agent or "*".
 *    We treat "AccessKit-Scanner" and "*" as applicable.
 * 2. A path is allowed if the longest-matching rule is an Allow, or if no rule
 *    matches. Ties go to Allow (more permissive).
 * 3. Supports wildcards (`*`) and end-anchor (`$`).
 * 4. An empty Disallow means "allow everything" per the spec.
 */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split(/\r?\n/);

  type Rule = { allow: boolean; pattern: string };
  const applicableRules: Rule[] = [];
  let currentAgents: string[] = [];
  let collecting = false;

  const ourAgents = new Set(["accesskit-scanner", "*"]);

  for (const rawLine of lines) {
    // Strip comments and whitespace
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === "user-agent") {
      // A new User-agent line starts (or extends) a group.
      // If we were previously collecting rules, that group has ended.
      if (collecting && currentAgents.length) {
        currentAgents = [];
      }
      currentAgents.push(value.toLowerCase());
      collecting = false;
    } else if (field === "allow" || field === "disallow") {
      if (!currentAgents.length) continue;
      // Check if this group applies to us
      const applies = currentAgents.some((a) => ourAgents.has(a));
      collecting = true;
      if (applies && value) {
        applicableRules.push({ allow: field === "allow", pattern: value });
      }
      // Per spec: empty Disallow means "allow everything" — no rule to add.
    }
  }

  // Find longest-matching rule; on tie, Allow wins.
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of applicableRules) {
    try {
      const re = robotsPatternToRegex(rule.pattern);
      if (re.test(path)) {
        const len = rule.pattern.length;
        if (
          !best ||
          len > best.length ||
          (len === best.length && rule.allow && !best.allow)
        ) {
          best = { allow: rule.allow, length: len };
        }
      }
    } catch {
      // Malformed pattern — skip
    }
  }

  return best ? best.allow : true;
}

export function normalizeUrl(url: string, origin: string): string | null {
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return null; // external link
    parsed.hash = ""; // remove fragments
    // Remove trailing slash except for root
    const href = parsed.pathname !== "/"
      ? parsed.href.replace(/\/$/, "")
      : parsed.href;
    return href;
  } catch {
    return null;
  }
}

async function fetchSitemapUrls(websiteUrl: string): Promise<string[]> {
  const origin = new URL(websiteUrl).origin;
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap/index.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    const result = await fetchWithSizeLimit(sitemapUrl, {
      maxBytes: DEFAULT_LIMITS.SITEMAP_XML,
      timeoutMs: 10_000,
      headers: { "User-Agent": "AccessKit-Scanner/1.0" },
    });
    if (!result || !result.response.ok) continue;
    // A truncated sitemap may be missing closing tags. `parseSitemapUrls`
    // is regex-based so it still extracts every complete <loc> in the prefix.
    const urls = parseSitemapUrls(result.body);
    if (urls.length > 0) {
      return urls.filter((u) => normalizeUrl(u, origin) !== null);
    }
  }
  return [];
}

async function crawlFromHomepage(
  websiteUrl: string,
  browser: Browser,
  limit: number,
): Promise<string[]> {
  const origin = new URL(websiteUrl).origin;
  const visited = new Set<string>();
  const discovered = new Set<string>();

  const page = await browser.newPage();
  const cap = await applyPageResourceCap(page);
  try {
    await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const hrefs = await page.$$eval("a[href]", (links) =>
      links.map((a) => (a as HTMLAnchorElement).href),
    );

    for (const href of hrefs) {
      const normalized = normalizeUrl(href, origin);
      if (normalized && !visited.has(normalized)) {
        discovered.add(normalized);
      }
    }
  } catch {
    // If homepage fails, at least scan the homepage itself
  } finally {
    await cap.dispose();
    await page.close();
  }

  // Always include the homepage
  const homepageNorm = normalizeUrl(websiteUrl, origin);
  if (homepageNorm) visited.add(homepageNorm);

  const urls = [
    ...(homepageNorm ? [homepageNorm] : [websiteUrl]),
    ...Array.from(discovered).slice(0, limit - 1),
  ];
  return urls.slice(0, limit);
}

export async function crawlWebsite(
  websiteUrl: string,
  pageLimit: number,
  browser: Browser,
): Promise<string[]> {
  // Re-validate before any outbound fetch — guards against DNS rebinding
  // between when the website was added and when the scan actually runs.
  await assertSafeFetchUrl(websiteUrl);

  const origin = new URL(websiteUrl).origin;

  // Check robots.txt (size-capped — a pathological robots.txt could exhaust memory)
  const robotsResult = await fetchWithSizeLimit(`${origin}/robots.txt`, {
    maxBytes: DEFAULT_LIMITS.ROBOTS_TXT,
    timeoutMs: 5_000,
    headers: { "User-Agent": "AccessKit-Scanner/1.0" },
  });
  const robotsTxt =
    robotsResult && robotsResult.response.ok ? robotsResult.body : "";

  // Try sitemap first
  let urls = await fetchSitemapUrls(websiteUrl);

  if (urls.length === 0) {
    // Fall back to crawling from homepage
    urls = await crawlFromHomepage(websiteUrl, browser, pageLimit);
  } else {
    // Filter by robots.txt and normalize
    const homepageNorm = normalizeUrl(websiteUrl, origin);
    const sitemapNorm = urls
      .map((u) => normalizeUrl(u, origin))
      .filter((u): u is string => u !== null)
      .filter((u) => {
        try {
          const path = new URL(u).pathname;
          return isAllowedByRobots(robotsTxt, path);
        } catch {
          return false;
        }
      });

    // Ensure homepage is first, deduplicate, limit
    const ordered = new Set<string>();
    if (homepageNorm) ordered.add(homepageNorm);
    for (const u of sitemapNorm) {
      if (ordered.size >= pageLimit) break;
      ordered.add(u);
    }
    urls = Array.from(ordered);
  }

  return urls.slice(0, pageLimit);
}
