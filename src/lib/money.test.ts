import { describe, expect, it } from 'vitest';
import { computeDiscountBhd, computeSubtotalBhd, computeTotals, presentmentToBhd } from '@/lib/money';

const coupon = (over: Partial<Parameters<typeof computeDiscountBhd>[1]> = {}) => ({
  discountType: 'PERCENTAGE' as const,
  valueBhd: 10,
  minOrderBhd: null,
  maxDiscountBhd: null,
  ...over,
});

describe('computeSubtotalBhd', () => {
  it('sums unit price × quantity and rounds to 3dp', () => {
    expect(computeSubtotalBhd([{ unitPriceBhd: 12.5, quantity: 2 }, { unitPriceBhd: 0.3333, quantity: 3 }])).toBe(26);
  });
});

describe('computeDiscountBhd', () => {
  it('returns 0 with no coupon', () => {
    expect(computeDiscountBhd(100, null)).toBe(0);
  });

  it('applies a percentage discount', () => {
    expect(computeDiscountBhd(100, coupon({ valueBhd: 15 }))).toBe(15);
  });

  it('applies a fixed discount', () => {
    expect(computeDiscountBhd(100, coupon({ discountType: 'FIXED', valueBhd: 7.5 }))).toBe(7.5);
  });

  it('honours the minimum order threshold', () => {
    expect(computeDiscountBhd(20, coupon({ discountType: 'FIXED', valueBhd: 50, minOrderBhd: 50 }))).toBe(0);
    expect(computeDiscountBhd(60, coupon({ discountType: 'FIXED', valueBhd: 50, minOrderBhd: 50 }))).toBe(50);
  });

  it('caps at maxDiscountBhd', () => {
    expect(computeDiscountBhd(100, coupon({ valueBhd: 50, maxDiscountBhd: 30 }))).toBe(30);
  });

  it('never exceeds the subtotal', () => {
    expect(computeDiscountBhd(10, coupon({ discountType: 'FIXED', valueBhd: 25 }))).toBe(10);
  });

  it('treats FREE_SHIPPING as a shipping waiver, not a line discount', () => {
    expect(computeDiscountBhd(100, coupon({ discountType: 'FREE_SHIPPING', valueBhd: 0 }))).toBe(0);
  });
});

describe('computeTotals', () => {
  it('produces subtotal − discount + shipping', () => {
    const totals = computeTotals([{ unitPriceBhd: 50, quantity: 2 }], coupon({ valueBhd: 10 }), 3);
    expect(totals).toEqual({ subtotalBhd: 100, discountBhd: 10, shippingBhd: 3, totalBhd: 93 });
  });

  it('waives shipping for a FREE_SHIPPING coupon', () => {
    const totals = computeTotals([{ unitPriceBhd: 40, quantity: 1 }], coupon({ discountType: 'FREE_SHIPPING', valueBhd: 0 }), 5);
    expect(totals.shippingBhd).toBe(0);
    expect(totals.totalBhd).toBe(40);
  });

  it('never yields a negative total', () => {
    const totals = computeTotals([{ unitPriceBhd: 5, quantity: 1 }], coupon({ discountType: 'FIXED', valueBhd: 50 }), 0);
    expect(totals.totalBhd).toBe(0);
  });
});

describe('presentmentToBhd', () => {
  it('converts back to accounting currency at the captured rate', () => {
    expect(presentmentToBhd(100, 10)).toBe(10);
    expect(presentmentToBhd(100, 0)).toBe(0);
  });
});
