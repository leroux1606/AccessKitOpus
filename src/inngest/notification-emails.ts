import { inngest } from "./client";
import { db } from "@/lib/db";
import { createNotifications, getEmailRecipients } from "@/lib/notifications";
import { deliverWebhookEvent } from "@/lib/webhooks";

// ─── Scan Complete ───────────────────────────────────────────────────────────

export const scanCompleteNotification = inngest.createFunction(
  {
    id: "notification-scan-complete",
    name: "Scan Complete Notification",
    triggers: [{ event: "scan/completed" }],
  },
  async ({ event, step }) => {
    const { scanId } = event.data as { scanId: string };

    const scan = await step.run("fetch-scan", async () => {
      return db.scan.findUnique({
        where: { id: scanId },
        include: {
          website: {
            select: { id: true, name: true, url: true, organizationId: true, currentScore: true },
          },
        },
      });
    });

    if (!scan || !scan.website) return { skipped: true };

    const { website } = scan;
    const link = `/websites/${website.id}/scans/${scan.id}`;
    const title = `Scan complete: ${website.name}`;
    const scoreText = scan.score !== null ? `Score: ${scan.score}/100` : "Score unavailable";
    const message = `${scoreText} — ${scan.totalViolations ?? 0} issues found across ${scan.pagesScanned} pages.`;

    // In-app notifications
    await step.run("create-in-app", async () => {
      return createNotifications({
        organizationId: website.organizationId,
        type: "SCAN_COMPLETE",
        title,
        message,
        link,
      });
    });

    // Email notifications
    await step.run("send-emails", async () => {
      const recipients = await getEmailRecipients(website.organizationId, "SCAN_COMPLETE");
      if (recipients.length === 0) return;

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) return;

      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const baseUrl = process.env.AUTH_URL ?? "https://app.accesskit.io";

      for (const r of recipients) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
          to: r.email,
          subject: title,
          text: `Hi ${r.name ?? "there"},\n\nA scan of ${website.name} (${website.url}) has completed.\n\n${message}\n\nView results: ${baseUrl}${link}\n\n— The AccessKit Team`,
        });
      }
    });

    // Webhook delivery
    await step.run("deliver-webhooks", async () => {
      await deliverWebhookEvent(website.organizationId, "SCAN_COMPLETED", {
        scanId: scan.id,
        websiteId: website.id,
        websiteName: website.name,
        websiteUrl: website.url,
        score: scan.score,
        totalViolations: scan.totalViolations,
        pagesScanned: scan.pagesScanned,
      });
    });

    return { scanId, notified: true };
  },
);

// ─── Critical Issues Alert ───────────────────────────────────────────────────

export const criticalIssuesNotification = inngest.createFunction(
  {
    id: "notification-critical-issues",
    name: "Critical Issues Alert",
    triggers: [{ event: "scan/completed" }],
  },
  async ({ event, step }) => {
    const { scanId } = event.data as { scanId: string };

    const scan = await step.run("fetch-scan", async () => {
      return db.scan.findUnique({
        where: { id: scanId },
        include: {
          website: {
            select: { id: true, name: true, url: true, organizationId: true },
          },
        },
      });
    });

    if (!scan || !scan.website) return { skipped: true };

    const criticalCount = scan.criticalCount ?? 0;
    if (criticalCount === 0) return { skipped: true, reason: "no critical issues" };

    const { website } = scan;
    const link = `/websites/${website.id}/issues?severity=CRITICAL`;
    const title = `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} on ${website.name}`;
    const message = `A scan found ${criticalCount} critical accessibility violation${criticalCount > 1 ? "s" : ""} that need immediate attention.`;

    await step.run("create-in-app", async () => {
      return createNotifications({
        organizationId: website.organizationId,
        type: "CRITICAL_ISSUES",
        title,
        message,
        link,
      });
    });

    await step.run("send-emails", async () => {
      const recipients = await getEmailRecipients(website.organizationId, "CRITICAL_ISSUES");
      if (recipients.length === 0) return;

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) return;

      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const baseUrl = process.env.AUTH_URL ?? "https://app.accesskit.io";

      for (const r of recipients) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
          to: r.email,
          subject: `[Action Required] ${title}`,
          text: `Hi ${r.name ?? "there"},\n\n${message}\n\nWebsite: ${website.name} (${website.url})\n\nCritical issues require immediate remediation to maintain accessibility compliance. View and address them here:\n${baseUrl}${link}\n\n— The AccessKit Team`,
        });
      }
    });

    await step.run("deliver-webhooks", async () => {
      await deliverWebhookEvent(website.organizationId, "CRITICAL_ISSUES_FOUND", {
        scanId: scan.id,
        websiteId: website.id,
        websiteName: website.name,
        criticalCount,
      });
    });

    return { scanId, criticalCount };
  },
);

// ─── Score Drop Alert ────────────────────────────────────────────────────────

export const scoreDropNotification = inngest.createFunction(
  {
    id: "notification-score-drop",
    name: "Score Drop Alert",
    triggers: [{ event: "scan/completed" }],
  },
  async ({ event, step }) => {
    const { scanId } = event.data as { scanId: string };

    const data = await step.run("fetch-scan-and-previous", async () => {
      const scan = await db.scan.findUnique({
        where: { id: scanId },
        include: {
          website: {
            select: { id: true, name: true, url: true, organizationId: true },
          },
        },
      });
      if (!scan?.website || scan.score === null) return null;

      // Get the previous completed scan for this website
      const previousScan = await db.scan.findFirst({
        where: {
          websiteId: scan.websiteId,
          status: "COMPLETED",
          id: { not: scanId },
          completedAt: { lt: scan.completedAt ?? new Date() },
        },
        orderBy: { completedAt: "desc" },
        select: { score: true },
      });

      return { scan, previousScore: previousScan?.score ?? null };
    });

    if (!data || !data.scan.website) return { skipped: true };

    const { scan, previousScore } = data;
    if (previousScore === null || scan.score === null) return { skipped: true, reason: "no comparison" };

    const drop = previousScore - scan.score;
    if (drop < 5) return { skipped: true, reason: "score did not drop significantly" };

    const { website } = scan;
    const link = `/websites/${website.id}`;
    const title = `Score dropped ${drop} points on ${website.name}`;
    const message = `Accessibility score fell from ${previousScore} to ${scan.score}. Review recent changes for regressions.`;

    await step.run("create-in-app", async () => {
      return createNotifications({
        organizationId: website.organizationId,
        type: "SCORE_DROP",
        title,
        message,
        link,
      });
    });

    await step.run("send-emails", async () => {
      const recipients = await getEmailRecipients(website.organizationId, "SCORE_DROP");
      if (recipients.length === 0) return;

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) return;

      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const baseUrl = process.env.AUTH_URL ?? "https://app.accesskit.io";

      for (const r of recipients) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
          to: r.email,
          subject: title,
          text: `Hi ${r.name ?? "there"},\n\n${message}\n\nPrevious score: ${previousScore}/100\nCurrent score: ${scan.score}/100\nDrop: -${drop} points\n\nReview: ${baseUrl}${link}\n\n— The AccessKit Team`,
        });
      }
    });

    await step.run("deliver-webhooks", async () => {
      await deliverWebhookEvent(website.organizationId, "SCORE_DROPPED", {
        scanId: scan.id,
        websiteId: website.id,
        websiteName: website.name,
        previousScore,
        currentScore: scan.score,
        drop,
      });
    });

    return { scanId, drop };
  },
);

// ─── Weekly Digest ───────────────────────────────────────────────────────────

export const weeklyDigestNotification = inngest.createFunction(
  {
    id: "notification-weekly-digest",
    name: "Weekly Digest Email",
    triggers: [{ cron: "0 10 * * 1" }], // Every Monday at 10 AM UTC
  },
  async ({ step }) => {
    const orgs = await step.run("fetch-active-orgs", async () => {
      return db.organization.findMany({
        where: {
          subscriptionStatus: { in: ["ACTIVE", "TRIALING"] },
        },
        select: { id: true, name: true },
      });
    });

    let sent = 0;

    for (const org of orgs) {
      await step.run(`digest-${org.id}`, async () => {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Gather weekly stats
        const [scansThisWeek, websites] = await Promise.all([
          db.scan.count({
            where: {
              website: { organizationId: org.id },
              status: "COMPLETED",
              completedAt: { gte: oneWeekAgo },
            },
          }),
          db.website.findMany({
            where: { organizationId: org.id, isCompetitor: false },
            select: {
              name: true,
              currentScore: true,
              scans: {
                where: { status: "COMPLETED", completedAt: { gte: oneWeekAgo } },
                select: { score: true, totalViolations: true, criticalCount: true },
                orderBy: { completedAt: "desc" },
                take: 1,
              },
            },
          }),
        ]);

        if (scansThisWeek === 0 && websites.length === 0) return;

        const totalIssues = websites.reduce(
          (sum, w) => sum + (w.scans[0]?.totalViolations ?? 0),
          0,
        );
        const criticalIssues = websites.reduce(
          (sum, w) => sum + (w.scans[0]?.criticalCount ?? 0),
          0,
        );

        // Build summary lines for each website
        const siteLines = websites
          .filter((w) => w.currentScore !== null)
          .map((w) => `  - ${w.name}: ${w.currentScore}/100`)
          .join("\n");

        const title = `Weekly digest for ${org.name}`;
        const message = `${scansThisWeek} scans completed this week. ${totalIssues} total issues (${criticalIssues} critical).`;

        // In-app notification
        await createNotifications({
          organizationId: org.id,
          type: "WEEKLY_DIGEST",
          title,
          message,
          link: "/dashboard",
        });

        // Email
        const recipients = await getEmailRecipients(org.id, "WEEKLY_DIGEST");
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey || recipients.length === 0) return;

        const { Resend } = await import("resend");
        const resend = new Resend(resendApiKey);
        const baseUrl = process.env.AUTH_URL ?? "https://app.accesskit.io";

        const body = [
          `Here's your weekly accessibility summary:`,
          ``,
          `Scans completed: ${scansThisWeek}`,
          `Total issues found: ${totalIssues}`,
          `Critical issues: ${criticalIssues}`,
          ``,
          siteLines ? `Website scores:\n${siteLines}` : "",
          ``,
          `View dashboard: ${baseUrl}/dashboard`,
          ``,
          `— The AccessKit Team`,
        ]
          .filter(Boolean)
          .join("\n");

        for (const r of recipients) {
          await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
            to: r.email,
            subject: `AccessKit Weekly Digest — ${org.name}`,
            text: `Hi ${r.name ?? "there"},\n\n${body}`,
          });
          sent++;
        }
      });
    }

    return { orgs: orgs.length, emailsSent: sent };
  },
);
