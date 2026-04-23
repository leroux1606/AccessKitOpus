import { db } from "../src/lib/db";

(async () => {
  const stuck = await db.scan.findMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      websiteId: true,
      errorMessage: true,
    },
    take: 20,
  });
  console.log(`STUCK SCANS: ${stuck.length}`);
  console.log(JSON.stringify(stuck, null, 2));

  const recent = await db.scan.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, completedAt: true, errorMessage: true },
    take: 10,
  });
  console.log(`\nLAST 10 SCANS:`);
  console.log(JSON.stringify(recent, null, 2));

  await db.$disconnect();
})();
