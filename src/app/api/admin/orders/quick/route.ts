import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { createOrder, resolveCartLines, CheckoutError, orderFingerprint } from '@/lib/orders';
import { computeTotals } from '@/lib/money';
import { validatePieces, type PieceInput } from '@/lib/measurement-plan';
import { getCutForProduct } from '@/lib/size-guide-db';

export const dynamic = 'force-dynamic';

const pieceSchema = z.union([
  z.object({ mode: z.literal('READY'), sizeCode: z.string().trim().min(1).max(20) }),
  z.object({
    mode: z.literal('CUSTOM'),
    values: z.record(z.string(), z.union([z.number(), z.string()])),
    profileId: z.string().min(1).max(64).nullable().optional(),
  }),
]);

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
        // Staff can capture a full per-piece configuration for a cut product.
        // Optional: when omitted the piece is taken at its selected ready size.
        pieces: z.array(pieceSchema).max(20).optional(),
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
  // Optional client-generated key so a double-tap on "Create order" replays the
  // first result instead of creating a second order.
  idempotencyKey: z.string().min(8).max(80).optional(),
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

  // Re-validate any per-piece configuration the staff captured against each
  // product's stored cut. A product without a full configuration is taken at
  // its selected ready size (the existing size-only behaviour).
  const piecesByProduct: Record<string, PieceInput[]> = {};
  for (const item of input.items) {
    if (!item.pieces?.length) continue;
    const cut = await getCutForProduct(item.productId);
    if (!cut || cut.fieldRows.length === 0 || cut.sizes.length === 0) continue;
    const pieces: PieceInput[] = item.pieces.map((p) =>
      p.mode === 'READY'
        ? { mode: 'READY', sizeCode: p.sizeCode }
        : { mode: 'CUSTOM', values: p.values, profileId: p.profileId ?? null },
    );
    if (pieces.length !== item.quantity) {
      throw new AdminActionError('A piece is missing its measurements', 'INVALID', 400);
    }
    const validated = validatePieces(cut, pieces);
    if (!validated.ok) throw new AdminActionError(validated.error.message, 'INVALID', 400);
    piecesByProduct[item.productId] = pieces;
  }

  const lines = await resolveCartLines(
    input.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
    // Staff quick-order entries are size-only unless a per-piece configuration
    // was captured above.
    { requireMeasurements: false, piecesByProduct: Object.keys(piecesByProduct).length ? piecesByProduct : undefined },
  );

  const totals = computeTotals(
    lines.map((l) => ({ unitPriceBhd: l.unitPriceBhd, quantity: l.quantity, lineTotalBhd: l.lineTotalBhd })),
    null,
    shippingBhd,
  );
  // The staff discount is clamped to the subtotal here purely to gate the
  // payment method against what the customer actually pays; `createOrder`
  // applies and clamps it again when it writes the order.
  const manualDiscount = Math.min(input.manualDiscountBhd ?? 0, totals.subtotalBhd);
  const finalTotal = Math.max(0, totals.totalBhd - manualDiscount);

  // Apply the same admin-configured payment rules as the storefront so a
  // method disabled in settings (or outside its order-value limits) cannot be
  // used to create an order here either. Enforced against the staff-discounted
  // total, which is what the customer actually pays.
  const { getPaymentConfigs, assertMethodAllowed } = await import('@/lib/payment-config');
  const methodConfigs = await getPaymentConfigs();
  const gate = assertMethodAllowed(methodConfigs[input.paymentMethod], finalTotal);
  if (!gate.ok) throw new AdminActionError(gate.message, gate.code, 400);

  const name =
    customer
      ? [customer.user?.firstName, customer.user?.lastName].filter(Boolean).join(' ') || customer.user?.email || 'Customer'
      : [input.guest?.firstName, input.guest?.lastName].filter(Boolean).join(' ');

  const fingerprint = orderFingerprint({
    lines: lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPriceBhd: l.unitPriceBhd,
      pieces: l.pieces.map((p) => ({
        measurementKind: p.measurementKind,
        sizeCode: p.sizeCode,
        values:
          p.measurementSnapshot && typeof p.measurementSnapshot === 'object' && 'values' in p.measurementSnapshot
            ? ((p.measurementSnapshot as { values: Record<string, number> }).values ?? null)
            : null,
      })),
    })),
    shippingBhd,
    paymentMethod: input.paymentMethod,
    manualDiscountBhd: manualDiscount,
  });

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
    idempotencyKey: input.idempotencyKey ?? null,
    idempotencyFingerprint: fingerprint,
    channel: 'QUICK_ORDER',
    manualDiscountBhd: manualDiscount,
  }).catch((err) => {
    // Surface stock / availability failures as a clear client error instead of
    // a generic 500, matching how the storefront checkout reports them.
    if (err instanceof CheckoutError) throw new AdminActionError(err.message, err.code, 400);
    throw err;
  });

  // Record staff provenance and the discount event. The order's financial
  // amounts were already written by `createOrder` (including the manual
  // discount), so nothing here rewrites them. A replayed retry already has its
  // provenance, so only the freshly-created order is annotated.
  if (!created.replayed) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: created.orderId },
        data: { createdById: admin.id },
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
  }

  return NextResponse.json({ ok: true, id: created.orderId, orderNumber: created.orderNumber, replayed: created.replayed ?? false });
});

