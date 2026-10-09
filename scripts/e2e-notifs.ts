import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const tailorId = process.argv[2];
  const rows = await p.tailorNotification.findMany({
    where: { tailorId },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`tailor ${tailorId} -> ${rows.length} notifications`);
  for (const r of rows) console.log(JSON.stringify({ id: r.id, eventKey: r.eventKey, titleEn: r.titleEn, readAt: r.readAt, href: r.href }));
}
main().finally(() => p.$disconnect());
