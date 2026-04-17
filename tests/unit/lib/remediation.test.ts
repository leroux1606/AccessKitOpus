/**
 * Unit tests for mechanical remediation patches (M1).
 *
 * Locks in:
 *   - Every supported rule produces a real diff on a fixture that contains
 *     the violation, and null on a fixture that already passes.
 *   - Idempotence: applying the fix twice doesn't produce a second patch.
 *   - Unified diff output is valid git-apply input (hunk header, leading
 *     +/-/space markers, terminating newline).
 *   - Rules not in the allowlist return null so callers can fall back to
 *     AI-generated suggestions rather than fabricated patches.
 */

import {
  buildRemediationPatch,
  canAutoRemediate,
  supportedRuleIds,
  toUnifiedDiff,
} from "@/lib/remediation";

const FILE = "pages/index.html";

describe("canAutoRemediate / supportedRuleIds", () => {
  it("returns true for every supported rule and false for everything else", () => {
    for (const id of supportedRuleIds()) {
      expect(canAutoRemediate(id)).toBe(true);
    }
    expect(canAutoRemediate("color-contrast")).toBe(false);
    expect(canAutoRemediate("region")).toBe(false);
  });

  it("supportedRuleIds is stable and alphabetically sorted for downstream UI", () => {
    expect(supportedRuleIds()).toEqual([...supportedRuleIds()].sort());
    expect(supportedRuleIds()).toContain("image-alt");
  });
});

describe("image-alt patcher", () => {
  it("adds alt=\"\" to an <img> lacking one", () => {
    const src = `<p><img src="/a.png"></p>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "image-alt", cssSelector: "img" });
    expect(patch).not.toBeNull();
    expect(patch!.updatedContent).toContain(`alt=""`);
  });

  it("returns null when every <img> already has alt (idempotent)", () => {
    const src = `<img src="/a.png" alt="cover art">`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "image-alt", cssSelector: "img" });
    expect(patch).toBeNull();
  });

  it("preserves self-closing syntax where present", () => {
    const src = `<img src="/a.png" />`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "image-alt", cssSelector: "img" });
    expect(patch).not.toBeNull();
    expect(patch!.updatedContent).toMatch(/<img [^>]*alt="" \/>/);
  });

  it("leaves already-good images untouched while fixing only the offenders", () => {
    const src = `<img src="a" alt="ok">\n<img src="b">\n<img src="c" alt="also ok">`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "image-alt", cssSelector: "img" });
    expect(patch).not.toBeNull();
    // Only one alt=\"\" was added (to the middle image).
    expect(patch!.updatedContent.match(/alt=""/g)?.length).toBe(1);
  });
});

describe("html-has-lang patcher", () => {
  it("adds lang=\"en\" to a bare <html>", () => {
    const src = `<!doctype html><html><head></head><body></body></html>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "html-has-lang", cssSelector: "html" });
    expect(patch).not.toBeNull();
    expect(patch!.updatedContent).toContain(`<html lang="en">`);
  });

  it("returns null when lang is already present", () => {
    const src = `<html lang="fr">`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "html-has-lang", cssSelector: "html" });
    expect(patch).toBeNull();
  });

  it("preserves existing attributes on <html>", () => {
    const src = `<html data-theme="dark">`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "html-has-lang", cssSelector: "html" });
    expect(patch!.updatedContent).toContain(`<html data-theme="dark" lang="en">`);
  });
});

describe("button-name patcher", () => {
  it("adds aria-label derived from the selector when the button is empty", () => {
    const src = `<button id="submit-form"></button>`;
    const patch = buildRemediationPatch(FILE, src, {
      ruleId: "button-name",
      cssSelector: "#submit-form",
    });
    expect(patch).not.toBeNull();
    expect(patch!.updatedContent).toContain(`aria-label="submit form"`);
  });

  it("leaves buttons with existing text content alone", () => {
    const src = `<button>Click me</button>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "button-name", cssSelector: "button" });
    expect(patch).toBeNull();
  });

  it("does not overwrite an existing aria-label", () => {
    const src = `<button aria-label="submit"></button>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "button-name", cssSelector: "button" });
    expect(patch).toBeNull();
  });

  it("falls back to a generic placeholder when the selector has no id/class", () => {
    const src = `<button></button>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "button-name", cssSelector: "button" });
    expect(patch!.updatedContent).toContain(`aria-label="Describe me"`);
  });
});

describe("link-name patcher", () => {
  it("labels empty anchors with a hint derived from the selector", () => {
    const src = `<a href="/docs" class="footer-link"></a>`;
    const patch = buildRemediationPatch(FILE, src, {
      ruleId: "link-name",
      cssSelector: ".footer-link",
    });
    expect(patch).not.toBeNull();
    expect(patch!.updatedContent).toContain(`aria-label="footer link"`);
  });

  it("leaves anchors with visible text untouched", () => {
    const src = `<a href="/docs">Docs</a>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "link-name", cssSelector: "a" });
    expect(patch).toBeNull();
  });
});

describe("meta-viewport patcher", () => {
  it("removes user-scalable=no to allow zoom", () => {
    const src = `<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "meta-viewport", cssSelector: "meta" });
    expect(patch).not.toBeNull();
    expect(patch!.updatedContent).not.toContain("user-scalable=no");
    expect(patch!.updatedContent).toContain("initial-scale=1");
  });

  it("returns null when viewport meta already allows zoom", () => {
    const src = `<meta name="viewport" content="width=device-width, initial-scale=1">`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "meta-viewport", cssSelector: "meta" });
    expect(patch).toBeNull();
  });
});

describe("unsupported rules", () => {
  it("returns null so callers can fall back to AI-generated suggestions", () => {
    const patch = buildRemediationPatch(FILE, "<html></html>", {
      ruleId: "color-contrast",
      cssSelector: "p",
    });
    expect(patch).toBeNull();
  });
});

describe("toUnifiedDiff", () => {
  it("returns empty string when the file is unchanged", () => {
    expect(toUnifiedDiff(FILE, "a\nb\nc\n", "a\nb\nc\n")).toBe("");
  });

  it("emits valid a/ + b/ headers, hunk marker, and trailing newline", () => {
    const before = "line1\nline2\nline3\nline4\n";
    const after = "line1\nchanged\nline3\nline4\n";
    const diff = toUnifiedDiff(FILE, before, after);
    expect(diff).toContain(`--- a/${FILE}`);
    expect(diff).toContain(`+++ b/${FILE}`);
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(diff).toMatch(/\n$/);
  });

  it("marks changed lines with - / + prefixes and context with a leading space", () => {
    const before = "unchanged\nbad\nalso-unchanged\n";
    const after = "unchanged\ngood\nalso-unchanged\n";
    const diff = toUnifiedDiff(FILE, before, after);
    expect(diff).toContain(" unchanged");
    expect(diff).toContain("-bad");
    expect(diff).toContain("+good");
    expect(diff).toContain(" also-unchanged");
  });
});

describe("end-to-end patch metadata", () => {
  it("every patch carries a non-empty summary, rationale, and unified diff", () => {
    const src = `<html><body><img src="a"></body></html>`;
    const patch = buildRemediationPatch(FILE, src, { ruleId: "image-alt", cssSelector: "img" });
    expect(patch).not.toBeNull();
    expect(patch!.summary.length).toBeGreaterThan(0);
    expect(patch!.rationale.length).toBeGreaterThan(0);
    expect(patch!.unifiedDiff).toContain(`--- a/${FILE}`);
    expect(patch!.ruleId).toBe("image-alt");
  });
});
