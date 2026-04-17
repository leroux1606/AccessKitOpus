import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/websites",
  "/issues",
  "/team",
  "/settings",
  "/clients",
  "/integrations",
  "/reports",
  "/benchmarking",
  "/onboarding",
];

// Simple in-memory rate limiter for public endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const PUBLIC_API_LIMIT = 30; // 30 req/min for unauthenticated public endpoints

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // CSRF: every state-changing /api/* request must come from a trusted
  // origin. Skips NextAuth, signed webhooks, public v1 API, and health.
  const csrf = checkCsrf({
    method: req.method,
    pathname,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    selfOrigin: req.nextUrl.origin,
  });
  if (!csrf.ok) {
    return NextResponse.json(
      { error: "CSRF check failed" },
      { status: 403 },
    );
  }

  // Rate limit public API endpoints (demo-scan, OpenAPI spec)
  if (pathname.startsWith("/api/demo-scan") || pathname === "/api/v1/openapi.json") {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    if (!checkRateLimit(`public:${ip}`, PUBLIC_API_LIMIT)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
