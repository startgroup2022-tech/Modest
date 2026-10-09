/**
 * Disposable E2E fixture setup for Phase 6A acceptance verification.
 *
 * Creates isolated test tailors, credentials and one delivered/paid order, and
 * prints the ids and the one-time temporary passwords so the browser E2E can
 * sign in. Everything it creates is tagged and removed by `e2e-teardown.ts`.
 *
 * This script must never touch seeded/production rows; it only creates new ones
 * whose names carry the `E2E6A` marker.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const MARK = process.env.E2E_MARK ?? 'E2E6A';
const suffix = `${Date.now()}`;

function tempPassword() {
  // 12 chars, letter+digit, matching the portal password policy.
  const raw = randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
  return `${raw.slice(0, 10)}a1`;
}

async function main() {
  const passwordA = tempPassword();
  const passwordB = tempPassword();

  const tailorA = await prisma.tailor.create({
    data: {
      nameEn: `${MARK} Tailor A`,
      nameAr: `${MARK} خياط أ`,
      code: `${MARK}-A-${suffix}`,
      status: 'ACTIVE',
      capacity: 10,
      rateBhd: 0,
      credential: {
        create: {
          username: `${MARK.toLowerCase()}-a-${suffix}`,
          passwordHash: await bcrypt.hash(passwordA, 10),
          isActive: true,
          mustChangePassword: true,
        },
      },
    },
    include: { credential: true },
  });

  const tailorB = await prisma.tailor.create({
    data: {
      nameEn: `${MARK} Tailor B`,
      nameAr: `${MARK} خياط ب`,
      code: `${MARK}-B-${suffix}`,
      status: 'ACTIVE',
      capacity: 10,
      rateBhd: 0,
      credential: {
        create: {
          username: `${MARK.toLowerCase()}-b-${suffix}`,
          passwordHash: await bcrypt.hash(passwordB, 10),
          isActive: true,
          mustChangePassword: false,
        },
      },
    },
    include: { credential: true },
  });

  // A delivered, fully paid order with one custom-measured piece.
  const order = await prisma.order.create({
    data: {
      orderNumber: `${MARK}-ORD-${suffix}`,
      email: `${MARK.toLowerCase()}-${suffix}@example.com`,
      phone: '+97333000000',
      shippingName: `${MARK} Customer`,
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: 'E2E address',
      status: 'DELIVERED',
      subtotalBhd: 120,
      totalBhd: 120,
      deliveredAt: new Date(),
      items: {
        create: [
          {
            productName: `${MARK} Custom Abaya`,
            variantLabel: 'M / Black',
            sku: `${MARK}-SKU-${suffix}`,
            unitPriceBhd: 120,
            quantity: 1,
            lineTotalBhd: 120,
            measurementKind: 'CUSTOM',
            measurementSnapshot: {
              kind: 'CUSTOM',
              unit: 'inch',
              cutCode: null,
              cutNameEn: 'Standard',
              cutNameAr: 'قياسي',
              values: { shoulder: 15, length: 58 },
              fieldLabels: {
                shoulder: { en: 'Shoulder', ar: 'الكتف' },
                length: { en: 'Length', ar: 'الطول' },
              },
            },
          },
        ],
      },
      payments: {
        create: {
          method: 'BANK_TRANSFER',
          provider: 'bank_transfer',
          status: 'PAID',
          amountBhd: 120,
          currencyCode: 'BHD',
          paidAt: new Date(),
        },
      },
    },
    include: { items: true },
  });

  const out = {
    mark: MARK,
    suffix,
    tailorAId: tailorA.id,
    tailorBId: tailorB.id,
    tailorAUsername: tailorA.credential!.username,
    tailorBUsername: tailorB.credential!.username,
    tailorAPassword: passwordA,
    tailorBPassword: passwordB,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderItemId: order.items[0].id,
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
