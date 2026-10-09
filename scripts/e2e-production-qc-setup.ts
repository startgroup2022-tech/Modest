/**
 * Disposable E2E fixture setup for Phase 6B acceptance verification.
 *
 * Creates an isolated tailor plus a paid order whose single custom piece has a
 * production task already submitted for quality control, so the admin QC screen
 * has a real piece to inspect and the fulfillment gate has something to block.
 * Everything carries the `E2E6B` marker and is removed by `e2e-teardown.ts`
 * (`E2E_MARK=E2E6B`). Never touches seeded/production rows.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MARK = process.env.E2E_MARK ?? 'E2E6B';
const suffix = `${Date.now()}`;

async function main() {
  const tailor = await prisma.tailor.create({
    data: {
      nameEn: `${MARK} Tailor`,
      nameAr: `${MARK} خياط`,
      code: `${MARK}-T-${suffix}`,
      status: 'ACTIVE',
      capacity: 10,
      rateBhd: 0,
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `${MARK}-ORD-${suffix}`,
      email: `${MARK.toLowerCase()}-${suffix}@example.com`,
      phone: '+97333000000',
      shippingName: `${MARK} Customer`,
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: 'E2E address',
      status: 'IN_PRODUCTION',
      subtotalBhd: 90,
      totalBhd: 90,
      payments: {
        create: { method: 'BANK_TRANSFER', provider: 'bank_transfer', status: 'PAID', amountBhd: 90, currencyCode: 'BHD', paidAt: new Date() },
      },
      items: {
        create: [
          {
            productName: `${MARK} Abaya`,
            unitPriceBhd: 90,
            quantity: 1,
            lineTotalBhd: 90,
            measurementKind: 'CUSTOM',
            measurementSnapshot: { kind: 'CUSTOM', unit: 'inch', values: { length: 58 } },
            assignedTailorId: tailor.id,
            tailorFeeBhd: 10,
          },
        ],
      },
    },
    include: { items: true },
  });

  const task = await prisma.productionTask.create({
    data: {
      code: `${MARK}-PRD-${suffix}`,
      orderId: order.id,
      orderItemId: order.items[0].id,
      tailorId: tailor.id,
      titleEn: `${MARK} Abaya`,
      status: 'SUBMITTED_FOR_QC',
      feeBhd: 10,
    },
  });

  console.log(
    JSON.stringify(
      { taskId: task.id, taskCode: task.code, orderId: order.id, orderNumber: order.orderNumber, tailorId: tailor.id },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
