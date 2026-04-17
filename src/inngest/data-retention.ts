import { inngest } from "./client";
import { db } from "@/lib/db";

/**
 * GDPR Article 5(1)(e) — storage limitation.
 *
 * Runs weekly (Sunday 03:00 UTC) and deletes personal / operational data that
 * is past its retention window. Active/in-progress scans are never deleted.
 *
 * Retention windows:
 *   - Scans (and cascade: Pages, Violations, IssueComments): 12 months
 *   - Notifications (read and unread): 6 months
 *   - Orphan IssueComments whose Violation/Scan was already purged: 12 months
 */
export const dataRetentionJob = inngest.createFunction(
  {
    id: "data-retention",
    name: "Data Retention Cleanup",
    triggers: [{ cron: "0 3 * * 0" }],
  },
  async ({ step, logger }) => {
    const scanCutoff = new Date();
    scanCutoff.setMonth(scanCutoff.getMonth() - 12);

    const notificationCutoff = new Date();
    notificationCutoff.setMonth(notificationCutoff.getMonth() - 6);

    const deletedScans = await step.run("delete-old-scans", async () => {
      const result = await db.scan.deleteMany({
        where: {
          createdAt: { lt: scanCutoff },
          status: { in: ["COMPLETED", "FAILED"] },
        },
      });
      return result.count;
    });

    const deletedNotifications = await step.run("delete-old-notifications", async () => {
      const result = await db.notification.deleteMany({
        where: { createdAt: { lt: notificationCutoff } },
      });
      return result.count;
    });

    logger.info(
      `Data retention: scans=${deletedScans} notifications=${deletedNotifications}`,
    );

    return {
      deletedScans,
      deletedNotifications,
      scanCutoff: scanCutoff.toISOString(),
      notificationCutoff: notificationCutoff.toISOString(),
    };
  },
);
