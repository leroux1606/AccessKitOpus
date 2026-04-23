import { db } from "../src/lib/db";

(async () => {
  // Show violations from the most recent COMPLETED scan
  const scan = await db.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    include: {
      pages: {
        include: { violations: { take: 5 } },
      },
    },
  });

  if (!scan) {
    console.log("No completed scans found.");
    await db.$disconnect();
    return;
  }

  console.log(`Scan: ${scan.id}`);
  console.log(`Status: ${scan.status}`);
  console.log(`Pages scanned: ${scan.pagesScanned}`);
  console.log(`Total violations: ${scan.totalViolations}`);
  console.log(`Score: ${scan.score}`);

  for (const page of scan.pages) {
    console.log(`\n  Page: ${page.url}`);
    console.log(`  Violation count: ${page.violationCount}`);
    for (const v of page.violations) {
      console.log(`    - [${v.severity}] ${v.ruleId}: ${v.description}`);
    }
  }

  await db.$disconnect();
})();
