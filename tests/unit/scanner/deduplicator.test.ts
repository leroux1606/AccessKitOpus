import { generateFingerprint, normalizeSelector } from "@/scanner/deduplicator";

describe("generateFingerprint", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const fp = generateFingerprint("image-alt", "#logo", "https://example.com");
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs always produce the same fingerprint", () => {
    const fp1 = generateFingerprint("image-alt", "#logo", "https://example.com");
    const fp2 = generateFingerprint("image-alt", "#logo", "https://example.com");
    expect(fp1).toBe(fp2);
  });

  it("differs when the rule ID changes", () => {
    const fp1 = generateFingerprint("image-alt", "#logo", "https://example.com");
    const fp2 = generateFingerprint("color-contrast", "#logo", "https://example.com");
    expect(fp1).not.toBe(fp2);
  });

  it("differs when the CSS selector changes (different IDs)", () => {
    const fp1 = generateFingerprint("image-alt", "#logo", "https://example.com");
    const fp2 = generateFingerprint("image-alt", "#banner", "https://example.com");
    expect(fp1).not.toBe(fp2);
  });

  it("uses the origin only — different paths on the same domain produce the same fingerprint", () => {
    const fp1 = generateFingerprint("label", "input#email", "https://example.com/contact");
    const fp2 = generateFingerprint("label", "input#email", "https://example.com/about");
    expect(fp1).toBe(fp2);
  });

  it("differs for different domains", () => {
    const fp1 = generateFingerprint("label", "input#email", "https://example.com");
    const fp2 = generateFingerprint("label", "input#email", "https://other.com");
    expect(fp1).not.toBe(fp2);
  });

  it("handles complex CSS selectors without error", () => {
    const fp = generateFingerprint(
      "aria-required-children",
      "ul[role='listbox'] > li:nth-child(2)",
      "https://example.com",
    );
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  // ─── Phase K2: stability across layout drift ────────────────────────────

  it("is stable when a positional pseudo-class shifts (e.g. nth-child count changes)", () => {
    const fp1 = generateFingerprint(
      "color-contrast",
      "main > ul > li:nth-child(3) > a",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "color-contrast",
      "main > ul > li:nth-child(7) > a",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("is stable when multiple ordinal selectors drift together", () => {
    const fp1 = generateFingerprint(
      "button-name",
      "div:nth-of-type(2) > section:first-child > button",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "button-name",
      "div:nth-of-type(5) > section:last-child > button",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("is stable when XPath-style bracket indices drift", () => {
    const fp1 = generateFingerprint(
      "label",
      "form > div[1] > input",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "label",
      "form > div[7] > input",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("is stable across build-hash class renames (Emotion, styled-components, CSS modules)", () => {
    const fp1 = generateFingerprint(
      "color-contrast",
      "main > div.container > button.btn.css-1a2b3c4",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "color-contrast",
      "main > div.container > button.btn.css-xyz9876",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("is stable across styled-components sc-* hash renames", () => {
    const fp1 = generateFingerprint(
      "aria-valid-attr",
      "main > section.sc-aBcD12 > button.sc-efgh34",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "aria-valid-attr",
      "main > section.sc-qwer56 > button.sc-uiop78",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("preserves semantic class names (non-hash) as uniqueness signal", () => {
    const fp1 = generateFingerprint(
      "color-contrast",
      "main > button.btn-primary",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "color-contrast",
      "main > button.btn-danger",
      "https://example.com",
    );
    expect(fp1).not.toBe(fp2);
  });

  it("is order-insensitive for class tokens (.a.b === .b.a)", () => {
    const fp1 = generateFingerprint(
      "label",
      "input.required.primary",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "label",
      "input.primary.required",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("collapses whitespace so extra spaces don't re-hash", () => {
    const fp1 = generateFingerprint(
      "label",
      "main > form > input",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "label",
      "main  >   form   >  input",
      "https://example.com",
    );
    expect(fp1).toBe(fp2);
  });

  it("preserves IDs as a strong uniqueness signal", () => {
    const fp1 = generateFingerprint(
      "label",
      "form#checkout > input",
      "https://example.com",
    );
    const fp2 = generateFingerprint(
      "label",
      "form#signup > input",
      "https://example.com",
    );
    expect(fp1).not.toBe(fp2);
  });
});

describe("normalizeSelector", () => {
  it("empty input returns empty string", () => {
    expect(normalizeSelector("")).toBe("");
  });

  it("strips :nth-child()", () => {
    expect(normalizeSelector("li:nth-child(3)")).toBe("li");
  });

  it("strips :nth-of-type() and :first-child", () => {
    expect(normalizeSelector("div:nth-of-type(2) > p:first-child")).toBe("div > p");
  });

  it("strips XPath-style bracket indices", () => {
    expect(normalizeSelector("div[1] > span[5]")).toBe("div > span");
  });

  it("strips generated CSS-in-JS class hashes but preserves semantic classes", () => {
    expect(normalizeSelector("button.btn-primary.css-1a2b3c4")).toBe("button.btn-primary");
    expect(normalizeSelector("div.sc-abcDEF12")).toBe("div");
  });

  it("sorts class tokens for order-independence", () => {
    expect(normalizeSelector("div.beta.alpha")).toBe("div.alpha.beta");
    expect(normalizeSelector("div.alpha.beta")).toBe("div.alpha.beta");
  });

  it("sorts comma-separated branches", () => {
    const a = normalizeSelector("button, a");
    const b = normalizeSelector("a, button");
    expect(a).toBe(b);
  });

  it("preserves ID and attribute selectors", () => {
    expect(normalizeSelector("form#checkout > input[type='email']")).toBe(
      "form#checkout > input[type='email']",
    );
  });

  it("lowercases tag names", () => {
    expect(normalizeSelector("DIV > SPAN.foo")).toBe("div > span.foo");
  });

  it("collapses internal whitespace around combinators", () => {
    expect(normalizeSelector("a   >   b  +  c   ~   d")).toBe("a > b + c ~ d");
  });

  it("handles an empty compound (pure pseudo-class) by inserting wildcard", () => {
    expect(normalizeSelector(":nth-child(1)")).toBe("*");
  });
});
