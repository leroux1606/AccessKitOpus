"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { inngest } from "@/inngest/client";
import { getPlanLimits } from "@/lib/plans";
import { runScan } from "@/scanner";
import type { ScanEventData } from "@/types/scan";

export async function cancelScan(scanId: string, websiteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const scan = await db.scan.findFirst({
    where: {
      id: scanId,
      website: { id: websiteId, organizationId: membership.organizationId },
    },
    select: { status: true },
  });

  if (!scan) throw new Error("Scan not found");
  if (scan.status !== "QUEUED" && scan.status !== "RUNNING") redirect(`/websites/${websiteId}`);

  await db.scan.update({
    where: { id: scanId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });

  redirect(`/websites/${websiteId}`);
}

export async function triggerScan(websiteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/login");

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });
  if (!website) throw new Error("Website not found");
  if (!website.verified) throw new Error("Website ownership must be verified before scanning.");

  // Reclaim any stuck scans first, so a crashed dev-fallback (or a worker
  // that died mid-scan) can't wedge the UI by blocking every subsequent
  // trigger. A scan is "stuck" when:
  //   • status=QUEUED and no startedAt after QUEUE_STUCK_MS — the worker
  //     never picked it up (Inngest dev server not running, `after()` never
  //     fired, process restarted between redirect and callback, etc.)
  //   • status=RUNNING but startedAt is older than RUN_STUCK_MS — the
  //     worker started but died mid-scan; it is never coming back
  const QUEUE_STUCK_MS = 2 * 60 * 1000; // 2 minutes — dev fallback waits 3 s
  const RUN_STUCK_MS = 15 * 60 * 1000; // 15 minutes — longer than MAX_POLL_MS
  const now = Date.now();
  await db.scan.updateMany({
    where: {
      websiteId,
      OR: [
        { status: "QUEUED", createdAt: { lt: new Date(now - QUEUE_STUCK_MS) } },
        { status: "RUNNING", startedAt: { lt: new Date(now - RUN_STUCK_MS) } },
      ],
    },
    data: {
      status: "FAILED",
      errorMessage: "Scan did not progress — reclaimed automatically",
      completedAt: new Date(),
    },
  });

  // Redirect to existing active scan rather than creating a duplicate
  const runningScan = await db.scan.findFirst({
    where: { websiteId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (runningScan) {
    redirect(`/websites/${websiteId}/scans/${runningScan.id}`);
  }

  // DB-backed rate limit: max 10 scans per website per 24 hours
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

  const scan = await db.scan.create({
    data: { websiteId, status: "QUEUED", pageLimit, triggeredBy: "MANUAL" },
  });

  const eventData: ScanEventData = {
    scanId: scan.id,
    websiteId,
    organizationId: membership.organizationId,
    websiteUrl: website.url,
    pageLimit,
    standards: website.standards,
  };

  // Try Inngest first. In development without the Inngest dev server running
  // this will throw or silently drop the event — the `after()` block below
  // catches that case and runs the scan directly in the Next.js process.
  try {
    await inngest.send({ name: "scan/website.requested", data: eventData });
  } catch {
    // Inngest unavailable — dev fallback below will handle it
  }

  // Dev-only fallback: if Inngest didn't pick up the event within 3 seconds,
  // run the scan directly inside the Next.js process. This lets `pnpm dev`
  // work end-to-end without also running `pnpm inngest:dev`.
  // In production INNGEST_EVENT_KEY is always set and Inngest is the only path.
  if (process.env.NODE_ENV !== "production") {
    const capturedScanId = scan.id;
    const capturedWebsiteId = websiteId;
    const capturedUrl = website.url;
    const capturedPageLimit = pageLimit;
    const capturedStandards = website.standards;

    after(async () => {
      // Give Inngest 3 s to pick up the event before taking over
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const current = await db.scan.findUnique({
        where: { id: capturedScanId },
        select: { status: true },
      });
      // Inngest already processed it (RUNNING/COMPLETED/FAILED/CANCELLED)
      if (current?.status !== "QUEUED") return;

      await runScanInProcess(
        capturedScanId,
        capturedWebsiteId,
        capturedUrl,
        capturedPageLimit,
        capturedStandards,
      );
    });
  }

  redirect(`/websites/${websiteId}/scans/${scan.id}`);
}

// ---------------------------------------------------------------------------
// Direct in-process scan execution (dev fallback — no Inngest required)
// ---------------------------------------------------------------------------

async function runScanInProcess(
  scanId: string,
  websiteId: string,
  websiteUrl: string,
  pageLimit: number,
  standards: string[],
): Promise<void> {
  // Mark as running
  await db.scan.update({
    where: { id: scanId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await runScan(websiteUrl, pageLimit, standards, { scanId });
    const now = new Date();

    await db.$transaction(async (tx) => {
      // Guard against cancellation that arrived mid-scan
      const check = await tx.scan.findUnique({ where: { id: scanId }, select: { status: true } });
      if (check?.status === "CANCELLED" || check?.status === "FAILED") return;

      // Fetch existing violation fingerprints to preserve firstDetectedAt
      const existing = await tx.violation.findMany({
        where: { websiteId },
        select: { fingerprint: true, firstDetectedAt: true, status: true, assignedToId: true },
        distinct: ["fingerprint"],
      });
      const existingByFp = new Map(existing.map((e) => [e.fingerprint, e]));

      for (const pageResult of result.pages) {
        const page = await tx.page.create({
          data: {
            scanId,
            url: pageResult.url,
            title: pageResult.title || pageResult.url,
            score: pageResult.score,
            violationCount: pageResult.violations.length,
            loadTime: pageResult.loadTime,
            screenshotUrl: pageResult.screenshotUrl ?? null,
          },
        });

        for (const v of pageResult.violations) {
          const prev = existingByFp.get(v.fingerprint);
          await tx.violation.create({
            data: {
              scanId,
              pageId: page.id,
              websiteId,
              ruleId: v.ruleId,
              engine: v.engine,
              severity: v.severity,
              impact: v.impact,
              category: v.category,
              standards: v.standards,
              wcagCriterion: v.wcagCriterion,
              wcagLevel: v.wcagLevel,
              description: v.description,
              helpText: v.helpText,
              helpUrl: v.helpUrl,
              htmlElement: v.htmlElement,
              cssSelector: v.cssSelector,
              xpath: v.xpath,
              fixSuggestion: v.fixSuggestion,
              effortEstimate: v.effortEstimate,
              fingerprint: v.fingerprint,
              firstDetectedAt: prev?.firstDetectedAt ?? now,
              status: prev?.status ?? "OPEN",
              assignedToId: prev?.assignedToId ?? null,
            },
          });
        }
      }

      await tx.scan.update({
        where: { id: scanId },
        data: {
          status: "COMPLETED",
          score: result.score,
          pagesScanned: result.pages.length,
          totalViolations: result.totalViolations,
          criticalCount: result.criticalCount,
          seriousCount: result.seriousCount,
          moderateCount: result.moderateCount,
          minorCount: result.minorCount,
          duration: result.duration,
          completedAt: now,
        },
      });

      await tx.website.update({
        where: { id: websiteId },
        data: { currentScore: result.score, lastScanAt: now },
      });
    });
  } catch (err) {
    await db.scan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}
