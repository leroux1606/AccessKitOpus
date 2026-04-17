import { generateFingerprint } from "@/scanner/deduplicator";

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

  it("differs when the CSS selector changes", () => {
    const fp1 = generateFingerprint("image-alt", "#logo", "https://example.com");
    const fp2 = generateFingerprint("image-alt", ".banner img", "https://example.com");
    expect(fp1).not.toBe(fp2);
  });

  it("uses the origin only — different paths on the same domain produce the same fingerprint", () => {
    const fp1 = generateFingerprint("label", "input#email", "https://example.com/contact");
    const fp2 = generateFingerprint("label", "input#email", "https://example.com/about");
    // Both share the same origin (https://example.com), so fingerprints match
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
});
