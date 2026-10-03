import 'server-only';
import { cache } from 'react';
import { prisma } from './prisma';

/** Order history for a signed-in customer, newest first. */
export const getMyOrders = cache(async (customerId: string) => {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
});

/** A single order, scoped to the customer so one account can never read another's. */
export const getMyOrder = cache(async (customerId: string, orderNumber: string) => {
  return prisma.order.findFirst({
    where: { customerId, orderNumber },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'desc' } },
      refunds: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
});

export const getMyAddresses = cache(async (customerId: string) => {
  return prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
});

export const getMyMeasurement = cache(async (customerId: string) => {
  return prisma.measurement.findFirst({
    where: { customerId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
});

export const getMyNotifications = cache(async (customerId: string) => {
  return prisma.notification.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
});

export const getMyWishlistProducts = cache(async (customerId: string) => {
  const rows = await prisma.wishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        include: {
          media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 2 },
          variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          categories: { include: { category: true } },
          collections: { include: { collection: true } },
        },
      },
    },
  });
  return rows.map((r) => r.product).filter((p) => p.status === 'ACTIVE');
});

/** Aggregate figures for the account overview. */
export const getAccountStats = cache(async (customerId: string) => {
  const [orders, total] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.aggregate({
      where: { customerId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { totalBhd: true },
    }),
  ]);
  return { orderCount: orders, totalSpentBhd: Number(total._sum.totalBhd ?? 0) };
});
