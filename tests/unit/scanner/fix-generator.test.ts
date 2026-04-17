import { generateFixSuggestion, estimateEffort } from "@/scanner/fix-generator";

// ─── generateFixSuggestion ────────────────────────────────────────────────────

describe("generateFixSuggestion", () => {
  it("returns a string for known rules", () => {
    const fix = generateFixSuggestion("image-alt");
    expect(typeof fix).toBe("string");
    expect((fix as string).length).toBeGreaterThan(0);
  });

  it("returns undefined for unknown rules", () => {
    expect(generateFixSuggestion("completely-unknown-rule-xyz")).toBeUndefined();
  });

  it("provides a fix for image-alt", () => {
    const fix = generateFixSuggestion("image-alt");
    expect(fix).toContain("alt");
  });

  it("provides a fix for label", () => {
    const fix = generateFixSuggestion("label");
    expect(fix).toContain("<label");
  });

  it("provides a fix for color-contrast", () => {
    const fix = generateFixSuggestion("color-contrast");
    expect(fix).toContain("contrast");
  });

  it("provides a fix for link-name", () => {
    const fix = generateFixSuggestion("link-name");
    expect(fix).toBeDefined();
  });

  it("provides a fix for button-name", () => {
    const fix = generateFixSuggestion("button-name");
    expect(fix).toBeDefined();
  });

  it("provides a fix for html-has-lang", () => {
    const fix = generateFixSuggestion("html-has-lang");
    expect(fix).toContain("lang");
  });

  it("provides a fix for document-title", () => {
    const fix = generateFixSuggestion("document-title");
    expect(fix).toContain("title");
  });
});

// ─── estimateEffort ───────────────────────────────────────────────────────────

describe("estimateEffort", () => {
  it("returns a valid EffortLevel for known rules", () => {
    const validLevels = ["LOW", "MEDIUM", "HIGH"];
    const effort = estimateEffort("image-alt");
    expect(validLevels).toContain(effort);
  });

  it("classifies image-alt as LOW effort", () => {
    expect(estimateEffort("image-alt")).toBe("LOW");
  });

  it("classifies color-contrast as MEDIUM effort", () => {
    expect(estimateEffort("color-contrast")).toBe("MEDIUM");
  });

  it("classifies keyboard-navigation issues as HIGH effort", () => {
    // keyboard and focus-trap rules are HIGH effort
    expect(estimateEffort("keyboard")).toBe("HIGH");
  });

  it("returns MEDIUM for unknown rules (safe default)", () => {
    expect(estimateEffort("totally-unknown-rule")).toBe("MEDIUM");
  });

  it("returns consistent effort for the same rule", () => {
    const e1 = estimateEffort("label");
    const e2 = estimateEffort("label");
    expect(e1).toBe(e2);
  });
});
