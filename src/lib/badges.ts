/**
 * Public shareable SVG score badges (M5).
 *
 * Renders a shields.io-style flat SVG badge with a fixed label ("accessibility")
 * on the left and a score/grade on the right. Pure — no external calls, no deps
 * beyond string concatenation — so it's cheap to cache and trivial to test.
 *
 * Design constraints:
 *  - The badge is a self-contained `<svg>` document. No external fonts, no CSS
 *    `<link>`, no JS. Renders identically anywhere (GitHub README, HTML embed,
 *    Markdown image).
 *  - Text width is estimated from a per-character width table rather than
 *    measured in a headless browser — good enough for 5–8 character payloads
 *    and keeps the function pure/sync.
 *  - Colors follow the same severity palette used by the rest of the product
 *    so the badge value tracks the dashboard score meaning 1:1.
 */

// ─── Color palette ────────────────────────────────────────────────────────────

/**
 * Pick a color for a numeric 0–100 score using the same thresholds as the
 * dashboard score card and the PDF report.
 */
export function scoreColor(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "#9ca3af"; // gray-400
  if (score >= 90) return "#22c55e"; // green-500 — WCAG-ready
  if (score >= 70) return "#eab308"; // yellow-500 — on-track
  if (score >= 50) return "#f97316"; // orange-500 — at-risk
  return "#ef4444"; // red-500 — failing
}

// ─── Text width estimation ────────────────────────────────────────────────────

/**
 * Verdana-11 average character width (approximate, in px).
 *
 * Measured from the same "Verdana,Geneva,DejaVu Sans,sans-serif" stack the
 * shields.io project uses. A perfect-fit glyph table would be >1 kB of data;
 * a small lookup for the characters we actually render (digits, letters, "/"
 * and "—") gets us visually indistinguishable spacing at ~50 LOC.
 */
const CHAR_WIDTH_11PX: Readonly<Record<string, number>> = {
  " ": 3.5,
  "/": 4,
  "-": 4,
  ".": 3,
  ",": 3,
  ":": 3,
  "0": 7, "1": 7, "2": 7, "3": 7, "4": 7,
  "5": 7, "6": 7, "7": 7, "8": 7, "9": 7,
  A: 8, B: 7, C: 7, D: 8, E: 6, F: 6, G: 8, H: 8, I: 3.5,
  J: 4, K: 7, L: 6, M: 9, N: 8, O: 8, P: 7, Q: 8, R: 7,
  S: 7, T: 6, U: 7, V: 7, W: 11, X: 7, Y: 7, Z: 7,
  a: 7, b: 7, c: 6, d: 7, e: 7, f: 4, g: 7, h: 7, i: 3,
  j: 3, k: 6, l: 3, m: 10, n: 7, o: 7, p: 7, q: 7, r: 4,
  s: 6, t: 4, u: 7, v: 6, w: 9, x: 6, y: 6, z: 6,
};

const FALLBACK_WIDTH = 7;

export function measureText(text: string): number {
  let total = 0;
  for (const ch of text) {
    total += CHAR_WIDTH_11PX[ch] ?? FALLBACK_WIDTH;
  }
  return total;
}

// ─── SVG builder ──────────────────────────────────────────────────────────────

export interface BuildBadgeSvgInput {
  label: string;
  value: string;
  /** Hex color for the right-hand (value) section. */
  color: string;
  /** Hex color for the left-hand (label) section. Default #555 matches shields.io. */
  labelColor?: string;
}

const LABEL_COLOR_DEFAULT = "#555555";
const TEXT_PADDING_X = 6;
const BADGE_HEIGHT = 20;

/** XML-escape — we insert user strings verbatim into attributes and text. */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a shields.io-style flat SVG badge.
 *
 * Returns a deterministic SVG string. No random IDs, no timestamps — stable for
 * CDN caching. Output is roughly 600-700 bytes.
 */
export function buildBadgeSvg(input: BuildBadgeSvgInput): string {
  const label = (input.label || "").slice(0, 50);
  const value = (input.value || "").slice(0, 30);
  const labelColor = input.labelColor ?? LABEL_COLOR_DEFAULT;
  const valueColor = input.color || "#9ca3af";

  const labelTextWidth = measureText(label);
  const valueTextWidth = measureText(value);

  const labelBoxWidth = Math.ceil(labelTextWidth + TEXT_PADDING_X * 2);
  const valueBoxWidth = Math.ceil(valueTextWidth + TEXT_PADDING_X * 2);
  const totalWidth = labelBoxWidth + valueBoxWidth;

  const labelTextX = (labelBoxWidth / 2) * 10;
  const valueTextX = (labelBoxWidth + valueBoxWidth / 2) * 10;
  const labelRenderWidth = Math.max(0, (labelTextWidth - 2) * 10);
  const valueRenderWidth = Math.max(0, (valueTextWidth - 2) * 10);

  const esc = escapeXml;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${BADGE_HEIGHT}" role="img" aria-label="${esc(label)}: ${esc(value)}">`,
    `<title>${esc(label)}: ${esc(value)}</title>`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="r"><rect width="${totalWidth}" height="${BADGE_HEIGHT}" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${labelBoxWidth}" height="${BADGE_HEIGHT}" fill="${esc(labelColor)}"/>`,
    `<rect x="${labelBoxWidth}" width="${valueBoxWidth}" height="${BADGE_HEIGHT}" fill="${esc(valueColor)}"/>`,
    `<rect width="${totalWidth}" height="${BADGE_HEIGHT}" fill="url(#s)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">`,
    `<text aria-hidden="true" x="${labelTextX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${labelRenderWidth}">${esc(label)}</text>`,
    `<text x="${labelTextX}" y="140" transform="scale(.1)" fill="#fff" textLength="${labelRenderWidth}">${esc(label)}</text>`,
    `<text aria-hidden="true" x="${valueTextX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${valueRenderWidth}">${esc(value)}</text>`,
    `<text x="${valueTextX}" y="140" transform="scale(.1)" fill="#fff" textLength="${valueRenderWidth}">${esc(value)}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

// ─── Score badge convenience ──────────────────────────────────────────────────

/**
 * Build the standard "accessibility: NN/100" badge for a website.
 *
 * Passing `null` (no scan yet) produces a neutral gray "no data" badge rather
 * than a zero, so sites that haven't been scanned don't appear to be failing.
 */
export function buildScoreBadgeSvg(score: number | null): string {
  const value = score === null || Number.isNaN(score) ? "no data" : `${score}/100`;
  return buildBadgeSvg({
    label: "accessibility",
    value,
    color: scoreColor(score),
  });
}

// ─── Embed snippet generators ─────────────────────────────────────────────────

export interface EmbedSnippets {
  imageUrl: string;
  html: string;
  markdown: string;
}

/**
 * Build the three embed snippets a customer pastes into their README or site
 * footer. `baseUrl` should be the canonical app origin (e.g. https://app.accesskit.io).
 */
export function buildEmbedSnippets(baseUrl: string, websiteId: string): EmbedSnippets {
  const origin = baseUrl.replace(/\/+$/, "");
  const imageUrl = `${origin}/api/badges/${websiteId}/score.svg`;
  const linkUrl = `${origin}/websites/${websiteId}`;
  const alt = "Accessibility score";
  return {
    imageUrl,
    html: `<a href="${linkUrl}"><img src="${imageUrl}" alt="${alt}" /></a>`,
    markdown: `[![${alt}](${imageUrl})](${linkUrl})`,
  };
}
