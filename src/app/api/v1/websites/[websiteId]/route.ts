import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

/** Get a single website by ID */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { websiteId } = await params;

  const website = await db.website.findFirst({
    where: { id: websiteId, organizationId: authResult.organizationId },
    select: {
      id: true,
      name: true,
      url: true,
      verified: true,
      currentScore: true,
      lastScanAt: true,
      scanFrequency: true,
      standards: true,
      isCompetitor: true,
      createdAt: true,
      _count: { select: { scans: true } },
    },
  });

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  return NextResponse.json({ data: website });
}
