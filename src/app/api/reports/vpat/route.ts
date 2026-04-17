import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { getPlanLimits } from "@/lib/plans";
import { renderToBuffer } from "@react-pdf/renderer";
import { VpatReportPDF } from "@/components/reports/vpat-template";
import { buildVpatReportData } from "@/lib/report-data";
import React from "react";

// GET /api/reports/vpat?websiteId=xxx — generate VPAT PDF
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required" }, { status: 400 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const limits = getPlanLimits(membership.organization.plan);
  if (!limits.hasCompliancePackage) {
    return NextResponse.json(
      { error: "VPAT reports require Agency or Enterprise plan" },
      { status: 403 },
    );
  }

  // Verify website belongs to org
  const website = await db.website.findFirst({
    where: { id: websiteId, organizationId: membership.organizationId },
    select: { id: true, name: true },
  });
  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const data = await buildVpatReportData(websiteId);
  if (!data) {
    return NextResponse.json({ error: "No scan data available" }, { status: 404 });
  }

  const element = React.createElement(VpatReportPDF, { data });
  const buffer = await (renderToBuffer as (e: React.ReactElement) => Promise<Buffer>)(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vpat-${website.name.toLowerCase().replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
