"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { inngest } from "@/inngest/client";
import { getPlanLimits } from "@/lib/plans";
import type { ScanEventData } from "@/types/scan";

export async function triggerScan(websiteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) throw new Error("Website not found");

  // Check if there's already a scan in progress
  const runningScan = await db.scan.findFirst({
    where: { websiteId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (runningScan) {
    redirect(`/websites/${websiteId}/scans/${runningScan.id}`);
  }

  // DB-backed rate limit: max 10 scans per website per 24 hours
  // Works reliably in multi-instance / serverless environments
  const scansToday = await db.scan.count({
    where: {
      websiteId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (scansToday >= 10) {
    throw new Error("Daily scan limit reached (10 scans per website per day). Try again tomorrow.");
  }

  const limits = getPlanLimits(membership.organization.plan);
  const pageLimit = isFinite(limits.pagesPerScan) ? limits.pagesPerScan : 1000;

  // Create scan record in QUEUED state
  const scan = await db.scan.create({
    data: {
      websiteId,
      status: "QUEUED",
      pageLimit,
      triggeredBy: "MANUAL",
    },
  });

  // Fire Inngest event
  const eventData: ScanEventData = {
    scanId: scan.id,
    websiteId,
    organizationId: membership.organizationId,
    websiteUrl: website.url,
    pageLimit,
    standards: website.standards,
  };

  await inngest.send({
    name: "scan/website.requested",
    data: eventData,
  });

  redirect(`/websites/${websiteId}/scans/${scan.id}`);
}
