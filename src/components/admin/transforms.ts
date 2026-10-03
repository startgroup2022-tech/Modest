/**
 * Client-side payload coercions for {@link ResourceForm}. Kept in a shared
 * registry (rather than passed as a prop) so server components can select one
 * by key — functions cannot cross the server/client boundary.
 */
export type Transform = (data: Record<string, unknown>) => Record<string, unknown>;

const numOr = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : fallback;
};
const numOrNull = (v: unknown) => (v === '' || v == null ? null : Number(v));

export const TRANSFORMS: Record<string, Transform> = {
  coupons: (d) => ({
    ...d,
    valueBhd: numOr(d.valueBhd, 0),
    minOrderBhd: numOrNull(d.minOrderBhd),
    maxDiscountBhd: numOrNull(d.maxDiscountBhd),
    usageLimit: numOrNull(d.usageLimit),
    perCustomerLimit: numOrNull(d.perCustomerLimit),
  }),
  promotions: (d) => ({ ...d, sortOrder: numOr(d.sortOrder, 0) }),
  expenses: (d) => ({ ...d, amountBhd: numOr(d.amountBhd, 0) }),
  homepage: (d) => ({ ...d, sortOrder: numOr(d.sortOrder, 0) }),
  social: (d) => ({ ...d, sortOrder: numOr(d.sortOrder, 0) }),
  redirects: (d) => ({ ...d, statusCode: numOr(d.statusCode, 301) }),
  tailors: (d) => ({ ...d, capacity: numOr(d.capacity, 0), rateBhd: numOr(d.rateBhd, 0) }),
  shipping: (d) => ({
    ...d,
    priceBhd: numOr(d.priceBhd, 0),
    freeOverBhd: numOrNull(d.freeOverBhd),
    etaMinDays: numOr(d.etaMinDays, 0),
    etaMaxDays: numOr(d.etaMaxDays, 0),
    sortOrder: numOr(d.sortOrder, 0),
  }),
};
