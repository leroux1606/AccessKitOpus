/**
 * Unit tests for the weekly digest builder (M4).
 *
 * Locks in:
 *   - Digest email is pure plaintext (no HTML) and deterministic.
 *   - Every email ends with an unsubscribe line pointing at the settings page
 *     — required both for CAN-SPAM / GDPR and for spam filter reputation.
 *   - "Most improved" / "most regressed" are selected honestly from present
 *     previous-score data and never invent numbers for unscored sites.
 *   - `shouldSendDigest` refuses to send when nothing meaningful happened.
 */

import {
  buildWeeklyDigest,
  scoreDelta,
  shouldSendDigest,
  type DigestInput,
  type DigestWebsiteInput,
} from "@/lib/digest";

const BASE_URL = "https://app.accesskit.io";

function site(
  name: string,
  o: Partial<DigestWebsiteInput> = {},
): DigestWebsiteInput {
  // Use `in`-checks so explicit `null` values aren't silently replaced by
  // defaults (we need to test the null-score branch honestly).
  return {
    name,
    currentScore: "currentScore" in o ? (o.currentScore as number | null) : 80,
    previousScore: "previousScore" in o ? (o.previousScore as number | null) : null,
    scansThisWeek: "scansThisWeek" in o ? (o.scansThisWeek as number) : 1,
    totalViolations: "totalViolations" in o ? (o.totalViolations as number | null) : 0,
    criticalCount: "criticalCount" in o ? (o.criticalCount as number | null) : 0,
  };
}

function input(websites: DigestWebsiteInput[]): DigestInput {
  return { orgName: "Acme", websites, appUrl: BASE_URL };
}

describe("scoreDelta", () => {
  it("is null when either score is missing", () => {
    expect(scoreDelta(site("x", { currentScore: 80, previousScore: null }))).toBeNull();
    expect(scoreDelta(site("x", { currentScore: null, previousScore: 80 }))).toBeNull();
  });
  it("returns signed integer delta when both present", () => {
    expect(scoreDelta(site("x", { currentScore: 90, previousScore: 80 }))).toBe(10);
    expect(scoreDelta(site("x", { currentScore: 70, previousScore: 95 }))).toBe(-25);
  });
});

describe("shouldSendDigest", () => {
  it("false for empty website list", () => {
    expect(shouldSendDigest(input([]))).toBe(false);
  });
  it("false when there are no scans and no scored websites", () => {
    expect(
      shouldSendDigest(
        input([site("x", { scansThisWeek: 0, currentScore: null })]),
      ),
    ).toBe(false);
  });
  it("true when any website has a scan this week", () => {
    expect(
      shouldSendDigest(
        input([site("x", { scansThisWeek: 1, currentScore: null })]),
      ),
    ).toBe(true);
  });
  it("true when any website has a current score (even no scans this week)", () => {
    expect(
      shouldSendDigest(
        input([site("x", { scansThisWeek: 0, currentScore: 85 })]),
      ),
    ).toBe(true);
  });
});

describe("buildWeeklyDigest — subject + text", () => {
  it("subject names the org so recipients in multiple orgs can tell them apart", () => {
    const d = buildWeeklyDigest(input([site("a")]));
    expect(d.subject).toBe("AccessKit Weekly Digest — Acme");
  });

  it("plaintext body contains the org name and key totals", () => {
    const d = buildWeeklyDigest(
      input([site("a", { scansThisWeek: 2, totalViolations: 5, criticalCount: 1 })]),
    );
    expect(d.text).toContain("Acme");
    expect(d.text).toContain("Scans completed: 2");
    expect(d.text).toContain("Total issues found: 5");
    expect(d.text).toContain("Critical issues: 1");
  });

  it("ends with an unsubscribe link pointing at /settings/notifications", () => {
    const d = buildWeeklyDigest(input([site("a")]));
    expect(d.text).toMatch(
      /Manage preferences: https:\/\/app\.accesskit\.io\/settings\/notifications/,
    );
  });

  it("strips trailing slash from appUrl so link formatting is consistent", () => {
    const d = buildWeeklyDigest({
      orgName: "Acme",
      websites: [site("a")],
      appUrl: "https://app.example.com/",
    });
    expect(d.text).toContain("https://app.example.com/dashboard");
    expect(d.text).toContain("https://app.example.com/settings/notifications");
    expect(d.text).not.toContain("//dashboard");
  });

  it("is deterministic — same input produces byte-identical output", () => {
    const p = input([
      site("b", { currentScore: 80, previousScore: 75 }),
      site("a", { currentScore: 95, previousScore: 90 }),
    ]);
    expect(buildWeeklyDigest(p).text).toBe(buildWeeklyDigest(p).text);
  });
});

describe("buildWeeklyDigest — per-site listing", () => {
  it("sorts sites by score descending, alphabetical tie-break", () => {
    const d = buildWeeklyDigest(
      input([
        site("low", { currentScore: 50 }),
        site("high", { currentScore: 95 }),
        site("mid", { currentScore: 70 }),
      ]),
    );
    const ix = (s: string) => d.text.indexOf(s);
    expect(ix("high")).toBeLessThan(ix("mid"));
    expect(ix("mid")).toBeLessThan(ix("low"));
  });

  it("renders '—' for null current-score rather than 0/100", () => {
    const d = buildWeeklyDigest(input([site("x", { currentScore: null })]));
    expect(d.text).toContain("x: —");
    expect(d.text).not.toContain("x: 0/100");
  });

  it("shows trend arrow '(up N)' when score rose week-over-week", () => {
    const d = buildWeeklyDigest(
      input([site("x", { currentScore: 90, previousScore: 80 })]),
    );
    expect(d.text).toContain("(up 10)");
  });

  it("shows trend arrow '(down N)' when score fell week-over-week", () => {
    const d = buildWeeklyDigest(
      input([site("x", { currentScore: 60, previousScore: 85 })]),
    );
    expect(d.text).toContain("(down 25)");
  });

  it("omits trend arrow when previous score unknown", () => {
    const d = buildWeeklyDigest(
      input([site("x", { currentScore: 80, previousScore: null })]),
    );
    expect(d.text).not.toMatch(/\(up|\(down/);
  });
});

describe("buildWeeklyDigest — most improved / regressed", () => {
  it("picks the largest positive delta across all sites with both scores", () => {
    const d = buildWeeklyDigest(
      input([
        site("small", { currentScore: 82, previousScore: 80 }),
        site("big", { currentScore: 92, previousScore: 70 }),
        site("negative", { currentScore: 60, previousScore: 85 }),
      ]),
    );
    expect(d.totals.mostImproved?.name).toBe("big");
    expect(d.text).toContain("Biggest improvement: big (+22 points).");
  });

  it("picks the largest negative delta as mostRegressed", () => {
    const d = buildWeeklyDigest(
      input([
        site("small", { currentScore: 78, previousScore: 80 }),
        site("big", { currentScore: 40, previousScore: 85 }),
      ]),
    );
    expect(d.totals.mostRegressed?.name).toBe("big");
    expect(d.text).toContain("Biggest regression: big (-45 points).");
  });

  it("returns null for mostImproved / mostRegressed when no deltas are computable", () => {
    const d = buildWeeklyDigest(
      input([site("x", { currentScore: 80, previousScore: null })]),
    );
    expect(d.totals.mostImproved).toBeNull();
    expect(d.totals.mostRegressed).toBeNull();
    expect(d.text).not.toContain("Biggest improvement");
    expect(d.text).not.toContain("Biggest regression");
  });

  it("does not announce improvement when the biggest delta is zero or negative", () => {
    const d = buildWeeklyDigest(
      input([
        site("flat", { currentScore: 80, previousScore: 80 }),
        site("down", { currentScore: 75, previousScore: 80 }),
      ]),
    );
    expect(d.text).not.toContain("Biggest improvement");
    expect(d.text).toContain("Biggest regression: down (-5 points).");
  });
});
