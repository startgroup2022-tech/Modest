import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getCartView, clearCart } from '@/lib/cart';
import { getSelectedCurrency } from '@/lib/currency';
import { checkoutSchema } from '@/lib/validation';
import { createOrder, resolveCartLines, CheckoutError } from '@/lib/orders';
import { computeTotals } from '@/lib/money';
import { findCouponByCode, buildCouponLines, evaluateCoupon } from '@/lib/coupons';
import { getQualifyingCount } from '@/lib/membership-db';
import { hashGuestEmail } from '@/lib/tokens';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';
import type { CouponLike } from '@/lib/money';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`checkout:${ip}`, 12, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input', field: parsed.error.issues[0]?.path?.[0] },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  const currency = await getSelectedCurrency();

  // Replay a previous submission before touching the cart. A double-tap or
  // network retry clears the bag on the first request, so without this the
  // retry would fail with "bag is empty" instead of the original confirmation.
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        paymentStatus: existing.payments[0]?.status ?? 'PENDING',
        redirectUrl: null,
        instructions: null,
      });
    }
  }

  const cart = await getCartView();
  if (!cart.items.length) {
    return NextResponse.json({ error: 'Your bag is empty' }, { status: 400 });
  }

  // Coupon is validated server-side against the database, never trusted from the client.
  // The evaluator applies scope, window, usage, per-customer and membership rules.
  let coupon: (CouponLike & { id: string }) | null = null;
  const couponCode = parsed.data.couponCode?.trim().toUpperCase();
  if (couponCode) {
    const row = await findCouponByCode(couponCode);
    if (!row) {
      return NextResponse.json({ error: 'This promo code is not valid', field: 'couponCode' }, { status: 400 });
    }
    const couponLines = await buildCouponLines(
      cart.items.map((i) => ({ productId: i.productId, unitPriceBhd: i.unitPriceBhd, quantity: i.quantity })),
    );
    const membershipCount = user?.customerId ? await getQualifyingCount(user.customerId) : null;
    const evaluation = await evaluateCoupon(row, couponLines, {
      customerId: user?.customerId ?? null,
      guestEmailHash: user?.customerId ? null : hashGuestEmail(parsed.data.email),
      membershipCount,
      currencyCode: currency.code,
    });
    if (!evaluation.ok || !evaluation.coupon) {
      const message =
        evaluation.reason === 'MIN_ORDER'
          ? 'This promo code needs a larger order'
          : evaluation.reason === 'PER_CUSTOMER_LIMIT'
            ? 'You have already used this promo code'
            : evaluation.reason === 'MIN_MEMBERSHIP'
              ? 'This promo code is not available for your account'
              : 'This promo code is not valid';
      return NextResponse.json({ error: message, field: 'couponCode' }, { status: 400 });
    }
    coupon = evaluation.coupon;
  }

  // Shipping is chosen server-side from the DB by code; the price is never
  // client-supplied, and a code that is not an active method is rejected rather
  // than silently downgraded to a possibly-cheaper fallback.
  let shippingBhd = 0;
  const requestedShipping = parsed.data.shippingMethodCode?.trim();
  const shippingMethods = await prisma.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (requestedShipping) {
    const method = shippingMethods.find((m) => m.code === requestedShipping);
    if (!method) {
      return NextResponse.json(
        { error: 'The selected delivery method is not available', code: 'INVALID_SHIPPING', field: 'shippingMethodCode' },
        { status: 400 },
      );
    }
    shippingBhd = Number(method.priceBhd);
  } else if (shippingMethods.length) {
    shippingBhd = Number(shippingMethods[0].priceBhd);
  }

  try {
    const lines = await resolveCartLines(
      cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
    );

    // Recompute the order total server-side before honouring the chosen method,
    // so the enabled flag and any order-value limits cannot be bypassed by a
    // client that simply posts a different method.
    const previewTotals = computeTotals(
      lines.map((l) => ({ unitPriceBhd: l.unitPriceBhd, quantity: l.quantity, lineTotalBhd: l.lineTotalBhd })),
      coupon,
      shippingBhd,
    );
    const { getPaymentConfigs, assertMethodAllowed } = await import('@/lib/payment-config');
    const methodConfigs = await getPaymentConfigs();
    const gate = assertMethodAllowed(methodConfigs[parsed.data.paymentMethod], previewTotals.totalBhd);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message, code: gate.code, field: 'paymentMethod' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
    const order = await createOrder({
      checkout: parsed.data,
      lines,
      customerId: user?.customerId ?? null,
      locale: req.nextUrl.searchParams.get('locale') === 'ar' ? 'ar' : 'en',
      currency: { code: currency.code, rateToBhd: currency.rateToBhd, decimals: currency.decimals },
      shippingBhd,
      coupon,
      idempotencyKey,
      baseUrl,
      guestEmailHash: user?.customerId ? null : hashGuestEmail(parsed.data.email),
    });

    await clearCart();
    await writeAudit({
      userId: user?.id ?? null,
      action: 'order.created',
      entity: 'Order',
      entityId: order.orderId,
      metadata: { orderNumber: order.orderNumber, totalBhd: order.totalBhd, method: parsed.data.paymentMethod },
      ip,
    });

    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      redirectUrl: order.redirectUrl ?? null,
      instructions: order.instructions ?? null,
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      const isMeasurements =
        err.message.startsWith('Please choose your measurements') || err.message.startsWith('A piece is missing');
      return NextResponse.json(
        { error: err.message, code: err.code, field: isMeasurements ? 'cart' : undefined },
        { status: 400 },
      );
    }
    console.error('[checkout] failed', err);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }
}
