import { db } from "../src/lib/db";

(async () => {
  const websites = await db.website.findMany({
    select: { id: true, name: true, url: true, verified: true, createdAt: true, lastScanAt: true, currentScore: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(websites, null, 2));
  await db.$disconnect();
})();
