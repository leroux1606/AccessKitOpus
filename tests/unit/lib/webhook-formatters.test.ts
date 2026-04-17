/**
 * Unit tests for Slack / Teams native webhook payload formatters (M3).
 *
 * Locks in:
 *   - Provider detection is narrow (only known good hostnames classify as
 *     slack/teams; everything else stays "generic" and hits the passthrough).
 *   - Slack payloads are shaped as { text, blocks[], attachments[] } with the
 *     mandatory top-level `text` fallback for clients that don't render blocks.
 *   - Teams payloads are shaped as MessageCard (themeColor, sections, facts)
 *     and include the OpenUri action when a dashboard link is resolvable.
 *   - The envelope-vs-native routing in `formatForProvider` preserves the
 *     original generic payload for unknown listeners so the existing contract
 *     with custom webhook receivers is not broken.
 */

import {
  detectProvider,
  describeEvent,
  formatSlackMessage,
  formatTeamsMessage,
  formatForProvider,
} from "@/lib/webhook-formatters";

describe("detectProvider", () => {
  it("classifies hooks.slack.com/services/... as slack", () => {
    expect(detectProvider("https://hooks.slack.com/services/T000/B000/XXX")).toBe("slack");
  });

  it("refuses slack hostnames without the /services/ path", () => {
    expect(detectProvider("https://hooks.slack.com/")).toBe("generic");
    expect(detectProvider("https://hooks.slack.com/random")).toBe("generic");
  });

  it("classifies legacy Office 365 connector URLs as teams", () => {
    expect(detectProvider("https://tenant.webhook.office.com/webhookb2/abc")).toBe("teams");
    expect(detectProvider("https://outlook.office.com/webhook/xyz")).toBe("teams");
  });

  it("classifies Power Automate (*.logic.azure.com) URLs as teams", () => {
    expect(detectProvider("https://prod-1.westus.logic.azure.com/workflows/abc?sig=...")).toBe("teams");
  });

  it("defaults to generic for unknown hosts", () => {
    expect(detectProvider("https://example.com/hook")).toBe("generic");
    expect(detectProvider("https://zapier.com/hooks/catch/abc")).toBe("generic");
  });

  it("defaults to generic for malformed URLs", () => {
    expect(detectProvider("not a url")).toBe("generic");
    expect(detectProvider("")).toBe("generic");
  });

  it("is case-insensitive on hostname", () => {
    expect(detectProvider("https://HOOKS.SLACK.COM/services/T/B/X")).toBe("slack");
  });
});

describe("describeEvent", () => {
  it("renders a SCAN_COMPLETED summary with score and counts", () => {
    const p = describeEvent("SCAN_COMPLETED", {
      websiteName: "Acme",
      score: 87,
      totalViolations: 3,
      pagesScanned: 5,
    });
    expect(p.title).toContain("Acme");
    expect(p.summary).toContain("87/100");
    expect(p.summary).toContain("3 issues");
    expect(p.summary).toContain("5 pages");
  });

  it("pluralises correctly for single-issue / single-page scans", () => {
    const p = describeEvent("SCAN_COMPLETED", {
      websiteName: "Acme",
      score: 100,
      totalViolations: 1,
      pagesScanned: 1,
    });
    expect(p.summary).toContain("1 issue across 1 page.");
  });

  it("renders CRITICAL_ISSUES_FOUND with a red accent", () => {
    const p = describeEvent("CRITICAL_ISSUES_FOUND", { websiteName: "Acme", criticalCount: 2 });
    expect(p.title).toContain("2 critical issues on Acme");
    expect(p.accentHex).toBe("ef4444");
  });

  it("renders SCORE_DROPPED with prev/curr/drop", () => {
    const p = describeEvent("SCORE_DROPPED", {
      websiteName: "Acme",
      previousScore: 90,
      currentScore: 80,
      drop: 10,
    });
    expect(p.summary).toMatch(/90 to 80.*-10/);
    expect(p.accentHex).toBe("f97316");
  });

  it("picks a severity-appropriate accent for SCAN_COMPLETED scores", () => {
    expect(describeEvent("SCAN_COMPLETED", { score: 95, totalViolations: 0 }).accentHex).toBe("22c55e");
    expect(describeEvent("SCAN_COMPLETED", { score: 75, totalViolations: 5 }).accentHex).toBe("eab308");
    expect(describeEvent("SCAN_COMPLETED", { score: 55, totalViolations: 10 }).accentHex).toBe("f97316");
    expect(describeEvent("SCAN_COMPLETED", { score: 10, totalViolations: 99 }).accentHex).toBe("ef4444");
  });
});

describe("formatSlackMessage", () => {
  const payload = {
    websiteName: "Acme",
    websiteId: "w_1",
    scanId: "s_1",
    score: 87,
    totalViolations: 3,
    pagesScanned: 5,
  };

  it("carries a top-level text fallback for non-block Slack clients", () => {
    const msg = formatSlackMessage({ event: "SCAN_COMPLETED", payload });
    expect(typeof msg.text).toBe("string");
    expect((msg.text as string).length).toBeGreaterThan(0);
  });

  it("emits a blocks array with header + section + context", () => {
    const msg = formatSlackMessage({ event: "SCAN_COMPLETED", payload });
    const blocks = msg.blocks as Array<{ type: string }>;
    expect(blocks.find((b) => b.type === "header")).toBeDefined();
    expect(blocks.find((b) => b.type === "section")).toBeDefined();
    expect(blocks.find((b) => b.type === "context")).toBeDefined();
  });

  it("adds an actions block with a View button when a link can be derived", () => {
    const msg = formatSlackMessage({
      event: "SCAN_COMPLETED",
      payload,
      baseUrl: "https://app.example.com",
    });
    const blocks = msg.blocks as Array<{ type: string; elements?: Array<{ url?: string }> }>;
    const actions = blocks.find((b) => b.type === "actions");
    expect(actions).toBeDefined();
    expect(actions?.elements?.[0]?.url).toBe("https://app.example.com/websites/w_1/scans/s_1");
  });

  it("omits the actions block when no baseUrl + no absolute link is present", () => {
    const msg = formatSlackMessage({ event: "SCAN_COMPLETED", payload: { websiteName: "Acme" } });
    const blocks = msg.blocks as Array<{ type: string }>;
    expect(blocks.find((b) => b.type === "actions")).toBeUndefined();
  });

  it("attaches a severity-colored bar for at-a-glance inbox reading", () => {
    const msg = formatSlackMessage({ event: "CRITICAL_ISSUES_FOUND", payload: { criticalCount: 2 } });
    const attachments = msg.attachments as Array<{ color: string }>;
    expect(attachments[0]?.color).toBe("#ef4444");
  });

  it("does not mark critical-issue CTA buttons as 'primary' (green)", () => {
    const msg = formatSlackMessage({
      event: "CRITICAL_ISSUES_FOUND",
      payload: { websiteId: "w_1", criticalCount: 2 },
      baseUrl: "https://app.example.com",
    });
    const blocks = msg.blocks as Array<{ type: string; elements?: Array<{ style?: string }> }>;
    const button = blocks.find((b) => b.type === "actions")?.elements?.[0];
    expect(button?.style).toBeUndefined();
  });
});

describe("formatTeamsMessage", () => {
  it("emits MessageCard schema with themeColor and summary", () => {
    const msg = formatTeamsMessage({
      event: "SCAN_COMPLETED",
      payload: { websiteName: "Acme", score: 92, totalViolations: 1, pagesScanned: 3 },
    });
    expect(msg["@type"]).toBe("MessageCard");
    expect(msg["@context"]).toBe("https://schema.org/extensions");
    expect(typeof msg.summary).toBe("string");
    expect(msg.themeColor).toBe("22c55e");
  });

  it("builds a facts table with Event, Source, Website, URL, Score", () => {
    const msg = formatTeamsMessage({
      event: "SCAN_COMPLETED",
      payload: {
        websiteName: "Acme",
        websiteUrl: "https://acme.com",
        score: 87,
        totalViolations: 3,
        pagesScanned: 5,
      },
      appName: "AccessKit",
    });
    const sections = msg.sections as Array<{ facts: Array<{ name: string; value: string }> }>;
    const facts = sections[0]?.facts ?? [];
    expect(facts).toEqual(
      expect.arrayContaining([
        { name: "Event", value: "SCAN_COMPLETED" },
        { name: "Source", value: "AccessKit" },
        { name: "Website", value: "Acme" },
        { name: "URL", value: "https://acme.com" },
        { name: "Score", value: "87/100" },
      ]),
    );
  });

  it("includes a potentialAction OpenUri when link can be derived", () => {
    const msg = formatTeamsMessage({
      event: "CRITICAL_ISSUES_FOUND",
      payload: { websiteId: "w_1", criticalCount: 2 },
      baseUrl: "https://app.example.com",
    });
    const actions = msg.potentialAction as Array<{
      "@type": string;
      targets: Array<{ uri: string }>;
    }>;
    expect(actions[0]?.["@type"]).toBe("OpenUri");
    expect(actions[0]?.targets[0]?.uri).toBe("https://app.example.com/websites/w_1");
  });

  it("omits potentialAction when no link resolvable (no baseUrl, no absolute)", () => {
    const msg = formatTeamsMessage({
      event: "CRITICAL_ISSUES_FOUND",
      payload: { websiteName: "Acme", criticalCount: 1 },
    });
    expect(msg.potentialAction).toBeUndefined();
  });

  it("uses the explicit payload.link as-is when it is already absolute", () => {
    const msg = formatTeamsMessage({
      event: "SCAN_COMPLETED",
      payload: { websiteName: "Acme", link: "https://custom.example/deep" },
    });
    const actions = msg.potentialAction as Array<{ targets: Array<{ uri: string }> }>;
    expect(actions[0]?.targets[0]?.uri).toBe("https://custom.example/deep");
  });
});

describe("formatForProvider", () => {
  const genericPayload = { event: "SCAN_COMPLETED", data: { foo: "bar" }, timestamp: "2026-01-01" };

  it("returns the generic payload untouched for unknown hosts", () => {
    const result = formatForProvider({
      url: "https://zapier.com/hooks/catch/abc",
      event: "SCAN_COMPLETED",
      payload: { foo: "bar" },
      genericPayload,
    });
    expect(result.provider).toBe("generic");
    expect(result.body).toBe(genericPayload);
  });

  it("dispatches to formatSlackMessage for slack URLs", () => {
    const result = formatForProvider({
      url: "https://hooks.slack.com/services/T/B/X",
      event: "SCAN_COMPLETED",
      payload: { websiteName: "Acme", score: 90, totalViolations: 0, pagesScanned: 1 },
      genericPayload,
    });
    expect(result.provider).toBe("slack");
    expect(result.body).toHaveProperty("text");
    expect(result.body).toHaveProperty("blocks");
  });

  it("dispatches to formatTeamsMessage for teams URLs", () => {
    const result = formatForProvider({
      url: "https://tenant.webhook.office.com/webhookb2/abc",
      event: "SCAN_COMPLETED",
      payload: { websiteName: "Acme", score: 90, totalViolations: 0, pagesScanned: 1 },
      genericPayload,
    });
    expect(result.provider).toBe("teams");
    expect(result.body).toHaveProperty("@type", "MessageCard");
  });
});
