import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { createOrder, resolveCartLines, CheckoutError } from '@/lib/orders';
import { computeTotals } from '@/lib/money';

export const dynamic = 'force-dynamic';

const schema = z.object({
  customerId: z.string().nullable().optional(),
  guest: z
    .object({
      firstName: z.string().min(1).max(120),
      lastName: z.string().max(120).optional().default(''),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().min(3).max(40),
    })
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable().optional(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1),
  shippingMethodCode: z.string().min(1),
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'BENEFIT', 'TAPP']),
  manualDiscountBhd: z.number().min(0).max(1_000_000).optional().default(0),
  notes: z.string().max(1000).optional(),
  city: z.string().max(120).optional().default('Manama'),
  country: z.string().max(120).optional().default('Bahrain'),
  address: z.string().max(300).optional().default('—'),
});

/**
 * Internal order creation for phone / WhatsApp / Instagram / walk-in sales.
 * Reuses the exact same transactional pipeline as the storefront checkout so
 * stock, accounting and payment rules are identical everywhere.
 */
export const POST = adminHandler('orders.create', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const input = parsed.data;

  const customer = input.customerId
    ? await prisma.customer.findUnique({ where: { id: input.customerId }, include: { user: true } })
    : null;
  if (input.customerId && !customer) {
    throw new AdminActionError('Customer not found', 'NOT_FOUND', 404);
  }

  const shipping = await prisma.shippingMethod.findFirst({
    where: { code: input.shippingMethodCode, isActive: true },
  });
  if (!shipping) throw new AdminActionError('Shipping method unavailable', 'INVALID', 400);

  const shippingBhd = Number(shipping.priceBhd);
  const lines = await resolveCartLines(
    input.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
  );

  const totals = computeTotals(
    lines.map((l) => ({ unitPriceBhd: l.unitPriceBhd, quantity: l.quantity })),
    null,
    shippingBhd,
  );
  // Manual staff discount is applied as an explicit override, never by
  // mutating line prices — the historical snapshot stays truthful.
  const manualDiscount = Math.min(input.manualDiscountBhd ?? 0, totals.subtotalBhd);
  const finalTotal = Math.max(0, totals.totalBhd - manualDiscount);

  const name =
    customer
      ? [customer.user?.firstName, customer.user?.lastName].filter(Boolean).join(' ') || customer.user?.email || 'Customer'
      : [input.guest?.firstName, input.guest?.lastName].filter(Boolean).join(' ');

  const created = await createOrder({
    checkout: {
      fullName: name,
      email: customer?.user?.email ?? input.guest?.email ?? 'walkin@attention-modestfashion.com',
      phone: customer?.phone ?? input.guest?.phone ?? '0000000000',
      country: input.country,
      city: input.city,
      area: '',
      address: input.address,
      building: '',
      unit: '',
      notes: input.notes ?? '',
      paymentMethod: input.paymentMethod,
      shippingMethodCode: input.shippingMethodCode,
      couponCode: '',
      acceptsTerms: true,
    },
    lines,
    customerId: customer?.id ?? null,
    locale: 'en',
    currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
    shippingBhd,
    coupon: null,
    baseUrl: process.env.APP_URL ?? 'https://attention-modestfashion.com',
  });

  // Record the manual discount and staff provenance on the order.
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: created.orderId },
      data: {
        channel: 'QUICK_ORDER',
        createdById: admin.id,
        discountBhd: manualDiscount,
        totalBhd: finalTotal,
        presentmentTotal: finalTotal,
      },
    });
    if (manualDiscount > 0) {
      await tx.orderEvent.create({
        data: {
          orderId: created.orderId,
          status: 'PENDING',
          messageEn: `Manual discount of ${manualDiscount.toFixed(3)} BHD applied by staff`,
          messageAr: `تم تطبيق خصم يدوي بقيمة ${manualDiscount.toFixed(3)} د.ب`,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: 'order.quick_create',
        entity: 'Order',
        entityId: created.orderId,
        metadata: { total: finalTotal, channel: 'QUICK_ORDER' } as never,
      },
    });
  });

  return NextResponse.json({ ok: true, id: created.orderId, orderNumber: created.orderNumber });
});

