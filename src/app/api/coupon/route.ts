import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCartView } from '@/lib/cart';
import { computeDiscountBhd, type CouponLike } from '@/lib/money';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().min(1).max(60) });

/**
 * Validates a promo code against the live cart. The discount returned here is a
 * preview only — checkout re-validates and recomputes it server-side.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
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

  const now = new Date();
  const row = await prisma.coupon.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
  const valid =
    row &&
    row.isActive &&
    (!row.startsAt || row.startsAt <= now) &&
    (!row.expiresAt || row.expiresAt >= now) &&
    (row.usageLimit == null || row.usedCount < row.usageLimit);

  if (!valid || !row) {
    return NextResponse.json({ ok: false, error: 'couponInvalid' }, { status: 200 });
  }

  const coupon: CouponLike = {
    discountType: row.discountType,
    valueBhd: Number(row.valueBhd),
    minOrderBhd: row.minOrderBhd != null ? Number(row.minOrderBhd) : null,
    maxDiscountBhd: row.maxDiscountBhd != null ? Number(row.maxDiscountBhd) : null,
  };
  const min = coupon.minOrderBhd != null ? Number(coupon.minOrderBhd) : 0;
  if (min && cart.subtotalBhd < min) {
    return NextResponse.json({ ok: false, error: 'couponMinOrder', minBhd: min }, { status: 200 });
  }

  const discountBhd = computeDiscountBhd(cart.subtotalBhd, coupon);
  return NextResponse.json({
    ok: true,
    code: row.code,
    discountBhd,
    freeShipping: row.discountType === 'FREE_SHIPPING',
  });
}
