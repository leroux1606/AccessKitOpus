import { db } from "../src/lib/db";

const scanId = process.argv[2];
if (!scanId) throw new Error("Usage: inspect-scan.ts <scanId>");

(async () => {
  const scan = await db.scan.findUnique({
    where: { id: scanId },
    include: {
      pages: { select: { id: true, url: true, violationCount: true } },
      _count: { select: { violations: true } },
    },
  });
  console.log(JSON.stringify(scan, null, 2));
  await db.$disconnect();
})();
