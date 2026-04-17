/**
 * Native payload formatters for Slack & Microsoft Teams incoming webhooks (M3).
 *
 * Our generic webhook delivery pipeline ships a JSON envelope of the form
 *   { event, data, timestamp }
 * which is fine for a custom listener but won't render as a message in Slack /
 * Teams — they expect their own schemas. This module detects those two
 * providers by URL and returns a correctly-shaped payload.
 *
 * Design goals:
 *  - Pure functions. Zero network I/O so the detection + formatting logic is
 *    trivially unit-testable.
 *  - Graceful fallback. Anything that doesn't look like Slack or Teams passes
 *    through unmodified so the existing generic-listener contract is preserved.
 *  - No branding assumptions. We accept an optional `appName` to support both
 *    AccessKit and white-labelled deployments.
 *  - Deterministic output. Same input → same output; no timestamps in the
 *    formatted message bodies (the HTTP envelope already carries timestamp).
 */

import type { WebhookEvent } from "@prisma/client";

// ─── Public detection API ─────────────────────────────────────────────────────

export type WebhookProvider = "slack" | "teams" | "generic";

/**
 * Classify a webhook URL by its hostname.
 *
 * Detection rules (intentionally narrow to avoid false positives):
 *  - Slack:  `hooks.slack.com` on the `/services/...` path.
 *  - Teams:  the legacy Office 365 connector domains
 *            (`*.webhook.office.com`, `outlook.office.com`) **and** the newer
 *            Power Automate / "Workflows" domains (`*.logic.azure.com`).
 *  - Anything else → generic (unchanged passthrough).
 */
export function detectProvider(url: string): WebhookProvider {
  let host = "";
  let pathname = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    pathname = u.pathname;
  } catch {
    return "generic";
  }

  if (host === "hooks.slack.com" && pathname.startsWith("/services/")) {
    return "slack";
  }

  if (
    host === "outlook.office.com" ||
    host.endsWith(".webhook.office.com") ||
    host.endsWith(".logic.azure.com")
  ) {
    return "teams";
  }

  return "generic";
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export interface FormatInput {
  event: WebhookEvent;
  payload: Record<string, unknown>;
  /** App name displayed as the message title / webhook sender (default "AccessKit"). */
  appName?: string;
  /** Canonical origin used to turn relative dashboard paths into absolute links. */
  baseUrl?: string;
}

interface EventPresentation {
  title: string;
  summary: string;
  /** hex, no #, used for Teams themeColor + Slack attachment color. */
  accentHex: string;
}

/**
 * Turn a generic event + payload into the human-friendly display tuple used by
 * both Slack and Teams formatters. Exported for testing; keeps presentation
 * logic in one place.
 */
export function describeEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): EventPresentation {
  const websiteName = asString(payload.websiteName, "a website");
  const websiteUrl = asString(payload.websiteUrl, "");

  switch (event) {
    case "SCAN_COMPLETED": {
      const score = asNumber(payload.score);
      const total = asNumber(payload.totalViolations) ?? 0;
      const pages = asNumber(payload.pagesScanned) ?? 0;
      return {
        title: `Scan complete: ${websiteName}`,
        summary:
          (score !== null ? `Score ${score}/100. ` : "") +
          `${total} issue${total === 1 ? "" : "s"} across ${pages} page${pages === 1 ? "" : "s"}.`,
        accentHex: severityAccent(score, total),
      };
    }
    case "CRITICAL_ISSUES_FOUND": {
      const count = asNumber(payload.criticalCount) ?? 0;
      return {
        title: `Action required — ${count} critical issue${count === 1 ? "" : "s"} on ${websiteName}`,
        summary: `${count} critical accessibility violation${
          count === 1 ? "" : "s"
        } need${count === 1 ? "s" : ""} immediate attention.`,
        accentHex: "ef4444",
      };
    }
    case "SCORE_DROPPED": {
      const prev = asNumber(payload.previousScore);
      const curr = asNumber(payload.currentScore);
      const drop = asNumber(payload.drop);
      return {
        title: `Score dropped on ${websiteName}`,
        summary:
          prev !== null && curr !== null
            ? `Accessibility score fell from ${prev} to ${curr} (-${drop ?? prev - curr} points).`
            : `Accessibility score dropped.`,
        accentHex: "f97316",
      };
    }
    case "ISSUE_STATUS_CHANGED": {
      const status = asString(payload.status, "updated");
      const ruleId = asString(payload.ruleId, "an issue");
      return {
        title: `Issue ${status.toLowerCase()} on ${websiteName}`,
        summary: `${ruleId} has been marked ${status.toLowerCase()}.`,
        accentHex: "3b82f6",
      };
    }
    default: {
      // Exhaustiveness fallback — a new enum value won't hard-fail delivery.
      const e: string = event;
      return {
        title: `${e} — ${websiteName}`,
        summary: websiteUrl ? `Event for ${websiteUrl}.` : "Webhook event received.",
        accentHex: "6b7280",
      };
    }
  }
}

function severityAccent(score: number | null, total: number): string {
  if (score === null) return total > 0 ? "eab308" : "22c55e";
  if (score >= 90) return "22c55e";
  if (score >= 70) return "eab308";
  if (score >= 50) return "f97316";
  return "ef4444";
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function absoluteUrl(baseUrl: string | undefined, rel: string): string | null {
  if (!rel) return null;
  if (/^https?:\/\//i.test(rel)) return rel;
  if (!baseUrl) return null;
  const origin = baseUrl.replace(/\/+$/, "");
  return rel.startsWith("/") ? `${origin}${rel}` : `${origin}/${rel}`;
}

function deriveLink(payload: Record<string, unknown>, baseUrl?: string): string | null {
  const explicit = typeof payload.link === "string" ? payload.link : null;
  if (explicit) return absoluteUrl(baseUrl, explicit);

  const websiteId = typeof payload.websiteId === "string" ? payload.websiteId : null;
  const scanId = typeof payload.scanId === "string" ? payload.scanId : null;
  if (websiteId && scanId) return absoluteUrl(baseUrl, `/websites/${websiteId}/scans/${scanId}`);
  if (websiteId) return absoluteUrl(baseUrl, `/websites/${websiteId}`);
  return null;
}

// ─── Slack formatter ──────────────────────────────────────────────────────────

/**
 * Slack incoming-webhook payload. Uses blocks (modern API) + a top-level
 * `text` fallback so mobile/email previews and legacy clients still render.
 *
 * Reference: https://api.slack.com/messaging/webhooks
 */
export function formatSlackMessage(input: FormatInput): Record<string, unknown> {
  const { event, payload, appName = "AccessKit", baseUrl } = input;
  const { title, summary, accentHex } = describeEvent(event, payload);
  const link = deriveLink(payload, baseUrl);

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: title, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: summary },
    },
  ];

  const contextElements: Array<Record<string, unknown>> = [
    { type: "mrkdwn", text: `*Source:* ${appName}` },
    { type: "mrkdwn", text: `*Event:* \`${event}\`` },
  ];
  blocks.push({ type: "context", elements: contextElements });

  if (link) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View in dashboard" },
          url: link,
          // A "primary" style tints the CTA with Slack's brand green which is
          // visually confusing for red-alert events. Only style primary on
          // informational events.
          ...(accentHex === "22c55e" || accentHex === "3b82f6" ? { style: "primary" } : {}),
        },
      ],
    });
  }

  return {
    text: `${title} — ${summary}`,
    blocks,
    // `attachments` with a single color bar is the cheapest way to surface
    // severity at a glance in the Slack inbox.
    attachments: [{ color: `#${accentHex}`, blocks: [] }],
  };
}

// ─── Teams formatter ──────────────────────────────────────────────────────────

/**
 * Microsoft Teams "Legacy Actionable Message" card (MessageCard schema).
 *
 * We deliberately use MessageCard rather than Adaptive Card because:
 *  - Both the classic Office 365 Connector and the newer Power Automate
 *    "HTTP webhook" trigger accept MessageCard payloads.
 *  - Adaptive Cards require `attachments`-wrapped wrappers and are easy to
 *    get wrong across the two delivery paths; MessageCard renders identically.
 *
 * Reference: https://learn.microsoft.com/en-us/outlook/actionable-messages/message-card-reference
 */
export function formatTeamsMessage(input: FormatInput): Record<string, unknown> {
  const { event, payload, appName = "AccessKit", baseUrl } = input;
  const { title, summary, accentHex } = describeEvent(event, payload);
  const link = deriveLink(payload, baseUrl);

  const facts: Array<{ name: string; value: string }> = [
    { name: "Event", value: event },
    { name: "Source", value: appName },
  ];

  const websiteName = asString(payload.websiteName, "");
  const websiteUrl = asString(payload.websiteUrl, "");
  if (websiteName) facts.push({ name: "Website", value: websiteName });
  if (websiteUrl) facts.push({ name: "URL", value: websiteUrl });

  const score = asNumber(payload.score);
  if (score !== null) facts.push({ name: "Score", value: `${score}/100` });

  const card: Record<string, unknown> = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: title,
    themeColor: accentHex,
    title,
    text: summary,
    sections: [{ facts, markdown: true }],
  };

  if (link) {
    card.potentialAction = [
      {
        "@type": "OpenUri",
        name: "View in dashboard",
        targets: [{ os: "default", uri: link }],
      },
    ];
  }

  return card;
}

// ─── Facade ───────────────────────────────────────────────────────────────────

export interface FormatForProviderInput extends FormatInput {
  url: string;
  /** The envelope the generic path would have sent. Returned as-is for unknown providers. */
  genericPayload: Record<string, unknown>;
}

export interface FormattedWebhookBody {
  provider: WebhookProvider;
  body: Record<string, unknown>;
}

/**
 * Pick the right formatter based on the webhook URL. Generic listeners keep
 * receiving the existing `{event, data, timestamp}` envelope; Slack/Teams get
 * their native schema.
 */
export function formatForProvider(input: FormatForProviderInput): FormattedWebhookBody {
  const provider = detectProvider(input.url);
  switch (provider) {
    case "slack":
      return { provider, body: formatSlackMessage(input) };
    case "teams":
      return { provider, body: formatTeamsMessage(input) };
    case "generic":
      return { provider, body: input.genericPayload };
  }
}
