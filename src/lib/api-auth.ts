import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limiter";

interface ApiAuthResult {
  organizationId: string;
  apiKeyId: string;
}

/** Rate limits per plan (requests per minute) */
const API_RATE_LIMITS: Record<string, number> = {
  AGENCY: 100,
  ENTERPRISE: 1000,
};

/**
 * Validate an API key from the Authorization header.
 * Also enforces per-plan rate limiting.
 * Returns the org ID if valid, or a NextResponse error.
 */
export async function validateApiKey(
  req: NextRequest
): Promise<ApiAuthResult | NextResponse> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer ak_live_..." },
      { status: 401 }
    );
  }

  const rawKey = authHeader.slice(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { organization: { select: { id: true, plan: true } } },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json({ error: "API key expired" }, { status: 401 });
  }

  // Verify the org has API access (Agency+)
  const plan = apiKey.organization.plan;
  if (!["AGENCY", "ENTERPRISE"].includes(plan)) {
    return NextResponse.json(
      { error: "API access requires Agency plan or higher" },
      { status: 403 }
    );
  }

  // Rate limiting — per organization, per minute
  const rateLimit = API_RATE_LIMITS[plan] ?? 100;
  const rl = checkRateLimit(`api:${apiKey.organization.id}`, rateLimit, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetInMs / 1000)),
          "X-RateLimit-Limit": String(rateLimit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetInMs / 1000)),
        },
      }
    );
  }

  // Update lastUsedAt (fire and forget)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    organizationId: apiKey.organization.id,
    apiKeyId: apiKey.id,
  };
}
