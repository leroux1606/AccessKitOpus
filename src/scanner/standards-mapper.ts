import type { Category } from "@prisma/client";

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

  // Default: run WCAG 2.1 AA if nothing selected
  if (tags.size === 0) {
    tags.add("wcag2a");
    tags.add("wcag2aa");
    tags.add("wcag21a");
    tags.add("wcag21aa");
  }

  return Array.from(tags);
}
