import { db } from "../src/lib/db";

(async () => {
  const result = await db.scan.updateMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    data: {
      status: "FAILED",
      errorMessage: "Reclaimed: stuck scan cleared by manual cleanup",
      completedAt: new Date(),
    },
  });
  console.log(`Reclaimed ${result.count} stuck scan(s).`);
  await db.$disconnect();
})();
