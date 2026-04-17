import { inngest } from "./client";
import { db } from "@/lib/db";
import { runScan } from "@/scanner";
import { generateAiFixSuggestion } from "@/lib/ai";
import { getPlanLimits } from "@/lib/plans";
import type { ScanEventData } from "@/types/scan";

/** How many issues to AI-annotate per scan (cap cost + latency). */
const AI_FIX_MAX_PER_SCAN = 15;
/** Concurrent Anthropic calls — keep low to respect rate limits. */
const AI_FIX_CONCURRENCY = 3;

export const scanWebsiteJob = inngest.createFunction(
  {
    id: "scan-website",
    name: "Scan Website",
    triggers: [{ event: "scan/website.requested" }],
    concurrency: { limit: 3 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { scanId, websiteId, websiteUrl, pageLimit, standards } = event.data as ScanEventData;

    // Step 1: Mark scan as RUNNING (skip if already in a terminal state to
    // avoid overwriting a COMPLETED or FAILED result on Inngest retry)
    await step.run("mark-running", async () => {
      const current = await db.scan.findUnique({
        where: { id: scanId },
        select: { status: true },
      });
      if (current?.status === "COMPLETED" || current?.status === "FAILED") return;
      await db.scan.update({
        where: { id: scanId },
        data: { status: "RUNNING", startedAt: new Date() },
      });
    });

    // Step 2: Run the full scan (crawl + axe-core)
    const result = await step.run("run-scan", async () => {
      try {
        return await runScan(websiteUrl, pageLimit, standards, { scanId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.scan.update({
          where: { id: scanId },
          data: {
            status: "FAILED",
            errorMessage: message,
            completedAt: new Date(),
          },
        });
        throw err;
      }
    });

    // Step 3: Persist results to DB
    //
    // Idempotency: Inngest can retry this step after a partial commit, or the
    // whole function can be re-delivered. To avoid creating duplicate Page /
    // Violation rows for the same scan, we first delete any rows already
    // associated with `scanId` inside the same transaction. This makes the
    // step safe to retry — the final state is the same whether it runs once
    // or three times.
    await step.run("save-results", async () => {
      const now = new Date();

      await db.$transaction(async (tx) => {
        // Wipe any partial results from a previous attempt for this scan.
        // Violations first (they FK to Page); then Pages.
        await tx.violation.deleteMany({ where: { scanId } });
        await tx.page.deleteMany({ where: { scanId } });

        // Pre-fetch all known violation fingerprints for this website in one
        // query to avoid an N+1 lookup inside the per-violation loop.
        const existingViolations = await tx.violation.findMany({
          where: { websiteId },
          select: {
            fingerprint: true,
            firstDetectedAt: true,
            status: true,
            assignedToId: true,
          },
          orderBy: { firstDetectedAt: "asc" },
          distinct: ["fingerprint"],
        });
        const existingByFingerprint = new Map(
          existingViolations.map((ev) => [ev.fingerprint, ev]),
        );

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
            // Carry forward firstDetectedAt and workflow state from previous scan
            const existing = existingByFingerprint.get(v.fingerprint);

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
                firstDetectedAt: existing?.firstDetectedAt ?? now,
                status: existing?.status ?? "OPEN",
                assignedToId: existing?.assignedToId ?? null,
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
          data: {
            currentScore: result.score,
            lastScanAt: now,
          },
        });

        // Auto-verify issues that are no longer found in this scan.
        // Find all open/in-progress violations for this website whose fingerprint
        // is absent from the current scan's results — they've been fixed.
        const newFingerprints = new Set(
          result.pages.flatMap((p) => p.violations.map((v) => v.fingerprint))
        );

        await tx.violation.updateMany({
          where: {
            websiteId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            NOT: { fingerprint: { in: [...newFingerprints] } },
          },
          data: {
            status: "VERIFIED",
            verifiedAt: now,
            resolvedAt: now,
          },
        });
      });
    });

    // Step 4: Generate AI fix suggestions for CRITICAL/SERIOUS issues on
    // plans that include `hasAiFixes`. Lazy per-view generation is still
    // available as a fallback (see the issue detail page), but generating
    // up front here makes reports/PDFs/API responses immediately rich,
    // and avoids a per-user-view cold-path Anthropic call. Capped to
    // AI_FIX_MAX_PER_SCAN new violations per scan to bound cost.
    await step.run("generate-ai-fixes", async () => {
      const scan = await db.scan.findUnique({
        where: { id: scanId },
        select: { website: { select: { organization: { select: { plan: true } } } } },
      });
      const plan = scan?.website?.organization?.plan;
      if (!plan) return;
      if (!getPlanLimits(plan).hasAiFixes) return;
      if (!process.env.ANTHROPIC_API_KEY) return;

      const targets = await db.violation.findMany({
        where: {
          scanId,
          severity: { in: ["CRITICAL", "SERIOUS"] },
          aiFixSuggestion: null,
        },
        orderBy: [{ severity: "asc" }, { firstDetectedAt: "desc" }],
        take: AI_FIX_MAX_PER_SCAN,
        select: {
          id: true,
          ruleId: true,
          description: true,
          htmlElement: true,
          helpText: true,
          fixSuggestion: true,
        },
      });

      for (let i = 0; i < targets.length; i += AI_FIX_CONCURRENCY) {
        const batch = targets.slice(i, i + AI_FIX_CONCURRENCY);
        await Promise.all(
          batch.map(async (v) => {
            const suggestion = await generateAiFixSuggestion({
              ruleId: v.ruleId,
              description: v.description,
              htmlElement: v.htmlElement ?? "",
              helpText: v.helpText ?? "",
              templateFix: v.fixSuggestion ?? undefined,
            });
            if (!suggestion) return;
            await db.violation.update({
              where: { id: v.id },
              data: { aiFixSuggestion: suggestion },
            });
          }),
        );
      }
    });

    // Step 5: Fire scan/completed event for notification handlers
    await step.run("fire-completed-event", async () => {
      await inngest.send({
        name: "scan/completed",
        data: { scanId },
      });
    });

    return {
      scanId,
      score: result.score,
      totalViolations: result.totalViolations,
      pagesScanned: result.pages.length,
    };
  },
);
