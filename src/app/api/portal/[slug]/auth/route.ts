import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * POST /api/portal/[slug]/auth
 * Body: { password: string }
 *
 * Verifies the portal password and sets an httpOnly cookie that the portal
 * page reads on subsequent requests. This avoids leaking the password via
 * URL (history, referrer, logs).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Basic anti-brute-force: 10 attempts per IP per portal per 10 minutes
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rl = checkRateLimit(`portal-auth:${slug}:${ip}`, 10, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = body?.password;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const portal = await db.clientPortal.findUnique({
    where: { slug },
    select: { passwordHash: true, enabled: true },
  });

  if (!portal || !portal.enabled || !portal.passwordHash) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const candidateHash = createHash("sha256").update(password).digest("hex");
  if (candidateHash !== portal.passwordHash) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`portal_${slug}`, candidateHash, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/portal/${slug}`,
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
