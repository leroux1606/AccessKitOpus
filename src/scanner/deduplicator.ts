import { createHash } from "crypto";

// Bumped when the normalization algorithm changes so we can tell v1 and
// v2 fingerprints apart in the DB if we ever need to migrate. Existing
// v1 rows keep their value; new scans produce v2 values. Downstream
// "is this the same issue across scans?" logic just compares strings so
// the mix is safe — a one-time reset of `is_regression` tracking is the
// only user-visible effect of the version bump.
const FINGERPRINT_VERSION = "v2";

// Match positional / ordinal pseudo-classes that shift whenever the DOM
// reflows. `:nth-child(3)`, `:nth-of-type(odd)`, `:first-child`, etc.
const POSITIONAL_PSEUDO = /:(nth-(?:child|of-type|last-child|last-of-type)\([^)]*\)|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type)/g;

// Bracketed positional indices that axe-core occasionally emits, e.g.
// `div[1] > section[2]` in XPath-ish selectors.
const BRACKET_INDEX = /\[(\d+)\]/g;

// Class names that are almost certainly build-time generated and therefore
// change between deploys. Covers the common CSS-in-JS / CSS-modules
// patterns:
//   • Emotion / JSS:      `css-1a2b3c4`, `css-abc123def`
//   • styled-components:  `sc-abc1234`, `sc-bcdeFGH-1`
//   • CSS Modules:        `Component_button__aB3cD`, `_abc123`
//   • Next.js / Tailwind: `__className_a1b2c3`
//   • Hash-only suffixes: `.foo_1a2b3c4d`
const GENERATED_CLASS_PATTERNS: RegExp[] = [
  /^css-[a-z0-9]{5,}$/i,
  /^sc-[a-zA-Z0-9]{5,}(?:-\d+)?$/,
  /^_[a-z0-9]{5,}$/i,
  /^__className_[a-z0-9]{5,}$/i,
  /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9]+__[A-Za-z0-9]{5,}$/,
  /^[A-Za-z][A-Za-z0-9_-]*_[a-z0-9]{6,}$/i,
];

function isGeneratedClass(name: string): boolean {
  return GENERATED_CLASS_PATTERNS.some((re) => re.test(name));
}

/**
 * Normalize a simple-selector chunk (one compound selector between
 * combinators) by stripping positional filters and auto-generated
 * class tokens, then re-ordering the remaining class tokens so the
 * output doesn't depend on source order (`.btn.primary` and
 * `.primary.btn` hash identically).
 */
function normalizeCompound(compound: string): string {
  const stripped = compound
    .replace(POSITIONAL_PSEUDO, "")
    .replace(BRACKET_INDEX, "");

  // Pull apart the compound into {tag, id, classes[], attrs[], pseudos[]}
  // via a single-pass scanner. Manual rather than using a CSS parser so we
  // stay dependency-free and deterministic on the malformed selectors
  // axe-core sometimes emits.
  let tag = "";
  let id = "";
  const classes: string[] = [];
  const attrs: string[] = [];
  const pseudos: string[] = [];

  let i = 0;
  // Leading tag name (optional)
  const tagMatch = stripped.slice(i).match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  if (tagMatch) {
    tag = tagMatch[0].toLowerCase();
    i += tagMatch[0].length;
  }

  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === "#") {
      const m = stripped.slice(i + 1).match(/^[^\s.#[:>+~]+/);
      if (m) {
        id = m[0];
        i += 1 + m[0].length;
        continue;
      }
    } else if (ch === ".") {
      const m = stripped.slice(i + 1).match(/^[^\s.#[:>+~]+/);
      if (m) {
        if (!isGeneratedClass(m[0])) classes.push(m[0]);
        i += 1 + m[0].length;
        continue;
      }
    } else if (ch === "[") {
      const end = stripped.indexOf("]", i);
      if (end !== -1) {
        attrs.push(stripped.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    } else if (ch === ":") {
      const m = stripped.slice(i).match(/^::?[a-zA-Z-]+(?:\([^)]*\))?/);
      if (m) {
        pseudos.push(m[0]);
        i += m[0].length;
        continue;
      }
    }
    i++;
  }

  const sortedClasses = [...classes].sort();
  const sortedAttrs = [...attrs].sort();
  const sortedPseudos = [...pseudos].sort();

  // Empty compound (e.g. selector was pure `:nth-child(1)`) normalizes to
  // a single wildcard so the final joined path keeps its shape.
  if (!tag && !id && sortedClasses.length === 0 && sortedAttrs.length === 0 && sortedPseudos.length === 0) {
    return "*";
  }

  return (
    (tag || "") +
    (id ? `#${id}` : "") +
    sortedClasses.map((c) => `.${c}`).join("") +
    sortedAttrs.join("") +
    sortedPseudos.join("")
  );
}

/**
 * Normalize an axe-core CSS selector for fingerprinting. Splits on
 * descendant/child/sibling combinators, normalizes each compound, and
 * re-joins with single spaces so whitespace drift doesn't re-hash.
 *
 * Axe occasionally hands us comma-joined selectors (one hit per node
 * target) — we normalize each branch independently and keep them sorted
 * so the order in which axe listed the branches doesn't matter.
 */
export function normalizeSelector(selector: string): string {
  if (!selector) return "";

  const branches = selector
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((branch) => {
      const parts = branch
        .split(/\s*([>+~])\s*|\s+/)
        .filter(Boolean)
        .map((part) => {
          if (part === ">" || part === "+" || part === "~") return part;
          return normalizeCompound(part);
        });
      return parts.join(" ").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);

  return [...branches].sort().join(" , ");
}

/**
 * Generates a stable fingerprint for a violation.
 *
 * Same rule + same (normalized) selector on the same website = same issue
 * across scans. Normalization strips transient parts of axe-generated
 * selectors so a minor layout shift — an extra wrapper div, a sibling
 * reorder, a new CSS-in-JS hash at build time — doesn't look like a
 * brand-new violation.
 */
export function generateFingerprint(
  ruleId: string,
  cssSelector: string,
  websiteUrl: string,
): string {
  const origin = new URL(websiteUrl).origin;
  const normalized = normalizeSelector(cssSelector);
  const input = `${FINGERPRINT_VERSION}:${ruleId}:${normalized}:${origin}`;
  return createHash("sha256").update(input).digest("hex");
}
