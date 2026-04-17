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

// `scanWebsiteJob` spawns Chromium via Playwright and needs ~1 GB of resident
// RAM per concurrent scan. Running it inside Next.js OOMs 1 GB serverless
// functions (Vercel/Lambda), so in production the job is served by the
// dedicated Fly.io scanner worker (see `worker/server.ts`, `fly.toml`).
//
// In local development — where the dev machine has plenty of RAM — we keep
// the job registered here so `pnpm dev` can run end-to-end scans without
// also needing to `pnpm worker:dev`. Production deployments should leave
// `RUN_SCANS_IN_NEXT` unset so only the worker advertises this function to
// Inngest Cloud.
const runScansInNext =
  process.env.RUN_SCANS_IN_NEXT === "true" ||
  (process.env.RUN_SCANS_IN_NEXT === undefined && process.env.NODE_ENV !== "production");

const baseFunctions = [
  scheduledScansJob,
  dataRetentionJob,
  trialRemindersJob,
  scanCompleteNotification,
  criticalIssuesNotification,
  scoreDropNotification,
  weeklyDigestNotification,
];

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: runScansInNext ? [...baseFunctions, scanWebsiteJob] : baseFunctions,
});
