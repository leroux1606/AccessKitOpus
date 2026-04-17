/**
 * Origin-based CSRF protection.
 *
 * For session-cookie-authenticated routes we enforce that the `Origin`
 * (or `Referer` as fallback) header on every state-changing request
 * matches a known-good origin. This is the OWASP-recommended defense
 * for cookie-auth APIs and does not require a separate token exchange.
 *
 * Skipped routes:
 *   - /api/auth/*        NextAuth has its own CSRF token flow
 *   - /api/webhooks/*    third-party callers; verified via HMAC signature
 *   - /api/inngest       Inngest webhooks; signed
 *   - /api/v1/*          public API surface; uses Bearer API keys, no cookie
 *   - /api/health        public health probe; GET only anyway
 *
 * Request methods treated as "safe" (not checked):
 *   - GET, HEAD, OPTIONS
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const SKIP_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
  "/api/inngest",
  "/api/v1/",
  "/api/health",
];

export interface CsrfCheckInput {
  method: string;
  pathname: string;
  origin: string | null;
  referer: string | null;
  /** The request's own origin (e.g. `req.nextUrl.origin`). Always allowed. */
  selfOrigin: string;
}

export interface CsrfCheckResult {
  ok: boolean;
  /** Present only when `ok === false`. Human-readable reason for logs. */
  reason?: string;
}

/**
 * Collect allowed origins from env + the request's own origin.
 * Exported for testing.
 */
export function getAllowedOrigins(selfOrigin: string): Set<string> {
  const allowed = new Set<string>([selfOrigin]);
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      allowed.add(new URL(candidate).origin);
    } catch {
      // ignore malformed env values
    }
  }
  return allowed;
}

/**
 * Returns `{ ok: true }` if the request should be allowed through, or
 * `{ ok: false, reason }` if it should be rejected as a CSRF suspect.
 */
export function checkCsrf(input: CsrfCheckInput): CsrfCheckResult {
  const method = input.method.toUpperCase();

  if (SAFE_METHODS.has(method)) return { ok: true };

  if (SKIP_PREFIXES.some((p) => input.pathname.startsWith(p))) {
    return { ok: true };
  }

  // Only apply to /api/* — dashboard pages handle their own form flows via
  // server actions, which Next.js protects with its own origin check.
  if (!input.pathname.startsWith("/api/")) return { ok: true };

  const allowed = getAllowedOrigins(input.selfOrigin);

  // Prefer Origin (set by browsers on all cross-origin and most same-origin
  // POSTs). Fall back to Referer only if Origin is absent (some server-to-
  // server clients strip Origin but keep Referer; browsers in private /
  // sandboxed contexts also sometimes do this).
  let candidateOrigin: string | null = null;
  if (input.origin) {
    candidateOrigin = input.origin;
  } else if (input.referer) {
    try {
      candidateOrigin = new URL(input.referer).origin;
    } catch {
      return { ok: false, reason: "Malformed Referer header" };
    }
  }

  if (!candidateOrigin) {
    return {
      ok: false,
      reason: "Missing Origin and Referer headers on state-changing request",
    };
  }

  if (!allowed.has(candidateOrigin)) {
    return {
      ok: false,
      reason: `Origin ${candidateOrigin} is not an allowed origin`,
    };
  }

  return { ok: true };
}
