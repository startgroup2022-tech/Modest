/**
 * Tailor-fee rules (pure).
 *
 * A piece's tailoring fee is frozen at assignment. There is deliberately **no
 * hidden fallback**: if no valid fee can be resolved and none is supplied by an
 * authorised workflow, assignment fails. This protects historical dues,
 * settlements and profit reporting from silent drift.
 */

export class TailorFeeError extends Error {
  constructor(message: string, public code: 'MISSING_FEE' | 'INVALID_FEE' = 'MISSING_FEE') {
    super(message);
    this.name = 'TailorFeeError';
  }
}

export interface ResolveFeeInput {
  /** Product's current default fee, if configured. */
  productFeeBhd: number | string | null | undefined;
  /** Explicit fee supplied by an authorised workflow (overrides the default). */
  suppliedFeeBhd?: number | string | null;
}

/**
 * Resolves the fee to freeze. An explicitly supplied fee wins (an authorised
 * override); otherwise the product default is used. If neither yields a finite
 * non-negative number, a TailorFeeError is thrown — never a made-up value.
 */
export function resolveTailorFee(input: ResolveFeeInput): number {
  const supplied = toFee(input.suppliedFeeBhd);
  if (supplied !== null) return supplied;

  const fromProduct = toFee(input.productFeeBhd);
  if (fromProduct !== null) return fromProduct;

  throw new TailorFeeError(
    'No tailoring fee is configured for this piece. Set the product fee or supply an explicit fee.',
    'MISSING_FEE',
  );
}

function toFee(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) throw new TailorFeeError('Tailoring fee cannot be negative', 'INVALID_FEE');
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Sum of frozen fees for a set of settlement items. */
export function sumFrozenFees(fees: Array<number | string>): number {
  const total = fees.reduce<number>((s, f) => s + (Number(f) || 0), 0);
  return Math.round((total + Number.EPSILON) * 1000) / 1000;
}
