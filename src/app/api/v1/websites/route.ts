import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

/** List all websites for this organization */
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const websites = await db.website.findMany({
    where: { organizationId: authResult.organizationId },
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
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: websites });
}
