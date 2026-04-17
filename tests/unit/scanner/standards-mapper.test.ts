import {
  mapAxeImpactToSeverity,
  mapTagsToCategory,
  mapTagsToStandards,
  extractWcagCriterion,
  extractWcagLevel,
  standardsToAxeTags,
} from "@/scanner/standards-mapper";

// ─── mapAxeImpactToSeverity ───────────────────────────────────────────────────

describe("mapAxeImpactToSeverity", () => {
  it("maps 'critical' → CRITICAL", () => {
    expect(mapAxeImpactToSeverity("critical")).toBe("CRITICAL");
  });

  it("maps 'serious' → SERIOUS", () => {
    expect(mapAxeImpactToSeverity("serious")).toBe("SERIOUS");
  });

  it("maps 'minor' → MINOR", () => {
    expect(mapAxeImpactToSeverity("minor")).toBe("MINOR");
  });

  it("maps 'moderate' → MODERATE", () => {
    expect(mapAxeImpactToSeverity("moderate")).toBe("MODERATE");
  });

  it("defaults to MODERATE for null", () => {
    expect(mapAxeImpactToSeverity(null)).toBe("MODERATE");
  });

  it("defaults to MODERATE for undefined", () => {
    expect(mapAxeImpactToSeverity(undefined)).toBe("MODERATE");
  });

  it("defaults to MODERATE for unknown values", () => {
    expect(mapAxeImpactToSeverity("unknown")).toBe("MODERATE");
  });
});

// ─── mapTagsToCategory ────────────────────────────────────────────────────────

describe("mapTagsToCategory", () => {
  it("maps cat.aria tags to ARIA", () => {
    expect(mapTagsToCategory(["wcag2aa", "cat.aria"])).toBe("ARIA");
  });

  it("maps cat.color tags to COLOR", () => {
    expect(mapTagsToCategory(["cat.color", "wcag2aa"])).toBe("COLOR");
  });

  it("maps cat.forms tags to FORMS", () => {
    expect(mapTagsToCategory(["cat.forms"])).toBe("FORMS");
  });

  it("maps cat.images / cat.text-alternatives to IMAGES", () => {
    expect(mapTagsToCategory(["cat.images"])).toBe("IMAGES");
    expect(mapTagsToCategory(["cat.text-alternatives"])).toBe("IMAGES");
  });

  it("maps cat.keyboard to KEYBOARD", () => {
    expect(mapTagsToCategory(["cat.keyboard"])).toBe("KEYBOARD");
  });

  it("maps cat.time-and-media to MULTIMEDIA", () => {
    expect(mapTagsToCategory(["cat.time-and-media"])).toBe("MULTIMEDIA");
  });

  it("defaults to STRUCTURE when no category tag is present", () => {
    expect(mapTagsToCategory(["wcag2aa", "wcag2a"])).toBe("STRUCTURE");
  });

  it("returns STRUCTURE for empty tags array", () => {
    expect(mapTagsToCategory([])).toBe("STRUCTURE");
  });
});

// ─── mapTagsToStandards ───────────────────────────────────────────────────────

describe("mapTagsToStandards", () => {
  it("maps wcag2a tag to all WCAG/EN standards", () => {
    const standards = mapTagsToStandards(["wcag2a"]);
    expect(standards).toContain("WCAG21_A");
    expect(standards).toContain("WCAG21_AA");
    expect(standards).toContain("WCAG22_AA");
    expect(standards).toContain("EN_301_549");
  });

  it("maps wcag2aa to AA-level standards only", () => {
    const standards = mapTagsToStandards(["wcag2aa"]);
    expect(standards).toContain("WCAG21_AA");
    expect(standards).not.toContain("WCAG21_A");
  });

  it("maps section508 tag to SECTION_508 standard", () => {
    const standards = mapTagsToStandards(["section508"]);
    expect(standards).toEqual(["SECTION_508"]);
  });

  it("deduplicates standards across multiple matching tags", () => {
    const standards = mapTagsToStandards(["wcag2a", "wcag21a"]);
    const unique = new Set(standards);
    expect(unique.size).toBe(standards.length); // no duplicates
  });

  it("returns empty array for unknown tags", () => {
    expect(mapTagsToStandards(["unknown", "cat.forms"])).toEqual([]);
  });
});

// ─── extractWcagCriterion ─────────────────────────────────────────────────────

describe("extractWcagCriterion", () => {
  it("parses 3-digit criterion: wcag111 → 1.1.1", () => {
    expect(extractWcagCriterion(["wcag2aa", "wcag111"])).toBe("1.1.1");
  });

  it("parses 4-digit criterion: wcag1410 → 1.4.10", () => {
    expect(extractWcagCriterion(["wcag1410"])).toBe("1.4.10");
  });

  it("parses wcag412 → 4.1.2", () => {
    expect(extractWcagCriterion(["wcag412"])).toBe("4.1.2");
  });

  it("returns undefined when no wcag digit tag is present", () => {
    expect(extractWcagCriterion(["wcag2aa", "cat.aria"])).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(extractWcagCriterion([])).toBeUndefined();
  });
});

// ─── extractWcagLevel ────────────────────────────────────────────────────────

describe("extractWcagLevel", () => {
  it("returns AA for wcag2aa", () => {
    expect(extractWcagLevel(["wcag2aa"])).toBe("AA");
  });

  it("returns AA for wcag21aa", () => {
    expect(extractWcagLevel(["wcag21aa"])).toBe("AA");
  });

  it("returns AA for wcag22aa", () => {
    expect(extractWcagLevel(["wcag22aa"])).toBe("AA");
  });

  it("returns A for wcag2a (no AA tag)", () => {
    expect(extractWcagLevel(["wcag2a"])).toBe("A");
  });

  it("returns A for wcag21a", () => {
    expect(extractWcagLevel(["wcag21a"])).toBe("A");
  });

  it("returns undefined when no level tag is present", () => {
    expect(extractWcagLevel(["section508", "cat.forms"])).toBeUndefined();
  });
});

// ─── standardsToAxeTags ───────────────────────────────────────────────────────

describe("standardsToAxeTags", () => {
  it("returns WCAG 2.1 AA tags as default when array is empty", () => {
    const tags = standardsToAxeTags([]);
    expect(tags).toContain("wcag2a");
    expect(tags).toContain("wcag2aa");
    expect(tags).toContain("wcag21a");
    expect(tags).toContain("wcag21aa");
  });

  it("WCAG21_A maps to wcag2a and wcag21a tags", () => {
    const tags = standardsToAxeTags(["WCAG21_A"]);
    expect(tags).toContain("wcag2a");
    expect(tags).toContain("wcag21a");
  });

  it("WCAG22_AA includes wcag22aa tag", () => {
    const tags = standardsToAxeTags(["WCAG22_AA"]);
    expect(tags).toContain("wcag22aa");
  });

  it("SECTION_508 maps to section508 tag", () => {
    const tags = standardsToAxeTags(["SECTION_508"]);
    expect(tags).toContain("section508");
    expect(tags).not.toContain("wcag2a");
  });

  it("deduplicates tags across overlapping standards", () => {
    const tags = standardsToAxeTags(["WCAG21_AA", "WCAG22_AA"]);
    const unique = new Set(tags);
    expect(unique.size).toBe(tags.length);
  });
});
