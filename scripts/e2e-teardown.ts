/**
 * Removes the disposable E2E fixtures created by `e2e-setup.ts` and any orders
 * the E2E run created for them. It only ever touches rows carrying the `E2E6A`
 * marker (order numbers, tailor codes, product slugs), never seeded or real data.
 *
 * Ordering matters: settlements pin their order items with a Restrict FK, so
 * they are removed (with their expenses) before the orders.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MARK = process.env.E2E_MARK ?? 'E2E6A';

async function main() {
  const tailors = await prisma.tailor.findMany({
    where: { code: { startsWith: MARK } },
    select: { id: true },
  });
  const tailorIds = tailors.map((t) => t.id);

  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: MARK } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  const settlements = await prisma.tailorSettlement.findMany({
    where: { items: { some: { orderItem: { orderId: { in: orderIds } } } } },
    select: { id: true, expenseId: true },
  });
  const settlementIds = settlements.map((s) => s.id);
  const expenseIds = settlements.map((s) => s.expenseId).filter((id): id is string => Boolean(id));

  await prisma.tailorSettlement.deleteMany({ where: { id: { in: settlementIds } } });
  if (expenseIds.length) await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  if (tailorIds.length) {
    await prisma.tailorNotification.deleteMany({ where: { tailorId: { in: tailorIds } } });
    await prisma.tailor.deleteMany({ where: { id: { in: tailorIds } } });
  }
  await prisma.product.deleteMany({ where: { slug: { startsWith: MARK.toLowerCase() } } });

  console.log(
    JSON.stringify({ removed: { settlements: settlementIds.length, orders: orderIds.length, tailors: tailorIds.length } }, null, 2),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
