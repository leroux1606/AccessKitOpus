import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { buildScanReportData } from "@/lib/report-data";
import { ScanReportPDF } from "@/components/reports/pdf-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await db.report.findUnique({
    where: { id: reportId },
    include: { website: true },
  });

  if (!report || report.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await buildScanReportData(report.scanId);
  if (!data) {
    return NextResponse.json({ error: "Scan data not available" }, { status: 404 });
  }

  const element = React.createElement(ScanReportPDF, { data });
  // @react-pdf/renderer types expect Document directly but component wrapping works at runtime
  const buffer = await (renderToBuffer as (e: React.ReactElement) => Promise<Buffer>)(element);

  const filename = `${data.websiteName.replace(/[^a-zA-Z0-9-_]/g, "_")}-report-${report.id.slice(-6)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
