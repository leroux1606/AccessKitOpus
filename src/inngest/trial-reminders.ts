import { inngest } from "./client";
import { db } from "@/lib/db";

/**
 * Daily cron job that checks for organizations with expiring trials
 * and sends reminder emails at day 7, day 2, and day 0 (last day).
 */
export const trialRemindersJob = inngest.createFunction(
  {
    id: "trial-reminders",
    name: "Trial Reminder Emails",
    triggers: [{ cron: "0 14 * * *" }], // Daily at 2 PM UTC
  },
  async ({ step }) => {
    // Find all orgs that are still trialing
    const trialingOrgs = await step.run("fetch-trialing-orgs", async () => {
      return db.organization.findMany({
        where: {
          subscriptionStatus: "TRIALING",
          trialEndsAt: { not: null },
        },
        include: {
          memberships: {
            where: { role: "OWNER" },
            include: { user: { select: { email: true, name: true } } },
          },
        },
      });
    });

    let sent = 0;

    for (const org of trialingOrgs) {
      if (!org.trialEndsAt) continue;

      const now = new Date();
      const trialEnd = new Date(org.trialEndsAt);
      const daysLeft = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send reminders at specific intervals
      const shouldSend = daysLeft === 7 || daysLeft === 2 || daysLeft === 0;
      if (!shouldSend) continue;

      const ownerEmail = org.memberships[0]?.user?.email;
      if (!ownerEmail) continue;

      await step.run(`send-reminder-${org.id}`, async () => {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) return;

        const { Resend } = await import("resend");
        const resend = new Resend(resendApiKey);

        const ownerName = org.memberships[0]?.user?.name ?? "there";
        const billingUrl = `${process.env.AUTH_URL}/settings/billing`;

        const subject =
          daysLeft === 0
            ? `Your AccessKit trial ends today`
            : daysLeft === 2
              ? `Your AccessKit trial ends in 2 days`
              : `Your AccessKit trial — 7 days left`;

        const body =
          daysLeft === 0
            ? `Hi ${ownerName},\n\nYour AccessKit free trial ends today. Subscribe now to keep scanning your websites and tracking accessibility issues.\n\nVisit your billing settings to choose a plan: ${billingUrl}\n\nIf you don't subscribe, your account will switch to read-only mode — you'll still be able to view past reports but won't be able to run new scans.\n\n— The AccessKit Team`
            : daysLeft === 2
              ? `Hi ${ownerName},\n\nYour AccessKit free trial ends in 2 days. Don't lose access to your accessibility monitoring.\n\nSubscribe now: ${billingUrl}\n\n— The AccessKit Team`
              : `Hi ${ownerName},\n\nYou're halfway through your AccessKit free trial! Here's what you can do before it ends:\n\n• Run scans on all your websites\n• Generate compliance reports\n• Try the issue workflow and team collaboration\n\nReady to subscribe? Visit: ${billingUrl}\n\n— The AccessKit Team`;

        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
          to: ownerEmail,
          subject,
          text: body,
        });
      });

      sent++;
    }

    return { checked: trialingOrgs.length, sent };
  }
);
