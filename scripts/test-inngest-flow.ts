/**
 * End-to-end test of the Inngest scan flow.
 * Requires: pnpm dev + pnpm inngest:dev both running.
 *
 * Usage: npx tsx scripts/test-inngest-flow.ts
 */
import { db } from "../src/lib/db";
import { inngest } from "../src/inngest/client";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 120_000; // 2 minutes

(async () => {
  // Find a verified website
  const website = await db.website.findFirst({
    where: { verified: true },
    select: { id: true, url: true, standards: true, organizationId: true },
  });

  if (!website) {
    console.error("No verified website found. Add + verify a website first.");
    await db.$disconnect();
    process.exit(1);
  }

  console.log(`Testing scan on: ${website.url}`);

  // Create a scan record
  const scan = await db.scan.create({
    data: { websiteId: website.id, status: "QUEUED", pageLimit: 5, triggeredBy: "MANUAL" },
  });
  console.log(`Created scan ${scan.id} — QUEUED`);

  // Send event to Inngest (dev server at localhost:8288)
  await inngest.send({
    name: "scan/website.requested",
    data: {
      scanId: scan.id,
      websiteId: website.id,
      organizationId: website.organizationId,
      websiteUrl: website.url,
      pageLimit: 5,
      standards: website.standards,
    },
  });
  console.log("Event sent to Inngest dev server");

  // Poll until COMPLETED/FAILED/CANCELLED or timeout
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const current = await db.scan.findUnique({
      where: { id: scan.id },
      select: { status: true, totalViolations: true, pagesScanned: true, errorMessage: true },
    });
    console.log(`  status: ${current?.status}`);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(current?.status ?? "")) {
      if (current?.status === "COMPLETED") {
        console.log(`\nSUCCESS — pages: ${current.pagesScanned}, violations: ${current.totalViolations}`);
      } else {
        console.error(`\nFAILED — ${current?.errorMessage}`);
      }
      break;
    }
  }

  await db.$disconnect();
})();
