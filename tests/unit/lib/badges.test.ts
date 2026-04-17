/**
 * Unit tests for the public score badge library (M5).
 *
 * Locks in:
 *   - Colour mapping stays aligned with the dashboard / PDF palette.
 *   - SVG output is well-formed, deterministic, and renders both dark label
 *     + coloured value blocks without XML injection from label/value text.
 *   - The "no data" branch doesn't emit a scary red "0/100" for brand-new sites.
 *   - Embed snippet builder produces working markdown / HTML that point at the
 *     canonical `/api/badges/{id}/score.svg` route.
 */

import {
  scoreColor,
  measureText,
  escapeXml,
  buildBadgeSvg,
  buildScoreBadgeSvg,
  buildEmbedSnippets,
} from "@/lib/badges";

describe("scoreColor", () => {
  it("returns neutral gray for null/NaN so unscored sites don't look failing", () => {
    expect(scoreColor(null)).toBe("#9ca3af");
    expect(scoreColor(Number.NaN)).toBe("#9ca3af");
  });

  it("green for 90+", () => {
    expect(scoreColor(100)).toBe("#22c55e");
    expect(scoreColor(90)).toBe("#22c55e");
  });

  it("yellow for 70-89", () => {
    expect(scoreColor(89)).toBe("#eab308");
    expect(scoreColor(70)).toBe("#eab308");
  });

  it("orange for 50-69", () => {
    expect(scoreColor(69)).toBe("#f97316");
    expect(scoreColor(50)).toBe("#f97316");
  });

  it("red for below 50", () => {
    expect(scoreColor(49)).toBe("#ef4444");
    expect(scoreColor(0)).toBe("#ef4444");
  });
});

describe("measureText", () => {
  it("sums per-character widths deterministically", () => {
    // Same inputs should produce identical outputs every call (no randomness)
    expect(measureText("100")).toBe(measureText("100"));
    expect(measureText("a/b")).toBeGreaterThan(0);
  });

  it("returns 0 for empty string", () => {
    expect(measureText("")).toBe(0);
  });

  it("handles unknown glyphs via fallback width", () => {
    // A non-ASCII character falls back to FALLBACK_WIDTH (7) — the total is
    // therefore strictly positive and not NaN.
    const width = measureText("\u4e2d"); // CJK char
    expect(width).toBeGreaterThan(0);
    expect(Number.isFinite(width)).toBe(true);
  });
});

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&apos;");
  });
  it("passes plain text through unchanged", () => {
    expect(escapeXml("accessibility score 87/100")).toBe("accessibility score 87/100");
  });
});

describe("buildBadgeSvg", () => {
  it("returns a self-contained <svg> document with xmlns and role", () => {
    const svg = buildBadgeSvg({ label: "hello", value: "world", color: "#00aa00" });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("embeds the label and value text twice (shadow + foreground) for readability", () => {
    const svg = buildBadgeSvg({ label: "hello", value: "world", color: "#00aa00" });
    // Each text appears in a shadow (fill-opacity=".3") and foreground render.
    expect(svg.match(/>hello</g)?.length).toBe(2);
    expect(svg.match(/>world</g)?.length).toBe(2);
  });

  it("paints the value block with the supplied color", () => {
    const svg = buildBadgeSvg({ label: "a", value: "b", color: "#112233" });
    expect(svg).toContain('fill="#112233"');
  });

  it("is deterministic — same input yields byte-identical output", () => {
    const a = buildBadgeSvg({ label: "accessibility", value: "92/100", color: "#22c55e" });
    const b = buildBadgeSvg({ label: "accessibility", value: "92/100", color: "#22c55e" });
    expect(a).toBe(b);
  });

  it("escapes angle brackets and quotes in both label and value", () => {
    const svg = buildBadgeSvg({
      label: '<script>alert("x")</script>',
      value: "a&b",
      color: "#000",
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp;");
    // value color string itself is simple — should not appear as an unescaped
    // attribute injection either.
    expect(svg.match(/<svg /g)?.length).toBe(1);
  });

  it("escapes a quote inside the color field so the SVG stays well-formed", () => {
    const svg = buildBadgeSvg({ label: "a", value: "b", color: '"onclick=x' });
    expect(svg).not.toContain('""'); // no naked double-quote in attribute position
    expect(svg).toContain("&quot;onclick=x");
  });

  it("uses the default label color when none is supplied", () => {
    const svg = buildBadgeSvg({ label: "a", value: "b", color: "#000" });
    expect(svg).toContain('fill="#555555"');
  });

  it("respects a custom labelColor when supplied", () => {
    const svg = buildBadgeSvg({
      label: "a",
      value: "b",
      color: "#000",
      labelColor: "#abcdef",
    });
    expect(svg).toContain('fill="#abcdef"');
  });

  it("width attribute grows with longer text", () => {
    const short = buildBadgeSvg({ label: "x", value: "y", color: "#000" });
    const long = buildBadgeSvg({ label: "accessibility score", value: "99/100", color: "#000" });
    const shortWidth = Number(short.match(/^<svg [^>]*width="(\d+)"/)?.[1]);
    const longWidth = Number(long.match(/^<svg [^>]*width="(\d+)"/)?.[1]);
    expect(longWidth).toBeGreaterThan(shortWidth);
  });
});

describe("buildScoreBadgeSvg", () => {
  it("renders the canonical 'accessibility: NN/100' label pair", () => {
    const svg = buildScoreBadgeSvg(87);
    expect(svg).toContain(">accessibility<");
    expect(svg).toContain(">87/100<");
  });

  it("renders a neutral 'no data' badge when the score is null", () => {
    const svg = buildScoreBadgeSvg(null);
    expect(svg).toContain(">no data<");
    // Neutral gray, not red — ensures brand-new sites don't look "failing".
    expect(svg).toContain("#9ca3af");
  });

  it("renders a neutral 'no data' badge when the score is NaN", () => {
    const svg = buildScoreBadgeSvg(Number.NaN);
    expect(svg).toContain(">no data<");
    expect(svg).toContain("#9ca3af");
  });

  it("picks the right color for each score bucket", () => {
    expect(buildScoreBadgeSvg(95)).toContain("#22c55e"); // green
    expect(buildScoreBadgeSvg(75)).toContain("#eab308"); // yellow
    expect(buildScoreBadgeSvg(55)).toContain("#f97316"); // orange
    expect(buildScoreBadgeSvg(10)).toContain("#ef4444"); // red
  });
});

describe("buildEmbedSnippets", () => {
  it("builds image URL pointing at /api/badges/{id}/score.svg", () => {
    const s = buildEmbedSnippets("https://app.accesskit.io", "w_123");
    expect(s.imageUrl).toBe("https://app.accesskit.io/api/badges/w_123/score.svg");
  });

  it("normalizes a trailing slash on the base URL", () => {
    const s = buildEmbedSnippets("https://app.accesskit.io/", "w_123");
    expect(s.imageUrl).toBe("https://app.accesskit.io/api/badges/w_123/score.svg");
  });

  it("builds markdown and html snippets that both link to the website view", () => {
    const s = buildEmbedSnippets("https://app.accesskit.io", "w_xyz");
    expect(s.markdown).toBe(
      "[![Accessibility score](https://app.accesskit.io/api/badges/w_xyz/score.svg)](https://app.accesskit.io/websites/w_xyz)",
    );
    expect(s.html).toBe(
      '<a href="https://app.accesskit.io/websites/w_xyz"><img src="https://app.accesskit.io/api/badges/w_xyz/score.svg" alt="Accessibility score" /></a>',
    );
  });
});
