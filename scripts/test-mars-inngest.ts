// End-to-end: trigger a scan of the Mars Demo website through Inngest dev
// server and watch the status in DB. Requires `pnpm dev` + `pnpm inngest:dev`
// running.

import { db } from "../src/lib/db";
import { inngest } from "../src/inngest/client";

const WEBSITE_ID = "cmobxbpl50006le4whx6ko5ck"; // Test Demo Mars
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 10 * 60_000; // 10 min

(async () => {
  const website = await db.website.findUnique({
    where: { id: WEBSITE_ID },
    select: { id: true, url: true, standards: true, organizationId: true, verified: true },
  });
  if (!website) throw new Error("Mars website not found");
  if (!website.verified) throw new Error("Mars website not verified");

  console.log(`Testing scan on: ${website.url}`);

  const scan = await db.scan.create({
    data: { websiteId: website.id, status: "QUEUED", pageLimit: 10, triggeredBy: "MANUAL" },
  });
  console.log(`Created scan ${scan.id} — QUEUED\n`);

  await inngest.send({
    name: "scan/website.requested",
    data: {
      scanId: scan.id,
      websiteId: website.id,
      organizationId: website.organizationId,
      websiteUrl: website.url,
      pageLimit: 10,
      standards: website.standards,
    },
  });
  console.log("Event sent to Inngest dev server\n");

  const start = Date.now();
  const deadline = start + TIMEOUT_MS;
  let last = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const current = await db.scan.findUnique({
      where: { id: scan.id },
      select: {
        status: true,
        totalViolations: true,
        pagesScanned: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
    });
    const s = current?.status ?? "?";
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    if (s !== last) {
      console.log(`  [${elapsed}s] status: ${s}`);
      last = s;
    }
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(s)) {
      console.log("\n=== FINAL ===");
      console.log(JSON.stringify(current, null, 2));
      break;
    }
  }

  await db.$disconnect();
})();
