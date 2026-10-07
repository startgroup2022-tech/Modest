import 'server-only';
import { prisma } from './prisma';
import { roundBhd } from './utils';
import { computeDiscountBhd, type CouponLike } from './money';

/**
 * Server-authoritative coupon evaluation.
 *
 * The client never supplies a discount. This module resolves the code from the
 * database, checks the window, usage limit, per-customer limit, membership
 * targeting and scope, then computes the discount against only the eligible
 * lines. Every successful evaluation is recorded as a `CouponRedemption` row at
 * order creation, so usage is auditable and refunds can revert it traceably.
 */

export interface CouponLine {
  productId: string;
  categoryIds: string[];
  collectionIds: string[];
  unitPriceBhd: number;
  quantity: number;
}

export interface CouponRow {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  valueBhd: number;
  minOrderBhd: number | null;
  maxDiscountBhd: number | null;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  categoryIds: string[] | null;
  collectionIds: string[] | null;
  productIds: string[] | null;
  currencyCodes: string[] | null;
  minQualifyingPieces: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}

export type CouponRejection =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'USAGE_LIMIT'
  | 'PER_CUSTOMER_LIMIT'
  | 'MIN_ORDER'
  | 'MIN_MEMBERSHIP'
  | 'CURRENCY'
  | 'NO_ELIGIBLE_ITEMS';

export interface CouponEvaluation {
  ok: boolean;
  reason?: CouponRejection;
  /** Discount in BHD against the eligible subtotal. */
  discountBhd: number;
  freeShipping: boolean;
  /** Eligible subtotal the discount was computed against. */
  eligibleSubtotalBhd: number;
  coupon: CouponLike & { id: string } | null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter((v): v is string => typeof v === 'string');
  return out.length ? out : null;
}

/** Maps a DB coupon row (Prisma) into the evaluator's shape. */
export function toCouponRow(row: {
  id: string;
  code: string;
  discountType: string;
  valueBhd: unknown;
  minOrderBhd: unknown;
  maxDiscountBhd: unknown;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  categoryIds: unknown;
  collectionIds: unknown;
  productIds: unknown;
  currencyCodes: unknown;
  minQualifyingPieces: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}): CouponRow {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType as CouponRow['discountType'],
    valueBhd: Number(row.valueBhd),
    minOrderBhd: row.minOrderBhd != null ? Number(row.minOrderBhd) : null,
    maxDiscountBhd: row.maxDiscountBhd != null ? Number(row.maxDiscountBhd) : null,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    perCustomerLimit: row.perCustomerLimit,
    categoryIds: asStringArray(row.categoryIds),
    collectionIds: asStringArray(row.collectionIds),
    productIds: asStringArray(row.productIds),
    currencyCodes: asStringArray(row.currencyCodes),
    minQualifyingPieces: row.minQualifyingPieces,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
  };
}

/** A line is in scope when the coupon has no scope, or the line matches it. */
function lineInScope(coupon: CouponRow, line: CouponLine): boolean {
  const hasScope = coupon.productIds || coupon.categoryIds || coupon.collectionIds;
  if (!hasScope) return true;
  if (coupon.productIds?.includes(line.productId)) return true;
  if (coupon.categoryIds?.some((c) => line.categoryIds.includes(c))) return true;
  if (coupon.collectionIds?.some((c) => line.collectionIds.includes(c))) return true;
  return false;
}

export interface EvaluateContext {
  customerId: string | null;
  guestEmailHash: string | null;
  /** Server-computed qualifying paid-piece count; required for membership codes. */
  membershipCount: number | null;
  currencyCode: string;
}

/**
 * Evaluates a coupon against a cart. Returns the discount and free-shipping
 * flag, or a rejection reason. This is the only place a discount is decided.
 */
export async function evaluateCoupon(
  coupon: CouponRow,
  lines: CouponLine[],
  ctx: EvaluateContext,
  now: Date = new Date(),
): Promise<CouponEvaluation> {
  const reject = (reason: CouponRejection): CouponEvaluation => ({
    ok: false,
    reason,
    discountBhd: 0,
    freeShipping: false,
    eligibleSubtotalBhd: 0,
    coupon: null,
  });

  if (!coupon.isActive) return reject('INACTIVE');
  if (coupon.startsAt && coupon.startsAt > now) return reject('NOT_STARTED');
  if (coupon.expiresAt && coupon.expiresAt < now) return reject('EXPIRED');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return reject('USAGE_LIMIT');
  if (coupon.currencyCodes && !coupon.currencyCodes.includes(ctx.currencyCode)) return reject('CURRENCY');

  // Membership targeting uses the *server-computed* count, never a client value.
  if (coupon.minQualifyingPieces != null) {
    if (ctx.membershipCount == null || ctx.membershipCount < coupon.minQualifyingPieces) {
      return reject('MIN_MEMBERSHIP');
    }
  }

  // Per-customer limit counts active (non-reverted) redemptions only.
  if (coupon.perCustomerLimit != null) {
    const where = ctx.customerId
      ? { couponId: coupon.id, customerId: ctx.customerId, revertedAt: null }
      : ctx.guestEmailHash
        ? { couponId: coupon.id, guestEmailHash: ctx.guestEmailHash, revertedAt: null }
        : null;
    if (where) {
      const used = await prisma.couponRedemption.count({ where });
      if (used >= coupon.perCustomerLimit) return reject('PER_CUSTOMER_LIMIT');
    }
  }

  const eligibleLines = lines.filter((l) => lineInScope(coupon, l));
  const eligibleSubtotalBhd = roundBhd(
    eligibleLines.reduce((sum, l) => sum + l.unitPriceBhd * l.quantity, 0),
  );
  if (eligibleSubtotalBhd <= 0) return reject('NO_ELIGIBLE_ITEMS');

  const totalSubtotalBhd = roundBhd(lines.reduce((sum, l) => sum + l.unitPriceBhd * l.quantity, 0));
  const min = coupon.minOrderBhd ?? 0;
  if (min && totalSubtotalBhd < min) return reject('MIN_ORDER');

  const like: CouponLike = {
    discountType: coupon.discountType,
    valueBhd: coupon.valueBhd,
    // The minimum applies to the whole order, already checked above; pass null
    // so computeDiscountBhd does not re-apply it against the eligible subtotal.
    minOrderBhd: null,
    maxDiscountBhd: coupon.maxDiscountBhd,
  };
  const discountBhd = computeDiscountBhd(eligibleSubtotalBhd, like);

  return {
    ok: true,
    discountBhd,
    freeShipping: coupon.discountType === 'FREE_SHIPPING',
    eligibleSubtotalBhd,
    coupon: { id: coupon.id, ...like, discountType: coupon.discountType },
  };
}

/** Loads a coupon by code (case-insensitive) as an evaluator row. */
export async function findCouponByCode(code: string): Promise<CouponRow | null> {
  const row = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  return row ? toCouponRow(row) : null;
}

/** Enriches raw cart lines with the category/collection ids scope needs. */
export async function buildCouponLines(
  raw: { productId: string; unitPriceBhd: number; quantity: number }[],
): Promise<CouponLine[]> {
  if (!raw.length) return [];
  const ids = [...new Set(raw.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      categories: { select: { categoryId: true } },
      collections: { select: { collectionId: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return raw.map((l) => {
    const p = byId.get(l.productId);
    return {
      productId: l.productId,
      categoryIds: p?.categories.map((c) => c.categoryId) ?? [],
      collectionIds: p?.collections.map((c) => c.collectionId) ?? [],
      unitPriceBhd: l.unitPriceBhd,
      quantity: l.quantity,
    };
  });
}
