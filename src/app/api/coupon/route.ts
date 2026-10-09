import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCartView } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { getSelectedCurrency } from '@/lib/currency';
import { findCouponByCode, buildCouponLines, evaluateCoupon } from '@/lib/coupons';
import { getQualifyingCount } from '@/lib/membership-db';
import { hashGuestEmail } from '@/lib/tokens';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().min(1).max(60), email: z.string().email().max(160).optional() });

/**
 * Validates a promo code against the live cart. The discount returned here is a
 * preview only — checkout re-validates and recomputes it server-side through the
 * exact same evaluator, so the preview can never disagree with the charge.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`coupon:${ip}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

  const cart = await getCartView();
  if (!cart.items.length) return NextResponse.json({ error: 'Your bag is empty' }, { status: 400 });

  const row = await findCouponByCode(parsed.data.code);
  if (!row) return NextResponse.json({ ok: false, error: 'couponInvalid' }, { status: 200 });

  const [user, currency] = await Promise.all([getCurrentUser(), getSelectedCurrency()]);
  const lines = await buildCouponLines(
    cart.items.map((i) => ({ productId: i.productId, unitPriceBhd: i.unitPriceBhd, quantity: i.quantity })),
  );
  const membershipCount = user?.customerId ? await getQualifyingCount(user.customerId) : null;

  const evaluation = await evaluateCoupon(row, lines, {
    customerId: user?.customerId ?? null,
    guestEmailHash: user?.customerId ? null : parsed.data.email ? hashGuestEmail(parsed.data.email) : null,
    membershipCount,
    currencyCode: currency.code,
  });

  if (!evaluation.ok) {
    const error =
      evaluation.reason === 'MIN_ORDER'
        ? 'couponMinOrder'
        : evaluation.reason === 'PER_CUSTOMER_LIMIT'
          ? 'couponUsed'
          : evaluation.reason === 'MIN_MEMBERSHIP'
            ? 'couponMembership'
            : 'couponInvalid';
    return NextResponse.json({ ok: false, error, minBhd: row.minOrderBhd ?? undefined }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    code: row.code,
    discountBhd: evaluation.discountBhd,
    freeShipping: evaluation.freeShipping,
  });
}
