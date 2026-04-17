/**
 * Mechanical remediation patch helpers (M1).
 *
 * This is the SDK-level building block for the "automated remediation PRs"
 * feature. Given a violation + the source HTML that triggered it, we return
 * a deterministic unified diff that fixes the issue. The GitHub App wrapper
 * (install flow, repo cloning, PR creation) is deployment-time work — this
 * module is the pure, offline brain that decides *what* to change.
 *
 * Supported rules (conservative on purpose):
 *   - image-alt           — add alt="" to unlabelled <img>
 *   - html-has-lang       — add lang="en" to <html>
 *   - button-name         — add aria-label="<rule-id>" to empty <button>
 *   - link-name           — add aria-label to <a> with no discernible text
 *   - meta-viewport       — fix user-scalable=no in <meta name="viewport">
 *
 * Anything not in this list returns `null` so the caller can fall back to
 * AI-generated fix suggestions rather than publishing a wrong patch.
 *
 * Design constraints:
 *   - No parsing — we apply targeted string-level edits with tight regex
 *     anchors. A real HTML parser would be safer but also much heavier and
 *     more surprising in its output (DOM reserialization rewrites whitespace,
 *     quotes, attribute order, self-closing syntax, etc).
 *   - Idempotent — running a patch on an already-fixed file produces `null`,
 *     not a second identical patch.
 *   - Side-effect free — no I/O, no globals touched. Easy to test, easy to
 *     run inside a GitHub Action.
 */

export interface RemediationViolation {
  ruleId: string;
  cssSelector: string;
  /** Optional human-readable description — surfaced in the commit message. */
  description?: string;
}

export interface RemediationPatch {
  /** Unified-diff text suitable for `git apply`. */
  unifiedDiff: string;
  /** Short human-readable summary, suitable for PR title / commit message. */
  summary: string;
  /** Longer explanation — WCAG rule + intent — for the PR body. */
  rationale: string;
  /** Updated file content (convenience — the caller may already have the diff). */
  updatedContent: string;
  ruleId: string;
}

type Patcher = (sourceContent: string, violation: RemediationViolation) => RemediationPatch | null;

// ─── Public entry points ──────────────────────────────────────────────────────

/**
 * Produce a remediation patch for a single violation in a single file, or
 * `null` if this rule isn't machine-fixable / the source doesn't match.
 */
export function buildRemediationPatch(
  filePath: string,
  sourceContent: string,
  violation: RemediationViolation,
): RemediationPatch | null {
  const patcher = PATCHERS[violation.ruleId];
  if (!patcher) return null;

  const result = patcher(sourceContent, violation);
  if (!result) return null;

  return {
    ...result,
    unifiedDiff: toUnifiedDiff(filePath, sourceContent, result.updatedContent),
  };
}

/**
 * Whether a given rule id has a deterministic mechanical fix.
 * Exported so the UI can show a "Fix with one click" button only when it means
 * something, and fall back to AI suggestions for everything else.
 */
export function canAutoRemediate(ruleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PATCHERS, ruleId);
}

/**
 * The set of supported rule ids, exposed so the feature's marketing copy and
 * dashboard UI stay honest.
 */
export function supportedRuleIds(): string[] {
  return Object.keys(PATCHERS).sort();
}

// ─── Per-rule patchers ────────────────────────────────────────────────────────

const PATCHERS: Record<string, Patcher> = {
  "image-alt": patchImageAlt,
  "html-has-lang": patchHtmlHasLang,
  "button-name": patchButtonName,
  "link-name": patchLinkName,
  "meta-viewport": patchMetaViewport,
};

/**
 * Add an empty `alt=""` to any <img> tag lacking one. Empty alt is the
 * correct WCAG-compliant default for decorative images; images with real
 * semantic meaning need a human to provide descriptive text.
 */
function patchImageAlt(source: string, v: RemediationViolation): RemediationPatch | null {
  const regex = /<img\b([^>]*?)(\s*\/)?>/gi;
  let changed = false;
  const updated = source.replace(regex, (match, attrs: string, closeSlash: string | undefined) => {
    if (/\balt\s*=/i.test(attrs)) return match;
    changed = true;
    const trimmed = attrs.trimEnd();
    const selfClosing = typeof closeSlash === "string";
    const withAlt = `${trimmed} alt=""`;
    return selfClosing ? `<img${withAlt} />` : `<img${withAlt}>`;
  });

  if (!changed) return null;

  return {
    ruleId: v.ruleId,
    updatedContent: updated,
    unifiedDiff: "",
    summary: "Add empty alt attribute to decorative <img> elements",
    rationale:
      "WCAG 2.1 SC 1.1.1 (Non-text Content) — every <img> needs an alt attribute. " +
      "An empty alt (`alt=\"\"`) is correct for decorative images; review each " +
      "change and replace with a descriptive string for images that convey content.",
  };
}

/**
 * Add `lang="en"` (default) to <html> when missing. We pick `en` because it's
 * the safest default for English-language apps and because it's better than
 * the "no language declared" state — the customer can change it.
 */
function patchHtmlHasLang(source: string, v: RemediationViolation): RemediationPatch | null {
  const regex = /<html\b([^>]*)>/i;
  const match = regex.exec(source);
  if (!match) return null;
  const attrs = match[1] ?? "";
  if (/\blang\s*=/i.test(attrs)) return null;

  const trimmed = attrs.trimEnd();
  const replacement = trimmed.length > 0 ? `<html${trimmed} lang="en">` : `<html lang="en">`;
  const updated = source.replace(match[0], replacement);

  return {
    ruleId: v.ruleId,
    updatedContent: updated,
    unifiedDiff: "",
    summary: "Set default lang=\"en\" on <html>",
    rationale:
      "WCAG 2.1 SC 3.1.1 (Language of Page) — the primary language of the " +
      "page must be identifiable so assistive tech can select the correct " +
      "speech synthesizer. Defaulting to `en`; change this if your site is in " +
      "another language.",
  };
}

/**
 * Add `aria-label` to buttons with no accessible name. We look for the first
 * matching empty-content button — anything more invasive (inferring text from
 * surrounding context) is unsafe without a DOM.
 */
function patchButtonName(source: string, v: RemediationViolation): RemediationPatch | null {
  const regex = /<button\b([^>]*)>([^<]*?)<\/button>/gi;
  let changed = false;
  const updated = source.replace(regex, (match, attrs: string, inner: string) => {
    const hasLabel = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);
    const hasTitle = /\btitle\s*=/i.test(attrs);
    const hasText = inner.trim().length > 0;
    if (hasLabel || hasTitle || hasText) return match;
    changed = true;
    const trimmed = attrs.trimEnd();
    const selectorHint = selectorToLabel(v.cssSelector);
    return `<button${trimmed} aria-label="${selectorHint}">${inner}</button>`;
  });

  if (!changed) return null;

  return {
    ruleId: v.ruleId,
    updatedContent: updated,
    unifiedDiff: "",
    summary: "Add placeholder aria-label to buttons with no accessible name",
    rationale:
      "WCAG 2.1 SC 4.1.2 (Name, Role, Value) — interactive elements must have " +
      "a programmatically-determinable name. Replace the placeholder with the " +
      "button's real purpose before merging.",
  };
}

/**
 * Same treatment as buttons, for anchors. Skips anchors whose content looks
 * like it *would* produce an accessible name (non-empty text or <img alt>).
 */
function patchLinkName(source: string, v: RemediationViolation): RemediationPatch | null {
  const regex = /<a\b([^>]*)>([^<]*?)<\/a>/gi;
  let changed = false;
  const updated = source.replace(regex, (match, attrs: string, inner: string) => {
    const hasLabel = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);
    const hasTitle = /\btitle\s*=/i.test(attrs);
    const hasText = inner.trim().length > 0;
    if (hasLabel || hasTitle || hasText) return match;
    changed = true;
    const trimmed = attrs.trimEnd();
    const selectorHint = selectorToLabel(v.cssSelector);
    return `<a${trimmed} aria-label="${selectorHint}">${inner}</a>`;
  });

  if (!changed) return null;

  return {
    ruleId: v.ruleId,
    updatedContent: updated,
    unifiedDiff: "",
    summary: "Add placeholder aria-label to links with no discernible text",
    rationale:
      "WCAG 2.1 SC 2.4.4 & 4.1.2 — anchors must expose their destination to " +
      "assistive tech. Replace the placeholder with a short description of " +
      "where the link goes before merging.",
  };
}

/**
 * Remove `user-scalable=no` (and force `maximum-scale` down to a sane default)
 * from the viewport meta. Blocking zoom violates WCAG SC 1.4.4 Resize Text.
 */
function patchMetaViewport(source: string, v: RemediationViolation): RemediationPatch | null {
  const regex = /<meta\b([^>]*name\s*=\s*["']viewport["'][^>]*)>/i;
  const match = regex.exec(source);
  if (!match) return null;

  const originalAttrs = match[1] ?? "";
  let attrs = originalAttrs;

  // Drop `user-scalable=no` / `user-scalable=0` from the content value.
  attrs = attrs.replace(
    /content\s*=\s*["']([^"']*)["']/i,
    (_whole, content: string) => {
      const cleaned = content
        .split(",")
        .map((tok) => tok.trim())
        .filter((tok) => {
          if (/^user-scalable\s*=\s*(no|0)$/i.test(tok)) return false;
          if (/^maximum-scale\s*=\s*(0?\.\d+|1(\.0+)?)$/i.test(tok)) return false;
          return true;
        })
        .join(", ");
      return `content="${cleaned}"`;
    },
  );

  if (attrs === originalAttrs) return null;

  const updated = source.replace(match[0], `<meta${attrs}>`);

  return {
    ruleId: v.ruleId,
    updatedContent: updated,
    unifiedDiff: "",
    summary: "Allow pinch-zoom by removing user-scalable=no from <meta viewport>",
    rationale:
      "WCAG 2.1 SC 1.4.4 (Resize Text) — blocking zoom (`user-scalable=no` or " +
      "`maximum-scale=1.0`) prevents users with low vision from enlarging " +
      "content. Safe and reversible edit.",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function selectorToLabel(selector: string): string {
  const id = selector.match(/#([a-z0-9_-]+)/i)?.[1];
  if (id) return humanize(id);
  const className = selector.match(/\.([a-z0-9_-]+)/i)?.[1];
  if (className) return humanize(className);
  return "Describe me";
}

function humanize(identifier: string): string {
  return identifier
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\s+/g, " ");
}

// ─── Unified diff generator ───────────────────────────────────────────────────

/**
 * Build a minimal unified diff between `before` and `after`.
 *
 * We don't need the full `diff` algorithm here — for our mechanical edits the
 * changes are always tight (a few lines at most). The output is still valid
 * `git apply` input: we emit one hunk per contiguous run of changed lines with
 * 3 lines of context on each side.
 *
 * Exported for testing.
 */
export function toUnifiedDiff(filePath: string, before: string, after: string): string {
  if (before === after) return "";

  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const hunks = computeHunks(beforeLines, afterLines, 3);

  const header = [`--- a/${filePath}`, `+++ b/${filePath}`, ""].join("\n");
  const body = hunks
    .map((h) => {
      const oldRange = `${h.oldStart},${h.oldLen}`;
      const newRange = `${h.newStart},${h.newLen}`;
      return [
        `@@ -${oldRange} +${newRange} @@`,
        ...h.lines,
      ].join("\n");
    })
    .join("\n");

  return `${header}${body}\n`;
}

interface Hunk {
  oldStart: number;
  oldLen: number;
  newStart: number;
  newLen: number;
  lines: string[];
}

/**
 * Rudimentary line-level diff: walks both sequences in lockstep, emits a hunk
 * for each contiguous divergence with N lines of context around it. Good
 * enough for surgical, same-length edits — not meant to handle reordered
 * files.
 */
function computeHunks(before: string[], after: string[], context: number): Hunk[] {
  // Find all changed line indexes relative to `before`. We assume edits don't
  // insert or delete more than 1 line per divergence; for our mechanical rules
  // that's always true because we only mutate single-line attributes.
  const maxLen = Math.max(before.length, after.length);
  const changed: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    if (before[i] !== after[i]) changed.push(i);
  }
  if (changed.length === 0) return [];

  // Coalesce adjacent changed indices into ranges.
  const ranges: Array<{ start: number; end: number }> = [];
  for (const idx of changed) {
    const last = ranges[ranges.length - 1];
    if (last && idx <= last.end + 2 * context) {
      last.end = idx;
    } else {
      ranges.push({ start: idx, end: idx });
    }
  }

  return ranges.map((range) => {
    const hunkStart = Math.max(0, range.start - context);
    const hunkEnd = Math.min(maxLen - 1, range.end + context);

    const lines: string[] = [];
    let oldLen = 0;
    let newLen = 0;

    for (let i = hunkStart; i <= hunkEnd; i++) {
      const bLine = before[i];
      const aLine = after[i];
      if (bLine === aLine) {
        if (bLine !== undefined) {
          lines.push(` ${bLine}`);
          oldLen++;
          newLen++;
        }
      } else {
        if (bLine !== undefined) {
          lines.push(`-${bLine}`);
          oldLen++;
        }
        if (aLine !== undefined) {
          lines.push(`+${aLine}`);
          newLen++;
        }
      }
    }

    return {
      oldStart: hunkStart + 1,
      oldLen,
      newStart: hunkStart + 1,
      newLen,
      lines,
    };
  });
}
