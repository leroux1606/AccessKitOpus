"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { redirect } from "next/navigation";
import crypto from "crypto";

export async function generateReport(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const scanId = formData.get("scanId") as string;
  const makePublic = formData.get("isPublic") === "on";

  if (!scanId) redirect("/reports?error=no-scan");

  const scan = await db.scan.findUnique({
    where: { id: scanId },
    include: { website: true },
  });

  if (!scan || scan.website.organizationId !== membership.organizationId) {
    redirect("/reports?error=not-found");
  }

  if (scan.status !== "COMPLETED") {
    redirect("/reports?error=not-completed");
  }

  const report = await db.report.create({
    data: {
      organizationId: membership.organizationId,
      websiteId: scan.websiteId,
      scanId: scan.id,
      createdById: session.user.id,
      title: `${scan.website.name} — Scan Report`,
      type: "SCAN_REPORT",
      isPublic: makePublic,
      shareToken: makePublic ? crypto.randomBytes(16).toString("hex") : null,
    },
  });

  redirect(`/reports?created=${report.id}`);
}

export async function toggleReportSharing(reportId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const membership = await getActiveMembership(session.user.id);
  if (!membership) return { error: "No organization found" };

  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report || report.organizationId !== membership.organizationId) {
    return { error: "Report not found" };
  }

  const isPublic = !report.isPublic;
  await db.report.update({
    where: { id: reportId },
    data: {
      isPublic,
      shareToken: isPublic && !report.shareToken
        ? crypto.randomBytes(16).toString("hex")
        : report.shareToken,
    },
  });

  return { success: true, isPublic };
}

export async function deleteReport(reportId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const membership = await getActiveMembership(session.user.id);
  if (!membership) return { error: "No organization found" };

  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report || report.organizationId !== membership.organizationId) {
    return { error: "Report not found" };
  }

  await db.report.delete({ where: { id: reportId } });

  return { success: true };
}
