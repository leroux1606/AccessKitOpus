/**
 * Defense-in-depth checks for third-party webhook endpoints.
 *
 * Our webhook routes (`/api/webhooks/stripe`, `/api/webhooks/paystack`, …)
 * are skipped by the CSRF middleware because they authenticate via HMAC
 * signatures, not cookies. That means they accept requests from any
 * origin as long as the signature matches — which is fine in principle,
 * but it's easy to leak a webhook secret. These helpers add a secondary
 * guardrail:
 *
 *   - Reject requests that carry a browser-style `Origin` header pointing
 *     anywhere other than our own app (or an explicit allowlist). A
 *     legitimate server-to-server webhook call from Stripe / PayStack
 *     never sends one.
 *
 *   - Enforce a hard cap on the request body size so a malicious caller
 *     with a stolen signing secret (or a bug in the HMAC check) cannot
 *     OOM the process with a multi-GB payload.
 */

export interface WebhookGuardInput {
  method: string;
  origin: string | null;
  contentLength: string | null;
}

export interface WebhookGuardOptions {
  /**
   * Origins that are explicitly allowed to send requests to this webhook.
   * A server-to-server webhook (Stripe, PayStack) should never set Origin,
   * so this list is usually empty — any Origin header fails the check.
   *
   * Always extends with the app's own origin via the caller so that
   * developer tools (e.g. a local replay script hosted on the same app)
   * aren't rejected.
   */
  allowedOrigins?: Iterable<string>;
  /** Hard cap on request body size. Defaults to 1 MB. */
  maxBodyBytes?: number;
}

export interface WebhookGuardResult {
  ok: boolean;
  reason?: string;
  /** HTTP status to return to the client when `ok === false`. */
  status?: number;
}

const DEFAULT_MAX_WEBHOOK_BYTES = 1 * 1024 * 1024;

/**
 * Validates incoming webhook request metadata. Call this **before** reading
 * the body — it only inspects headers so it's cheap and safe to reject early.
 */
export function checkWebhookRequest(
  input: WebhookGuardInput,
  opts: WebhookGuardOptions = {},
): WebhookGuardResult {
  if (input.method.toUpperCase() !== "POST") {
    return { ok: false, reason: "Method not allowed", status: 405 };
  }

  const maxBytes = opts.maxBodyBytes ?? DEFAULT_MAX_WEBHOOK_BYTES;
  if (input.contentLength) {
    const parsed = Number.parseInt(input.contentLength, 10);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      return {
        ok: false,
        reason: `Payload too large (${parsed} > ${maxBytes})`,
        status: 413,
      };
    }
  }

  // Legit webhook senders (Stripe / PayStack) don't send Origin at all.
  // If Origin is present, it must be in the allowlist — otherwise this is
  // almost certainly a cross-origin browser request and should be rejected
  // even before the HMAC step.
  if (input.origin) {
    const allowed = new Set<string>(opts.allowedOrigins ?? []);
    if (!allowed.has(input.origin)) {
      return {
        ok: false,
        reason: `Unexpected Origin: ${input.origin}`,
        status: 403,
      };
    }
  }

  return { ok: true };
}
