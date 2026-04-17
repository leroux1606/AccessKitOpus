import { NextRequest, NextResponse } from "next/server";
import { assertSafeFetchUrl, SsrfError } from "@/lib/ssrf-guard";
import { checkRateLimit } from "@/lib/rate-limiter";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/demo-scan — single-page public accessibility scan for the landing demo.
 * Unauthenticated, aggressively rate-limited, and SSRF-guarded.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`demo-scan:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.resetInMs / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = body?.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  // SSRF guard: blocks private IPs, localhost, cloud metadata endpoints, and
  // catches DNS-rebinding attempts by resolving the hostname before fetch.
  try {
    await assertSafeFetchUrl(normalizedUrl);
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json(
        { error: "This URL points to a private or restricted address." },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const { runScan } = await import("@/scanner");
    const result = await runScan(normalizedUrl, 1, []);

    const page = result.pages[0];
    const topIssues = page?.violations.slice(0, 5).map((v) => ({
      severity: v.severity,
      description: v.description,
      ruleId: v.ruleId,
      wcagCriterion: v.wcagCriterion,
      fixSuggestion: v.fixSuggestion,
    })) ?? [];

    return NextResponse.json({
      url: normalizedUrl,
      score: result.score,
      totalViolations: result.totalViolations,
      criticalCount: result.criticalCount,
      seriousCount: result.seriousCount,
      moderateCount: result.moderateCount,
      minorCount: result.minorCount,
      topIssues,
    });
  } catch (err) {
    // Don't leak internal error details to unauthenticated callers
    const message =
      err instanceof Error && err.message.startsWith("Invalid URL")
        ? err.message
        : "Scan failed. Please try a different URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
