/**
 * Weekly digest body builder (M4).
 *
 * Extracted from `src/inngest/notification-emails.ts` so the logic that turns
 * a week of scans into an email body can be unit-tested without mocking
 * Inngest + Resend. The Inngest function is now a thin I/O shell around this
 * pure function.
 *
 * The body contract:
 *  - Plain text, <2 KB, rendered identically in every email client.
 *  - Per-website score + week-over-week trend arrow so the reader can see
 *    movement at a glance without opening the dashboard.
 *  - Ends with an unsubscribe line pointing at the notification-prefs page —
 *    required by spam-filter heuristics and, more importantly, by our own
 *    accessibility-first ethos (opt-out must be one click).
 */

export interface DigestWebsiteInput {
  name: string;
  /** Current score (most recent scan). */
  currentScore: number | null;
  /** Score at the start of the digest window (one week ago), if known. */
  previousScore: number | null;
  /** Number of completed scans in the digest window. */
  scansThisWeek: number;
  /** Total violations on the most recent scan (null = unscanned). */
  totalViolations: number | null;
  /** Critical violations on the most recent scan. */
  criticalCount: number | null;
}

export interface DigestInput {
  orgName: string;
  websites: DigestWebsiteInput[];
  /** Canonical app origin (no trailing slash). */
  appUrl: string;
}

export interface DigestOutput {
  subject: string;
  text: string;
  /** Aggregate stats rolled up from `websites`. Handy for callers that want
   *  to gate sending on "nothing happened this week". */
  totals: {
    scansThisWeek: number;
    totalIssues: number;
    criticalIssues: number;
    mostImproved: DigestWebsiteInput | null;
    mostRegressed: DigestWebsiteInput | null;
  };
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Build a weekly digest email for a single organization. Pure — no side
 * effects, no I/O. Deterministic for a given input.
 */
export function buildWeeklyDigest(input: DigestInput): DigestOutput {
  const scansThisWeek = input.websites.reduce((s, w) => s + w.scansThisWeek, 0);
  const totalIssues = input.websites.reduce(
    (s, w) => s + (w.totalViolations ?? 0),
    0,
  );
  const criticalIssues = input.websites.reduce(
    (s, w) => s + (w.criticalCount ?? 0),
    0,
  );

  const deltaPairs = input.websites
    .map((w) => ({ site: w, delta: scoreDelta(w) }))
    .filter((p) => p.delta !== null) as Array<{ site: DigestWebsiteInput; delta: number }>;

  const mostImproved =
    deltaPairs.length > 0
      ? deltaPairs.reduce((best, cur) => (cur.delta > best.delta ? cur : best)).site
      : null;

  const mostRegressed =
    deltaPairs.length > 0
      ? deltaPairs.reduce((worst, cur) => (cur.delta < worst.delta ? cur : worst)).site
      : null;

  const sortedSites = [...input.websites].sort((a, b) => {
    const scoreA = a.currentScore ?? -1;
    const scoreB = b.currentScore ?? -1;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  });

  const appUrl = input.appUrl.replace(/\/+$/, "");

  const siteLines = sortedSites
    .map((w) => `  • ${w.name}: ${formatScore(w.currentScore)} ${formatTrend(w)}`)
    .join("\n");

  const bodyLines = [
    `Hi there,`,
    ``,
    `Here's your weekly accessibility summary for ${input.orgName}:`,
    ``,
    `  Scans completed: ${scansThisWeek}`,
    `  Total issues found: ${totalIssues}`,
    `  Critical issues: ${criticalIssues}`,
    ``,
  ];

  if (sortedSites.length > 0) {
    bodyLines.push(`Website scores:`);
    bodyLines.push(siteLines);
    bodyLines.push(``);
  }

  if (mostImproved && scoreDelta(mostImproved) !== null && (scoreDelta(mostImproved) ?? 0) > 0) {
    bodyLines.push(
      `Biggest improvement: ${mostImproved.name} (+${scoreDelta(mostImproved)} points).`,
    );
  }
  if (mostRegressed && scoreDelta(mostRegressed) !== null && (scoreDelta(mostRegressed) ?? 0) < 0) {
    bodyLines.push(
      `Biggest regression: ${mostRegressed.name} (${scoreDelta(mostRegressed)} points).`,
    );
  }

  if (bodyLines[bodyLines.length - 1] !== "") bodyLines.push("");

  bodyLines.push(`View full dashboard: ${appUrl}/dashboard`);
  bodyLines.push(``);
  bodyLines.push(`— The AccessKit Team`);
  bodyLines.push(``);
  bodyLines.push(
    `Don't want these digests? Manage preferences: ${appUrl}/settings/notifications`,
  );

  return {
    subject: `AccessKit Weekly Digest — ${input.orgName}`,
    text: bodyLines.join("\n"),
    totals: {
      scansThisWeek,
      totalIssues,
      criticalIssues,
      mostImproved,
      mostRegressed,
    },
  };
}

/**
 * Return `current - previous` if both are present; null otherwise.
 * Exported for tests + the "most improved/regressed" computation.
 */
export function scoreDelta(w: DigestWebsiteInput): number | null {
  if (w.currentScore === null || w.previousScore === null) return null;
  return w.currentScore - w.previousScore;
}

/**
 * Decide whether the digest has any meaningful content to send.
 * We skip orgs that had zero scans and zero scored websites in the window.
 */
export function shouldSendDigest(input: DigestInput): boolean {
  if (input.websites.length === 0) return false;
  const anyScans = input.websites.some((w) => w.scansThisWeek > 0);
  const anyScored = input.websites.some((w) => w.currentScore !== null);
  return anyScans || anyScored;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function formatScore(score: number | null): string {
  return score === null ? "—" : `${score}/100`;
}

function formatTrend(w: DigestWebsiteInput): string {
  const delta = scoreDelta(w);
  if (delta === null || delta === 0) return "";
  // ASCII-only arrows — safer in all email clients than Unicode ↑↓.
  if (delta > 0) return `(up ${delta})`;
  return `(down ${Math.abs(delta)})`;
}
