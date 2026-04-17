import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { scanWebsiteJob } from "@/inngest/scan-website";
import { scheduledScansJob } from "@/inngest/scheduled-scans";
import { dataRetentionJob } from "@/inngest/data-retention";
import { trialRemindersJob } from "@/inngest/trial-reminders";
import {
  scanCompleteNotification,
  criticalIssuesNotification,
  scoreDropNotification,
  weeklyDigestNotification,
} from "@/inngest/notification-emails";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scanWebsiteJob,
    scheduledScansJob,
    dataRetentionJob,
    trialRemindersJob,
    scanCompleteNotification,
    criticalIssuesNotification,
    scoreDropNotification,
    weeklyDigestNotification,
  ],
});
