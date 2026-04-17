import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { assertSafeFetchUrl } from "@/lib/ssrf-guard";
import { checkRateLimit } from "@/lib/rate-limiter";

const MAX_BODY_BYTES = 512 * 1024; // 512 KB — prevent memory exhaustion on large pages

async function readBodyCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      received += value.length;
      if (received > MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for (const c of chunks) { buf.set(c, pos); pos += c.length; }
  return new TextDecoder().decode(buf);
}

/**
 * Verifies website ownership by checking all three methods:
 * 1. HTML meta tag in the page's <head>
 * 2. DNS TXT record on the domain
 * 3. File at /.well-known/accesskit-verify.txt
 *
 * Returns the method that succeeded, or an error.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 verification attempts per user per hour
  const { allowed, resetInMs } = checkRateLimit(
    `verify:${session.user.id}`,
    5,
    60 * 60 * 1000,
  );
  if (!allowed) {
    const retryAfterSec = Math.ceil(resetInMs / 1000);
    return NextResponse.json(
      { error: `Too many verification attempts. Try again in ${Math.ceil(resetInMs / 60000)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const body = await req.json() as { websiteId: string };
  const { websiteId } = body;

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 });
  }

  // Verify ownership of the website
  const membership = await getActiveMembership(session.user.id);

  if (!membership) {
    return NextResponse.json({ error: "Not a member of any organization" }, { status: 403 });
  }

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  if (website.verified) {
    return NextResponse.json({ success: true, method: website.verificationMethod });
  }

  // Dev-mode bypass: skip real verification checks in local development
  if (process.env.NODE_ENV === "development") {
    await db.website.update({
      where: { id: websiteId },
      data: { verified: true, verificationMethod: "META_TAG" },
    });
    return NextResponse.json({ success: true, method: "META_TAG" });
  }

  // SSRF guard: confirm website URL is a public address (includes DNS rebinding check)
  try {
    await assertSafeFetchUrl(website.url);
  } catch {
    return NextResponse.json(
      { error: "Website URL is not a valid public address." },
      { status: 422 }
    );
  }

  const token = website.verificationToken;
  let verifiedMethod: "META_TAG" | "DNS_TXT" | "FILE_UPLOAD" | null = null;

  // Method 1: Check HTML meta tag
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(website.url, {
      signal: controller.signal,
      headers: { "User-Agent": "AccessKit-Verification/1.0" },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await readBodyCapped(response);
      const metaPattern = new RegExp(
        `<meta[^>]+name=["']accesskit-verification["'][^>]+content=["']${token}["']`,
        "i"
      );
      const altMetaPattern = new RegExp(
        `<meta[^>]+content=["']${token}["'][^>]+name=["']accesskit-verification["']`,
        "i"
      );

      if (metaPattern.test(html) || altMetaPattern.test(html)) {
        verifiedMethod = "META_TAG";
      }
    }
  } catch {
    // Continue to next method
  }

  // Method 2: Check DNS TXT record
  if (!verifiedMethod) {
    try {
      const { Resolver } = await import("dns").then((m) => m.promises);
      const resolver = new Resolver();
      const hostname = new URL(website.url).hostname;

      const records = await resolver.resolveTxt(hostname).catch(() => []);
      const expectedValue = `accesskit-verify=${token}`;

      for (const record of records) {
        const joined = record.join("");
        if (joined === expectedValue) {
          verifiedMethod = "DNS_TXT";
          break;
        }
      }
    } catch {
      // Continue to next method
    }
  }

  // Method 3: Check verification file
  if (!verifiedMethod) {
    try {
      const fileUrl = `${website.url}/.well-known/accesskit-verify.txt`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(fileUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "AccessKit-Verification/1.0" },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const content = (await readBodyCapped(response)).trim();
        if (content === token) {
          verifiedMethod = "FILE_UPLOAD";
        }
      }
    } catch {
      // All methods failed
    }
  }

  if (verifiedMethod) {
    await db.website.update({
      where: { id: websiteId },
      data: {
        verified: true,
        verificationMethod: verifiedMethod,
      },
    });

    return NextResponse.json({ success: true, method: verifiedMethod });
  }

  return NextResponse.json(
    {
      success: false,
      error:
        "Verification failed. Make sure the meta tag, DNS record, or verification file is in place and try again.",
    },
    { status: 422 }
  );
}
