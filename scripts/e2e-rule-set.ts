import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const [cmd, eventKey, target, active] = process.argv.slice(2);
  if (cmd === 'set') {
    const existing = await p.notificationRule.findFirst({ where: { eventKey, targetType: target as never } });
    if (existing) {
      await p.notificationRule.update({ where: { id: existing.id }, data: { isActive: active === 'true' } });
    } else {
      await p.notificationRule.create({ data: { eventKey, nameEn: eventKey, nameAr: eventKey, targetType: target as never, isActive: active === 'true' } });
    }
    console.log('set', eventKey, target, active);
  } else if (cmd === 'list') {
    const rows = await p.notificationRule.findMany();
    console.log(JSON.stringify(rows, null, 2));
  } else if (cmd === 'del') {
    await p.notificationRule.deleteMany({ where: { eventKey, targetType: target as never } });
    console.log('deleted');
  }
}
main().finally(() => p.$disconnect());
