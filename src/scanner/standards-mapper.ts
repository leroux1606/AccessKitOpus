import type { Category } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// WCAG 2.2 coverage audit (Phase K1)
// ─────────────────────────────────────────────────────────────────────────────
// axe-core v4.11 adds the `wcag22aa` tag to rules that back WCAG 2.2
// Level AA success criteria. Of the nine new criteria introduced by WCAG 2.2
// (six at A/AA, three at AAA), only one is fully automatable today: SC 2.5.8
// Target Size (Minimum), implemented by the `target-size` rule. The rest
// require either cross-page context (3.2.6 Consistent Help, 3.3.7 Redundant
// Entry), viewport/focus behaviour hard to observe deterministically
// (2.4.11/2.4.12 Focus Not Obscured, 2.4.13 Focus Appearance), human
// interaction (2.5.7 Dragging Movements), or cognitive judgment
// (3.3.8/3.3.9 Accessible Authentication). pa11y's HTML_CodeSniffer runner
// still targets WCAG 2.1 only, so its WCAG2AA standard is used as-is and
// any rules it flags are folded into WCAG2.1-era buckets for dashboard
// grouping.
//
// If axe ships additional `wcag22aa`-tagged rules in future minor releases
// we automatically pick them up — `standardsToAxeTags` emits the full
// WCAG 2.2 AA tag set and `TAG_TO_STANDARDS` already maps `wcag22aa`.
//
// Keep the matrix below in sync with axe-core's release notes so the
// product surface accurately represents coverage.
export const WCAG_22_COVERAGE: ReadonlyArray<{
  criterion: string;
  level: "A" | "AA" | "AAA";
  name: string;
  automatable: boolean;
  axeRuleId?: string;
  notes?: string;
}> = [
  {
    criterion: "2.4.11",
    level: "AA",
    name: "Focus Not Obscured (Minimum)",
    automatable: false,
    notes: "Requires scroll/overlay observation during interaction.",
  },
  {
    criterion: "2.4.12",
    level: "AAA",
    name: "Focus Not Obscured (Enhanced)",
    automatable: false,
  },
  {
    criterion: "2.4.13",
    level: "AAA",
    name: "Focus Appearance",
    automatable: false,
    notes: "Visual-only judgement, not reliably static-analysable.",
  },
  {
    criterion: "2.5.7",
    level: "AA",
    name: "Dragging Movements",
    automatable: false,
    notes: "Requires pointer-interaction modelling.",
  },
  {
    criterion: "2.5.8",
    level: "AA",
    name: "Target Size (Minimum)",
    automatable: true,
    axeRuleId: "target-size",
  },
  {
    criterion: "3.2.6",
    level: "A",
    name: "Consistent Help",
    automatable: false,
    notes: "Cross-page consistency check.",
  },
  {
    criterion: "3.3.7",
    level: "A",
    name: "Redundant Entry",
    automatable: false,
    notes: "Cross-form flow analysis.",
  },
  {
    criterion: "3.3.8",
    level: "AA",
    name: "Accessible Authentication (Minimum)",
    automatable: false,
    notes: "Cognitive function test heuristics not implemented by axe.",
  },
  {
    criterion: "3.3.9",
    level: "AAA",
    name: "Accessible Authentication (Enhanced)",
    automatable: false,
  },
];

// Map axe-core tag → which of our Standard enum values this implies
const TAG_TO_STANDARDS: Record<string, string[]> = {
  wcag2a: ["WCAG21_A", "WCAG21_AA", "WCAG22_AA", "EN_301_549"],
  wcag2aa: ["WCAG21_AA", "WCAG22_AA", "EN_301_549"],
  wcag21a: ["WCAG21_A", "WCAG21_AA", "WCAG22_AA", "EN_301_549"],
  wcag21aa: ["WCAG21_AA", "WCAG22_AA", "EN_301_549"],
  wcag22aa: ["WCAG22_AA"],
  section508: ["SECTION_508"],
};

// Map axe cat.* tags → our Category enum
const CAT_TO_CATEGORY: Record<string, Category> = {
  "cat.aria": "ARIA",
  "cat.color": "COLOR",
  "cat.forms": "FORMS",
  "cat.images": "IMAGES",
  "cat.keyboard": "KEYBOARD",
  "cat.language": "STRUCTURE",
  "cat.name-role-value": "ARIA",
  "cat.parsing": "STRUCTURE",
  "cat.semantics": "STRUCTURE",
  "cat.sensory-and-visual-cues": "COLOR",
  "cat.structure": "STRUCTURE",
  "cat.tables": "STRUCTURE",
  "cat.text-alternatives": "IMAGES",
  "cat.time-and-media": "MULTIMEDIA",
};

export function mapTagsToStandards(tags: string[]): string[] {
  const standards = new Set<string>();
  for (const tag of tags) {
    const mapped = TAG_TO_STANDARDS[tag];
    if (mapped) {
      for (const s of mapped) standards.add(s);
    }
  }
  return Array.from(standards);
}

export function mapTagsToCategory(tags: string[]): Category {
  for (const tag of tags) {
    const category = CAT_TO_CATEGORY[tag];
    if (category) return category;
  }
  return "STRUCTURE";
}

// Parse "wcag111" → "1.1.1", "wcag1410" → "1.4.10"
export function extractWcagCriterion(tags: string[]): string | undefined {
  for (const tag of tags) {
    const match = tag.match(/^wcag(\d{3,})$/);
    const digits = match?.[1];
    if (digits && digits.length >= 3) {
      const principle = digits[0];
      const guideline = digits[1];
      const criterion = digits.slice(2);
      return `${principle}.${guideline}.${criterion}`;
    }
  }
  return undefined;
}

export function extractWcagLevel(tags: string[]): string | undefined {
  if (tags.some((t) => ["wcag2aa", "wcag21aa", "wcag22aa"].includes(t))) return "AA";
  if (tags.some((t) => ["wcag2a", "wcag21a"].includes(t))) return "A";
  return undefined;
}

export function mapAxeImpactToSeverity(
  impact: string | null | undefined,
): "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR" {
  switch (impact) {
    case "critical":
      return "CRITICAL";
    case "serious":
      return "SERIOUS";
    case "minor":
      return "MINOR";
    default:
      return "MODERATE";
  }
}

/**
 * Axe rules that are pure heuristics / best-practice (no WCAG tag) tend to
 * produce noisy findings on modern SPA shells — especially `region`,
 * `landmark-one-main`, and the landmark-* family. When a user opts in via
 * SCANNER_INCLUDE_BEST_PRACTICE we still surface these, but force them to
 * MINOR severity so they don't inflate the CRITICAL / SERIOUS counts that
 * drive the gating score and dashboard badges.
 */
export function isBestPracticeOnly(tags: string[]): boolean {
  if (!tags.includes("best-practice")) return false;
  return !tags.some((t) =>
    t === "wcag2a" ||
    t === "wcag2aa" ||
    t === "wcag21a" ||
    t === "wcag21aa" ||
    t === "wcag22aa" ||
    t === "section508" ||
    /^wcag\d{3,}$/.test(t),
  );
}

/**
 * Prefer this over {@link mapAxeImpactToSeverity} whenever you have the
 * violation's tags handy — it applies the Phase K3 best-practice
 * down-weighting in addition to the impact → severity mapping.
 */
export function mapAxeViolationToSeverity(
  impact: string | null | undefined,
  tags: string[],
): "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR" {
  if (isBestPracticeOnly(tags)) return "MINOR";
  return mapAxeImpactToSeverity(impact);
}

/**
 * Whether the scanner should include axe's `best-practice`-tagged rules
 * alongside the selected WCAG tags. Disabled by default — those rules
 * (notably `region`, `landmark-one-main`, and the rest of the landmark
 * family) produce high-noise results on modern SPA shells where content
 * lives inside a component-driven layout rather than explicit landmarks.
 * See Phase K3 in FIX_PLAN.md for the triage rationale.
 *
 * Opt in per environment with SCANNER_INCLUDE_BEST_PRACTICE=true.
 */
export function bestPracticeRulesEnabled(): boolean {
  return process.env.SCANNER_INCLUDE_BEST_PRACTICE === "true";
}

// Convert our Standard enum values → axe-core withTags() arguments
export function standardsToAxeTags(standards: string[]): string[] {
  const tags = new Set<string>();

  for (const standard of standards) {
    switch (standard) {
      case "WCAG21_A":
        tags.add("wcag2a");
        tags.add("wcag21a");
        break;
      case "WCAG21_AA":
        tags.add("wcag2a");
        tags.add("wcag2aa");
        tags.add("wcag21a");
        tags.add("wcag21aa");
        break;
      case "WCAG22_AA":
        tags.add("wcag2a");
        tags.add("wcag2aa");
        tags.add("wcag21a");
        tags.add("wcag21aa");
        tags.add("wcag22aa");
        break;
      case "SECTION_508":
        tags.add("section508");
        break;
      case "EN_301_549":
        tags.add("wcag2a");
        tags.add("wcag2aa");
        tags.add("wcag21a");
        tags.add("wcag21aa");
        break;
    }
  }

  // Default: run full WCAG 2.2 AA (current published standard since Oct 2023).
  // Superset of 2.1 AA so no regression for callers that previously relied on
  // the 2.1 default.
  if (tags.size === 0) {
    tags.add("wcag2a");
    tags.add("wcag2aa");
    tags.add("wcag21a");
    tags.add("wcag21aa");
    tags.add("wcag22aa");
  }

  if (bestPracticeRulesEnabled()) {
    tags.add("best-practice");
  }

  return Array.from(tags);
}
