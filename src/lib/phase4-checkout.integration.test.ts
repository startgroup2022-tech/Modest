import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { evaluateCoupon, toCouponRow, type CouponLine } from '@/lib/coupons';
import { getQualifyingCount, recomputeCustomerMembership } from '@/lib/membership-db';
import { computeMembershipProgress } from '@/lib/membership';
import { applyPaymentResult } from '@/lib/orders';
import { hashGuestEmail } from '@/lib/tokens';

/**
 * Database-backed integration tests for the Phase 4 checkout / customer /
 * membership domain. They run against the real Prisma/MySQL schema — no mocks —
 * and are skipped unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let suffix: string;
let customerId: string;
let userId: string;

const createdOrderIds: string[] = [];
const createdCouponIds: string[] = [];
const createdTierIds: string[] = [];

function line(productId: string, price: number, qty = 1, categoryIds: string[] = []): CouponLine {
  return { productId, categoryIds, collectionIds: [], unitPriceBhd: price, quantity: qty };
}

/** Creates a paid/refunded order with one piece for membership tests. */
async function makeOrder(opts: {
  totalBhd: number;
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED';
  orderStatus?: 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';
  quantity?: number;
  /** Adds a completed Refund row so the order reads as fully refunded. */
  refunded?: boolean;
}) {
  const refunded = opts.refunded ?? (opts.orderStatus === 'REFUNDED' || opts.paymentStatus === 'REFUNDED');
  const order = await prisma.order.create({
    data: {
      orderNumber: `IT4-${suffix}-${createdOrderIds.length}`,
      customerId,
      email: `it4-${suffix}@example.com`,
      phone: '+97330000000',
      shippingName: 'IT Customer',
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: 'Test address',
      status: opts.orderStatus ?? (refunded ? 'REFUNDED' : 'CONFIRMED'),
      subtotalBhd: opts.totalBhd,
      totalBhd: opts.totalBhd,
      items: {
        create: [
          {
            productName: 'IT Abaya',
            unitPriceBhd: opts.totalBhd,
            quantity: opts.quantity ?? 1,
            lineTotalBhd: opts.totalBhd * (opts.quantity ?? 1),
          },
        ],
      },
      payments: {
        create: {
          method: 'BANK_TRANSFER',
          provider: 'bank_transfer',
          status: opts.paymentStatus,
          amountBhd: opts.totalBhd,
          currencyCode: 'BHD',
          amountPresentment: opts.totalBhd,
        },
      },
      ...(refunded
        ? {
            refunds: {
              create: { amountBhd: opts.totalBhd, method: 'BANK_TRANSFER', status: 'COMPLETED' },
            },
          }
        : {}),
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

maybe('phase 4 checkout / customer / membership (database)', () => {
  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const user = await prisma.user.create({
      data: {
        email: `it4-${suffix}@example.com`,
        passwordHash: 'x',
        firstName: 'IT',
        lastName: 'Customer',
        customer: { create: {} },
      },
      include: { customer: true },
    });
    userId = user.id;
    customerId = user.customer!.id;
  });

  afterAll(async () => {
    await prisma.couponRedemption.deleteMany({ where: { couponId: { in: createdCouponIds } } });
    await prisma.coupon.deleteMany({ where: { id: { in: createdCouponIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.membershipTier.deleteMany({ where: { id: { in: createdTierIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  async function makeCoupon(overrides: Record<string, unknown> = {}) {
    const c = await prisma.coupon.create({
      data: {
        code: `IT4-${suffix}-${createdCouponIds.length}`,
        discountType: 'PERCENTAGE',
        valueBhd: 10,
        isActive: true,
        ...overrides,
      },
    });
    createdCouponIds.push(c.id);
    return toCouponRow(c);
  }

  describe('coupon engine', () => {
    const ctx = { customerId: null, guestEmailHash: null, membershipCount: null, currencyCode: 'BHD' };

    it('applies a percentage discount to the eligible subtotal', async () => {
      const coupon = await makeCoupon({ discountType: 'PERCENTAGE', valueBhd: 10 });
      const result = await evaluateCoupon(coupon, [line('p1', 100, 2)], ctx);
      expect(result.ok).toBe(true);
      expect(result.discountBhd).toBe(20);
    });

    it('caps a percentage discount at maxDiscountBhd', async () => {
      const coupon = await makeCoupon({ discountType: 'PERCENTAGE', valueBhd: 50, maxDiscountBhd: 15 });
      const result = await evaluateCoupon(coupon, [line('p1', 100)], ctx);
      expect(result.discountBhd).toBe(15);
    });

    it('rejects a fixed coupon below its minimum order', async () => {
      const coupon = await makeCoupon({ discountType: 'FIXED', valueBhd: 5, minOrderBhd: 40 });
      const result = await evaluateCoupon(coupon, [line('p1', 20)], ctx);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('MIN_ORDER');
    });

    it('restricts a coupon to matching categories only', async () => {
      const coupon = await makeCoupon({ categoryIds: ['cat-a'], discountType: 'PERCENTAGE', valueBhd: 10 });
      const result = await evaluateCoupon(
        coupon,
        [line('p1', 100, 1, ['cat-a']), line('p2', 100, 1, ['cat-b'])],
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.eligibleSubtotalBhd).toBe(100);
      expect(result.discountBhd).toBe(10);
    });

    it('rejects when no cart line is in scope', async () => {
      const coupon = await makeCoupon({ productIds: ['nope'], discountType: 'PERCENTAGE', valueBhd: 10 });
      const result = await evaluateCoupon(coupon, [line('p1', 100)], ctx);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('NO_ELIGIBLE_ITEMS');
    });

    it('enforces a global usage limit', async () => {
      const coupon = await makeCoupon({ usageLimit: 1, usedCount: 1, discountType: 'FIXED', valueBhd: 5 });
      const result = await evaluateCoupon(coupon, [line('p1', 100)], ctx);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('USAGE_LIMIT');
    });

    it('enforces a per-customer limit against recorded redemptions', async () => {
      const coupon = await makeCoupon({ perCustomerLimit: 1, discountType: 'FIXED', valueBhd: 5 });
      await prisma.couponRedemption.create({
        data: { couponId: coupon.id, customerId, amountBhd: 5 },
      });
      const result = await evaluateCoupon(coupon, [line('p1', 100)], { ...ctx, customerId });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('PER_CUSTOMER_LIMIT');
    });

    it('enforces a per-guest limit against the hashed email', async () => {
      const coupon = await makeCoupon({ perCustomerLimit: 1, discountType: 'FIXED', valueBhd: 5 });
      const guestEmailHash = hashGuestEmail(`guest-${suffix}@example.com`);
      await prisma.couponRedemption.create({
        data: { couponId: coupon.id, guestEmailHash, amountBhd: 5 },
      });
      const result = await evaluateCoupon(coupon, [line('p1', 100)], { ...ctx, guestEmailHash });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('PER_CUSTOMER_LIMIT');
    });

    it('requires a server-computed membership count for targeted codes', async () => {
      const coupon = await makeCoupon({ minQualifyingPieces: 5, discountType: 'PERCENTAGE', valueBhd: 10 });
      const denied = await evaluateCoupon(coupon, [line('p1', 100)], { ...ctx, customerId, membershipCount: 3 });
      expect(denied.reason).toBe('MIN_MEMBERSHIP');
      const allowed = await evaluateCoupon(coupon, [line('p1', 100)], { ...ctx, customerId, membershipCount: 5 });
      expect(allowed.ok).toBe(true);
    });

    it('rejects an inactive or expired coupon', async () => {
      const inactive = await makeCoupon({ isActive: false });
      expect((await evaluateCoupon(inactive, [line('p1', 100)], ctx)).reason).toBe('INACTIVE');
      const expired = await makeCoupon({ expiresAt: new Date(Date.now() - 86_400_000) });
      expect((await evaluateCoupon(expired, [line('p1', 100)], ctx)).reason).toBe('EXPIRED');
    });
  });

  describe('membership derivation', () => {
    it('counts only pieces from settled, non-refunded orders', async () => {
      const paid = await makeOrder({ totalBhd: 50, paymentStatus: 'PAID', quantity: 2 });
      const pending = await makeOrder({ totalBhd: 50, paymentStatus: 'PENDING', quantity: 3 });
      const cancelled = await makeOrder({ totalBhd: 50, paymentStatus: 'PAID', orderStatus: 'CANCELLED', quantity: 4 });
      const refunded = await makeOrder({ totalBhd: 50, paymentStatus: 'REFUNDED', orderStatus: 'REFUNDED', quantity: 5 });

      const count = await getQualifyingCount(customerId);
      // Only the paid order's two pieces qualify.
      expect(count).toBe(2);

      // A fully refunded order contributes zero pieces.
      const fullyRefunded = await makeOrder({ totalBhd: 50, paymentStatus: 'REFUNDED', quantity: 6 });
      expect(await getQualifyingCount(customerId)).toBe(2);

      // Suppress unused-variable lint noise for the fixture orders.
      expect([paid, pending, cancelled, refunded, fullyRefunded].every((o) => o.id)).toBe(true);
    });

    it('resolves the tier from real thresholds and caches the pointer', async () => {
      const gold = await prisma.membershipTier.create({
        data: { code: `IT4-GOLD-${suffix}`, nameEn: 'IT Gold', nameAr: 'ذهبي', minQualifying: 1, sortOrder: 1 },
      });
      createdTierIds.push(gold.id);

      const membership = await recomputeCustomerMembership(customerId);
      expect(membership.tier?.id).toBe(gold.id);
      expect(membership.qualifyingCount).toBeGreaterThanOrEqual(1);

      const cached = await prisma.customer.findUnique({ where: { id: customerId }, select: { membershipTierId: true } });
      expect(cached?.membershipTierId).toBe(gold.id);
    });

    it('computes progress toward the next tier purely', () => {
      const tiers = [
        { id: 'a', code: 'A', nameEn: 'A', nameAr: 'A', minQualifying: 0, isActive: true, sortOrder: 1 },
        { id: 'b', code: 'B', nameEn: 'B', nameAr: 'B', minQualifying: 10, isActive: true, sortOrder: 2 },
      ];
      const progress = computeMembershipProgress(5, tiers);
      expect(progress.tier?.code).toBe('A');
      expect(progress.nextTier?.code).toBe('B');
      expect(progress.toNext).toBe(5);
      expect(progress.percent).toBe(50);
    });

    it('drops a customer back when an order is fully refunded', async () => {
      const countBefore = await getQualifyingCount(customerId);

      // Create a fresh paid order, then fully refund it via a Refund row.
      const order = await makeOrder({ totalBhd: 30, paymentStatus: 'PAID', quantity: 1 });
      expect(await getQualifyingCount(customerId)).toBe(countBefore + 1);

      await prisma.refund.create({
        data: { orderId: order.id, amountBhd: 30, method: 'BANK_TRANSFER', status: 'COMPLETED' },
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
      expect(await getQualifyingCount(customerId)).toBe(countBefore);
    });
  });

  describe('verified payment callback', () => {
    it('rejects an unverified callback outright', async () => {
      const order = await makeOrder({ totalBhd: 20, paymentStatus: 'PENDING' });
      await expect(
        applyPaymentResult({ orderId: order.id, status: 'PAID', signatureVerified: false }),
      ).rejects.toThrow(/Unverified/);
    });

    it('settles the order, notifies the customer and recomputes membership', async () => {
      const order = await makeOrder({ totalBhd: 25, paymentStatus: 'PENDING', quantity: 1 });
      await prisma.notification.deleteMany({ where: { customerId } });

      const payment = await applyPaymentResult({
        orderId: order.id,
        status: 'PAID',
        signatureVerified: true,
        providerRef: `it4-ref-${suffix}`,
      });
      expect(payment.status).toBe('PAID');

      const settled = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
      expect(settled?.status).toBe('CONFIRMED');

      const notes = await prisma.notification.findMany({ where: { customerId } });
      expect(notes.length).toBe(1);
      expect(notes[0].titleEn).toBe('Order confirmed');
      // Locale-less href so the notifications page can prefix the active locale.
      expect(notes[0].href?.startsWith('/account/orders/')).toBe(true);

      // The paid piece now qualifies.
      expect(await getQualifyingCount(customerId)).toBeGreaterThanOrEqual(1);
    });

    it('is idempotent — a replayed PAID callback does not double-notify', async () => {
      const order = await makeOrder({ totalBhd: 25, paymentStatus: 'PENDING', quantity: 1 });
      await prisma.notification.deleteMany({ where: { customerId } });

      await applyPaymentResult({ orderId: order.id, status: 'PAID', signatureVerified: true });
      await applyPaymentResult({ orderId: order.id, status: 'PAID', signatureVerified: true });

      const notes = await prisma.notification.findMany({ where: { customerId } });
      expect(notes.length).toBe(1);
    });
  });
});
