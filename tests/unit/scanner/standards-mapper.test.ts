import {
  mapAxeImpactToSeverity,
  mapAxeViolationToSeverity,
  isBestPracticeOnly,
  mapTagsToCategory,
  mapTagsToStandards,
  extractWcagCriterion,
  extractWcagLevel,
  standardsToAxeTags,
  bestPracticeRulesEnabled,
  WCAG_22_COVERAGE,
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
  const originalEnv = process.env.SCANNER_INCLUDE_BEST_PRACTICE;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SCANNER_INCLUDE_BEST_PRACTICE;
    } else {
      process.env.SCANNER_INCLUDE_BEST_PRACTICE = originalEnv;
    }
  });

  it("returns WCAG 2.2 AA tag set as default when array is empty", () => {
    delete process.env.SCANNER_INCLUDE_BEST_PRACTICE;
    const tags = standardsToAxeTags([]);
    expect(tags).toContain("wcag2a");
    expect(tags).toContain("wcag2aa");
    expect(tags).toContain("wcag21a");
    expect(tags).toContain("wcag21aa");
    expect(tags).toContain("wcag22aa");
  });

  it("default tag set does NOT include best-practice unless opted in", () => {
    delete process.env.SCANNER_INCLUDE_BEST_PRACTICE;
    expect(standardsToAxeTags([])).not.toContain("best-practice");
  });

  it("adds best-practice when SCANNER_INCLUDE_BEST_PRACTICE=true", () => {
    process.env.SCANNER_INCLUDE_BEST_PRACTICE = "true";
    expect(standardsToAxeTags(["WCAG22_AA"])).toContain("best-practice");
  });

  it("does not add best-practice for other truthy values", () => {
    process.env.SCANNER_INCLUDE_BEST_PRACTICE = "1";
    expect(standardsToAxeTags(["WCAG22_AA"])).not.toContain("best-practice");
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

// ─── bestPracticeRulesEnabled ─────────────────────────────────────────────────

describe("bestPracticeRulesEnabled", () => {
  const originalEnv = process.env.SCANNER_INCLUDE_BEST_PRACTICE;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SCANNER_INCLUDE_BEST_PRACTICE;
    } else {
      process.env.SCANNER_INCLUDE_BEST_PRACTICE = originalEnv;
    }
  });

  it("returns false when env var is unset", () => {
    delete process.env.SCANNER_INCLUDE_BEST_PRACTICE;
    expect(bestPracticeRulesEnabled()).toBe(false);
  });

  it("returns false for any non-exact-'true' value", () => {
    process.env.SCANNER_INCLUDE_BEST_PRACTICE = "yes";
    expect(bestPracticeRulesEnabled()).toBe(false);
    process.env.SCANNER_INCLUDE_BEST_PRACTICE = "True";
    expect(bestPracticeRulesEnabled()).toBe(false);
  });

  it("returns true only when exactly 'true'", () => {
    process.env.SCANNER_INCLUDE_BEST_PRACTICE = "true";
    expect(bestPracticeRulesEnabled()).toBe(true);
  });
});

// ─── isBestPracticeOnly / mapAxeViolationToSeverity ──────────────────────────

describe("isBestPracticeOnly", () => {
  it("returns true when tags contain only best-practice", () => {
    expect(isBestPracticeOnly(["best-practice", "cat.semantics"])).toBe(true);
  });

  it("returns false when any WCAG tag is present alongside best-practice", () => {
    expect(isBestPracticeOnly(["best-practice", "wcag2aa"])).toBe(false);
    expect(isBestPracticeOnly(["best-practice", "wcag412"])).toBe(false);
    expect(isBestPracticeOnly(["best-practice", "wcag22aa"])).toBe(false);
  });

  it("returns false when best-practice tag is absent", () => {
    expect(isBestPracticeOnly(["cat.semantics", "wcag2aa"])).toBe(false);
    expect(isBestPracticeOnly([])).toBe(false);
  });

  it("treats section508 as a real standard, not best-practice", () => {
    expect(isBestPracticeOnly(["best-practice", "section508"])).toBe(false);
  });
});

describe("mapAxeViolationToSeverity", () => {
  it("down-weights best-practice-only violations to MINOR regardless of impact", () => {
    expect(mapAxeViolationToSeverity("critical", ["best-practice", "cat.semantics"])).toBe("MINOR");
    expect(mapAxeViolationToSeverity("serious", ["best-practice"])).toBe("MINOR");
    expect(mapAxeViolationToSeverity(null, ["best-practice"])).toBe("MINOR");
  });

  it("delegates to mapAxeImpactToSeverity when a WCAG tag is present", () => {
    expect(mapAxeViolationToSeverity("critical", ["wcag2aa", "best-practice"])).toBe("CRITICAL");
    expect(mapAxeViolationToSeverity("serious", ["wcag22aa"])).toBe("SERIOUS");
    expect(mapAxeViolationToSeverity("minor", ["wcag2a"])).toBe("MINOR");
  });
});

// ─── WCAG 2.2 coverage matrix ────────────────────────────────────────────────

describe("WCAG_22_COVERAGE", () => {
  it("documents all 9 WCAG 2.2 new success criteria", () => {
    expect(WCAG_22_COVERAGE).toHaveLength(9);
    const criteria = WCAG_22_COVERAGE.map((c) => c.criterion).sort();
    expect(criteria).toEqual([
      "2.4.11",
      "2.4.12",
      "2.4.13",
      "2.5.7",
      "2.5.8",
      "3.2.6",
      "3.3.7",
      "3.3.8",
      "3.3.9",
    ]);
  });

  it("flags SC 2.5.8 Target Size (Minimum) as automatable via axe target-size rule", () => {
    const sc = WCAG_22_COVERAGE.find((c) => c.criterion === "2.5.8");
    expect(sc).toBeDefined();
    expect(sc?.automatable).toBe(true);
    expect(sc?.axeRuleId).toBe("target-size");
    expect(sc?.level).toBe("AA");
  });

  it("marks the remaining 8 new WCAG 2.2 SCs as not automatable", () => {
    const nonAutomatable = WCAG_22_COVERAGE.filter((c) => !c.automatable);
    expect(nonAutomatable).toHaveLength(8);
    expect(nonAutomatable.every((c) => !c.axeRuleId)).toBe(true);
  });
});
