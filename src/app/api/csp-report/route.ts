import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";

/**
 * Receiver for Content-Security-Policy violation reports.
 *
 * Browsers POST here when the CSP directive in `next.config.ts` blocks or
 * flags a resource. Two encodings are accepted:
 *
 *   - Legacy `application/csp-report`: `{ "csp-report": { ... } }`
 *   - Reporting API `application/reports+json`: `[{ "type": "csp-violation", "body": { ... } }]`
 *
 * Reports are logged to stderr in a structured format so they can be
 * shipped to Sentry / Datadog via the existing log forwarder. We cap
 * payload size to 8 KB to stop a hostile browser from flooding us with
 * multi-MB reports, and we rate-limit to 60 reports per IP per minute.
 */

const MAX_REPORT_BYTES = 8 * 1024;
const REPORT_LIMIT_PER_MIN = 60;

interface LegacyCspReport {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    disposition?: string;
    "original-policy"?: string;
    referrer?: string;
  };
}

interface ReportingApiEntry {
  type?: string;
  url?: string;
  age?: number;
  user_agent?: string;
  body?: Record<string, unknown>;
}

function summarize(entry: unknown): string {
  if (!entry || typeof entry !== "object") return "unknown";
  const cspLegacy = (entry as LegacyCspReport)["csp-report"];
  if (cspLegacy) {
    const directive = cspLegacy["effective-directive"] ?? cspLegacy["violated-directive"];
    return `${directive} blocked ${cspLegacy["blocked-uri"] ?? "?"} on ${cspLegacy["document-uri"] ?? "?"}`;
  }
  const api = entry as ReportingApiEntry;
  if (api.body) {
    const b = api.body as Record<string, unknown>;
    const directive = b.effectiveDirective ?? b.violatedDirective;
    return `${String(directive)} blocked ${String(b.blockedURL ?? "?")} on ${String(b.documentURL ?? api.url ?? "?")}`;
  }
  return "unparsable report";
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed } = checkRateLimit(`csp-report:${ip}`, REPORT_LIMIT_PER_MIN, 60_000);
  if (!allowed) {
    return new NextResponse(null, { status: 204 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
  }

  let payload: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const entries = Array.isArray(payload) ? payload : [payload];
  for (const entry of entries) {
    console.warn("[CSP] violation:", summarize(entry));
  }

  // Browsers don't read the response body; 204 is conventional for beacons.
  return new NextResponse(null, { status: 204 });
}
