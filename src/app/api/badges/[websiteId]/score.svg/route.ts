import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildScoreBadgeSvg } from "@/lib/badges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint — no auth. Returns an SVG badge for a website's current
 * accessibility score, but only if the website owner has explicitly opted
 * in via `publicBadgeEnabled`.
 *
 * Cached at the edge for 5 minutes to absorb burst traffic from embedded
 * README / footer / blog post placements. Private caches (browsers) respect
 * the same 5-minute window.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { websiteId } = await params;

  const website = await db.website.findUnique({
    where: { id: websiteId },
    select: { publicBadgeEnabled: true, currentScore: true },
  });

  if (!website || !website.publicBadgeEnabled) {
    return new NextResponse("Not found", { status: 404 });
  }

  const svg = buildScoreBadgeSvg(website.currentScore);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Badges are embedded in READMEs and blog posts → aggressive caching
      // saves DB hits. 5-min TTL with stale-while-revalidate keeps perceived
      // latency near-zero even when the score does change.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
