import { db } from "@/lib/db";
import { WebhookEvent } from "@prisma/client";
import { createHmac } from "crypto";
import { formatForProvider } from "@/lib/webhook-formatters";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 10_000;

/**
 * Deliver a webhook event to all matching webhooks for an organization.
 * Retries up to MAX_RETRIES on failure with exponential backoff.
 */
export async function deliverWebhookEvent(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const webhooks = await db.webhook.findMany({
    where: {
      organizationId,
      enabled: true,
      events: { has: event },
    },
  });

  const results: Array<{ webhookId: string; success: boolean }> = [];

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.APP_URL ??
    undefined;

  for (const webhook of webhooks) {
    // Generic envelope for custom listeners — unchanged contract.
    const genericEnvelope: Record<string, unknown> = {
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    // Slack / Teams get native schemas so messages render correctly in-channel.
    const { provider, body: formattedBody } = formatForProvider({
      url: webhook.url,
      event,
      payload,
      baseUrl,
      genericPayload: genericEnvelope,
    });

    const body = JSON.stringify(formattedBody);
    // HMAC always signs what we ultimately put on the wire (generic or
    // native), so receivers that care about provenance still have a stable
    // contract. Slack/Teams themselves don't verify this header but the
    // signature is harmless there.
    const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

    let success = false;
    let statusCode: number | null = null;
    let response: string | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      attempts = attempt + 1;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AccessKit-Signature": `sha256=${signature}`,
            "X-AccessKit-Event": event,
            "X-AccessKit-Provider": provider,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = res.status;
        response = await res.text().catch(() => null);
        success = res.ok;

        if (success) break;
      } catch (err) {
        response = err instanceof Error ? err.message : String(err);
      }

      // Exponential backoff: 1s, 4s, 9s
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) ** 2 * 1000));
      }
    }

    // Log delivery
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as object,
        statusCode,
        response: response?.slice(0, 2000) ?? null,
        success,
        attempts,
      },
    });

    results.push({ webhookId: webhook.id, success });
  }

  return results;
}
