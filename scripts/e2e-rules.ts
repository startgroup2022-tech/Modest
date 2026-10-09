import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const rules = await p.notificationRule.findMany({
    select: { eventKey: true, targetType: true, isActive: true, priority: true },
    orderBy: { eventKey: 'asc' },
  });
  console.log(JSON.stringify(rules, null, 2));
}
main().finally(() => p.$disconnect());
