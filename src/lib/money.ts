import { roundBhd } from './utils';

/**
 * Money is always accounted in BHD. Presentment currencies are derived at a
 * captured rate and the derived values are snapshotted onto the order so that
 * later rate changes never alter historical transactions.
 */

export const ACCOUNTING_CURRENCY = 'BHD';

export interface CurrencyLike {
  code: string;
  rateToBhd: number | string;
  decimals: number;
}

export function bhdToPresentment(amountBhd: number, rateToBhd: number, decimals: number): number {
  const raw = amountBhd * rateToBhd;
  const factor = Math.pow(10, decimals);
  return Math.round((raw + Number.EPSILON) * factor) / factor;
}

export function presentmentToBhd(amount: number, rateToBhd: number): number {
  if (!rateToBhd) return 0;
  return roundBhd(amount / rateToBhd);
}

export interface CartLine {
  unitPriceBhd: number;
  quantity: number;
  /**
   * Explicit line total. Set when the physical pieces of one line carry
   * different variant prices, so the subtotal is the sum of the actual piece
   * prices rather than one representative price multiplied by the quantity.
   * Omitted by every single-price caller, where `unitPriceBhd * quantity`
   * remains the total.
   */
  lineTotalBhd?: number;
}

export function computeSubtotalBhd(lines: CartLine[]): number {
  return roundBhd(lines.reduce((sum, l) => sum + (l.lineTotalBhd ?? l.unitPriceBhd * l.quantity), 0));
}

export interface CouponLike {
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  valueBhd: number | string;
  minOrderBhd?: number | string | null;
  maxDiscountBhd?: number | string | null;
}

export function computeDiscountBhd(subtotalBhd: number, coupon: CouponLike | null): number {
  if (!coupon) return 0;
  if (coupon.discountType === 'FREE_SHIPPING') return 0;
  const min = coupon.minOrderBhd != null ? Number(coupon.minOrderBhd) : 0;
  if (min && subtotalBhd < min) return 0;
  let discount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discount = subtotalBhd * (Number(coupon.valueBhd) / 100);
  } else {
    discount = Number(coupon.valueBhd);
  }
  if (coupon.maxDiscountBhd != null) {
    discount = Math.min(discount, Number(coupon.maxDiscountBhd));
  }
  return roundBhd(Math.min(discount, subtotalBhd));
}

export interface OrderTotals {
  subtotalBhd: number;
  discountBhd: number;
  shippingBhd: number;
  totalBhd: number;
}

export function computeTotals(
  lines: CartLine[],
  coupon: CouponLike | null,
  shippingBhd: number,
): OrderTotals {
  const subtotalBhd = computeSubtotalBhd(lines);
  const discountBhd = computeDiscountBhd(subtotalBhd, coupon);
  let shipping = roundBhd(shippingBhd);
  if (coupon?.discountType === 'FREE_SHIPPING') shipping = 0;
  const totalBhd = roundBhd(Math.max(0, subtotalBhd - discountBhd + shipping));
  return { subtotalBhd, discountBhd, shippingBhd: shipping, totalBhd };
}
