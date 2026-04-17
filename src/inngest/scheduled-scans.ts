import { inngest } from "./client";
import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";
import { calculateNextRunAt } from "@/lib/scan-schedule";
import type { ScanEventData } from "@/types/scan";

/**
 * Inngest cron job — runs every 15 minutes, checks for websites
 * whose scheduled scan time has arrived, and fires scan events.
 *
 * Phase 8: Automation & Monitoring
 */
export const scheduledScansJob = inngest.createFunction(
  {
    id: "scheduled-scans",
    name: "Trigger Scheduled Scans",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    // Find all enabled schedules that are due
    const dueSchedules = await step.run("find-due-schedules", async () => {
      return db.scanSchedule.findMany({
        where: {
          enabled: true,
          nextRunAt: { lte: new Date() },
          website: { verified: true },
        },
        include: {
          website: {
            include: { organization: true },
          },
        },
      });
    });

    if (dueSchedules.length === 0) return { triggered: 0 };

    let triggered = 0;

    for (const schedule of dueSchedules) {
      await step.run(`trigger-scan-${schedule.websiteId}`, async () => {
        const website = schedule.website;

        // Skip if there's already an active scan
        const activeScans = await db.scan.count({
          where: {
            websiteId: website.id,
            status: { in: ["QUEUED", "RUNNING"] },
          },
        });
        if (activeScans > 0) return;

        const limits = getPlanLimits(website.organization.plan);
        const pageLimit = limits.pagesPerScan;

        // Create the scan record
        const scan = await db.scan.create({
          data: {
            websiteId: website.id,
            status: "QUEUED",
            pageLimit,
            triggeredBy: "SCHEDULED",
          },
        });

        // Fire the scan event
        const eventData: ScanEventData = {
          scanId: scan.id,
          websiteId: website.id,
          organizationId: website.organizationId,
          websiteUrl: website.url,
          pageLimit,
          standards: website.standards,
        };

        await inngest.send({ name: "scan/website.requested", data: eventData });

        // Update schedule: set lastRunAt + calculate next occurrence from stored day/hour
        await db.scanSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: calculateNextRunAt({
              frequency: schedule.frequency,
              scheduledHour: schedule.scheduledHour,
              scheduledDay: schedule.scheduledDay,
              forceAdvance: true,
            }),
          },
        });

        triggered++;
      });
    }

    return { triggered };
  },
);
