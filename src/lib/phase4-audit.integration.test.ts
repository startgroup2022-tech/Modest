import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as tappWebhook } from '@/app/api/webhooks/tapp/route';
import { createOrder, applyPaymentResult, resolveCartLines } from '@/lib/orders';
import { transitionOrder, createRefund } from '@/lib/admin/orders';
import { assignTailorToItem } from '@/lib/assignments';
import { assertOrderSettledForProduction, isOrderSettled } from '@/lib/production-gate';
import { toCustomerTimeline } from '@/lib/order-status';
import type { AdminUser } from '@/lib/admin-auth';
import type { CheckoutInput } from '@/lib/validation';
import type { Permission } from '@/lib/permission-defs';

/**
 * Phase 4 audit regression tests. These pin the defects found during the final
 * audit of checkout, payments, refunds and the payment-before-production gate.
 * They run against the real Prisma/MySQL schema (no mocks) and are skipped
 * unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let suffix: string;
const createdOrderIds: string[] = [];
const createdCouponIds: string[] = [];
const createdProductIds: string[] = [];
const createdTailorIds: string[] = [];
let variantId: string;
let admin: AdminUser;
let priorTappValue: unknown = null;
const WEBHOOK_SECRET = 'it4a-webhook-secret';

function sign(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function webhookRequest(body: string, signature: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/tapp', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'x-tapp-signature': signature },
  });
}

function adminFixture(id: string): AdminUser {
  return {
    id,
    email: 'audit@example.com',
    firstName: 'Audit',
    lastName: 'Admin',
    phone: null,
    role: 'ADMIN',
    customerId: null,
    locale: 'en',
    sessionKind: undefined,
    permissions: new Set<Permission>(['payments.verify', 'orders.assign', 'production.manage', 'orders.edit']),
  };
}

function checkout(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    fullName: 'Audit Buyer',
    email: `audit-${suffix}@example.com`,
    phone: '+97330000000',
    country: 'Bahrain',
    city: 'Manama',
    area: '',
    address: '1 Audit Road',
    building: '',
    unit: '',
    notes: '',
    paymentMethod: 'BANK_TRANSFER',
    shippingMethodCode: '',
    couponCode: '',
    acceptsTerms: true,
    ...overrides,
  };
}

async function makeOrder(opts: { totalBhd: number; paymentStatus: 'PAID' | 'PENDING'; status?: 'CONFIRMED' | 'PREPARING' }) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `IT4A-${suffix}-${createdOrderIds.length}`,
      email: `audit-${suffix}@example.com`,
      phone: '+97330000000',
      shippingName: 'Audit Buyer',
      shippingCountry: 'Bahrain',
      shippingCity: 'Manama',
      shippingAddress: '1 Audit Road',
      status: opts.status ?? 'CONFIRMED',
      subtotalBhd: opts.totalBhd,
      totalBhd: opts.totalBhd,
      items: {
        create: [
          {
            productName: 'Audit Abaya',
            unitPriceBhd: opts.totalBhd,
            quantity: 1,
            lineTotalBhd: opts.totalBhd,
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
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

maybe('phase 4 audit regressions (database)', () => {
  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    // The domain functions under test take an actor id for audit/stock only —
    // authorization is enforced at the route layer. So the fixture user needs no
    // role, which also avoids perturbing `countEffectiveAdmins()` in the
    // concurrently-running phase 2 suite.
    const staff = await prisma.user.create({
      data: {
        email: `it4a-admin-${suffix}@example.com`,
        passwordHash: 'x',
        firstName: 'Audit',
        lastName: 'Admin',
      },
    });
    admin = adminFixture(staff.id);
    const priorTapp = await prisma.siteSetting.findUnique({ where: { key: 'tapp_config' } });
    priorTappValue = priorTapp?.value ?? null;
    await prisma.siteSetting.upsert({
      where: { key: 'tapp_config' },
      create: {
        key: 'tapp_config',
        value: { environment: 'sandbox', baseUrl: 'https://api.tapp.test', merchantId: 'it4a', apiKey: 'it4a-key', webhookSecret: WEBHOOK_SECRET } as never,
      },
      update: {
        value: { environment: 'sandbox', baseUrl: 'https://api.tapp.test', merchantId: 'it4a', apiKey: 'it4a-key', webhookSecret: WEBHOOK_SECRET } as never,
      },
    });
    const product = await prisma.product.create({
      data: {
        slug: `it4a-${suffix}`,
        nameEn: 'Audit Abaya',
        nameAr: 'عباية التدقيق',
        descriptionEn: 'x',
        descriptionAr: 'س',
        priceBhd: 100,
        sku: `IT4A-${suffix}`,
        status: 'ACTIVE',
        variants: {
          create: [{ size: 'M', stock: 5, stockStatus: 'IN_STOCK', isActive: true }],
        },
      },
      include: { variants: true },
    });
    createdProductIds.push(product.id);
    variantId = product.variants[0].id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.coupon.deleteMany({ where: { id: { in: createdCouponIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.tailor.deleteMany({ where: { id: { in: createdTailorIds } } });
    await prisma.user.deleteMany({ where: { id: admin.id } });
    if (priorTappValue === null) {
      await prisma.siteSetting.deleteMany({ where: { key: 'tapp_config' } });
    } else {
      await prisma.siteSetting.update({ where: { key: 'tapp_config' }, data: { value: priorTappValue as never } });
    }
    await prisma.$disconnect();
  });

  it('links the applied coupon to the order and records one redemption', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `IT4A-C-${suffix}`,
        discountType: 'PERCENTAGE',
        valueBhd: 10,
        isActive: true,
      },
    });
    createdCouponIds.push(coupon.id);

    const lines = await resolveCartLines([{ productId: createdProductIds[0], variantId, quantity: 1 }], {
      requireMeasurements: false,
    });
    const created = await createOrder({
      checkout: checkout({ couponCode: coupon.code }),
      lines,
      customerId: null,
      locale: 'ar',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: { id: coupon.id, discountType: 'PERCENTAGE', valueBhd: 10 } as never,
      idempotencyKey: `it4a-${suffix}-${coupon.id}`,
      baseUrl: 'https://example.test',
      guestEmailHash: null,
    });
    createdOrderIds.push(created.orderId);

    const order = await prisma.order.findUnique({
      where: { id: created.orderId },
      include: { redemptions: true },
    });
    // The bug: couponId was never written, so the discount could not be attributed.
    expect(order?.couponId).toBe(coupon.id);
    expect(order?.locale).toBe('ar');
    expect(order?.redemptions).toHaveLength(1);
    expect(order?.redemptions[0].couponId).toBe(coupon.id);
  });

  it('refuses to begin production for an unpaid order', async () => {
    const unpaid = await makeOrder({ totalBhd: 40, paymentStatus: 'PENDING', status: 'PREPARING' });
    expect(await isOrderSettled(unpaid.id)).toBe(false);
    await expect(assertOrderSettledForProduction(unpaid.id)).rejects.toThrow(/Payment/);

    await expect(transitionOrder(admin, { orderId: unpaid.id, to: 'IN_PRODUCTION' })).rejects.toThrow(
      /Payment must be confirmed/,
    );

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: unpaid.id } });
    const tailor = await prisma.tailor.create({
      data: { code: `IT4A-T-${suffix}`, nameEn: 'Audit Tailor', nameAr: 'خياط', status: 'ACTIVE' },
    });
    createdTailorIds.push(tailor.id);
    await expect(
      assignTailorToItem({ orderItemId: item.id, tailorId: tailor.id, suppliedFeeBhd: 5, actorId: admin.id }),
    ).rejects.toThrow(/Payment must be confirmed/);
  });

  it('allows production once a payment is captured', async () => {
    const unpaid = await makeOrder({ totalBhd: 40, paymentStatus: 'PENDING', status: 'PREPARING' });
    await applyPaymentResult({ orderId: unpaid.id, status: 'PAID', signatureVerified: true });
    expect(await isOrderSettled(unpaid.id)).toBe(true);
    await expect(transitionOrder(admin, { orderId: unpaid.id, to: 'IN_PRODUCTION' })).resolves.toBeTruthy();
  });

  it('caps a refund at the captured amount, not the discounted total', async () => {
    // Order total 100, but only 80 was ever captured (e.g. a discount).
    const order = await prisma.order.create({
      data: {
        orderNumber: `IT4A-D-${suffix}`,
        email: `audit-${suffix}@example.com`,
        phone: '+97330000000',
        shippingName: 'Audit Buyer',
        shippingCountry: 'Bahrain',
        shippingCity: 'Manama',
        shippingAddress: '1 Audit Road',
        status: 'CONFIRMED',
        subtotalBhd: 100,
        discountBhd: 20,
        totalBhd: 100,
        items: { create: [{ productName: 'Audit Abaya', unitPriceBhd: 100, quantity: 1, lineTotalBhd: 100 }] },
        payments: {
          create: {
            method: 'BANK_TRANSFER',
            provider: 'bank_transfer',
            status: 'PAID',
            amountBhd: 80,
            currencyCode: 'BHD',
            amountPresentment: 80,
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    // Refunding more than was captured is rejected.
    await expect(
      createRefund(admin, { orderId: order.id, amountBhd: 90, method: 'BANK_TRANSFER' }),
    ).rejects.toThrow(/refundable balance/);

    // Refunding exactly the captured amount is accepted and fully settles it.
    const refund = await createRefund(admin, { orderId: order.id, amountBhd: 80, method: 'BANK_TRANSFER' });
    expect(refund.amountBhd).toBeDefined();
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe('REFUNDED');
  });

  it('never leaks internal event notes on the customer timeline', () => {
    const events = [
      { status: 'PENDING', messageEn: 'Order placed', messageAr: 'تم إنشاء الطلب', createdAt: new Date('2026-01-01') },
      {
        status: 'CONFIRMED',
        messageEn: 'Internal: fraud review flag raised by staff',
        messageAr: 'داخلي',
        createdAt: new Date('2026-01-02'),
      },
      { status: 'CONFIRMED', messageEn: 'duplicate', messageAr: 'مكرر', createdAt: new Date('2026-01-03') },
    ];
    const timeline = toCustomerTimeline(events);
    expect(timeline).toHaveLength(2);
    expect(timeline.find((e) => e.status === 'CONFIRMED')?.messageEn).toBe('Order confirmed');
    expect(JSON.stringify(timeline)).not.toContain('fraud');
  });

  it('rejects a TAPP webhook with a bad signature and never marks the order paid', async () => {
    const order = await makeOrder({ totalBhd: 60, paymentStatus: 'PENDING' });
    const body = JSON.stringify({ reference: order.orderNumber, id: 'tapp-1', status: 'paid', amount: 60 });
    const res = await tappWebhook(webhookRequest(body, 'deadbeef'));
    expect(res.status).toBeGreaterThanOrEqual(400);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).not.toBe('PAID');
  });

  it('applies a correctly signed TAPP webhook for the captured amount', async () => {
    const order = await makeOrder({ totalBhd: 60, paymentStatus: 'PENDING' });
    const body = JSON.stringify({ reference: order.orderNumber, id: 'tapp-2', status: 'paid', amount: 60 });
    const res = await tappWebhook(webhookRequest(body, sign(body)));
    expect(res.status).toBe(200);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe('PAID');
  });

  it('does not settle an order when the signed webhook amount mismatches', async () => {
    const order = await makeOrder({ totalBhd: 60, paymentStatus: 'PENDING' });
    const body = JSON.stringify({ reference: order.orderNumber, id: 'tapp-3', status: 'paid', amount: 10 });
    const res = await tappWebhook(webhookRequest(body, sign(body)));
    expect(res.status).toBe(400);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).not.toBe('PAID');
  });
});
