import { describe, it, expect } from 'vitest';
import { resolveTailorFee, sumFrozenFees, TailorFeeError } from './tailor-fees';

describe('tailor fee resolution', () => {
  it('prefers an explicitly supplied fee', () => {
    expect(resolveTailorFee({ productFeeBhd: 5, suppliedFeeBhd: 7.5 })).toBe(7.5);
  });

  it('falls back to the product fee', () => {
    expect(resolveTailorFee({ productFeeBhd: '5.250' })).toBe(5.25);
  });

  it('rounds to three decimal places (BHD fils)', () => {
    expect(resolveTailorFee({ productFeeBhd: 5.2504 })).toBe(5.25);
    expect(resolveTailorFee({ productFeeBhd: 5.2506 })).toBe(5.251);
  });

  it('fails loudly when no fee is configured — never a hidden fallback', () => {
    expect(() => resolveTailorFee({ productFeeBhd: null })).toThrow(TailorFeeError);
    expect(() => resolveTailorFee({ productFeeBhd: '' })).toThrow(TailorFeeError);
    expect(() => resolveTailorFee({ productFeeBhd: 'abc' })).toThrow(TailorFeeError);
  });

  it('rejects a negative fee', () => {
    expect(() => resolveTailorFee({ productFeeBhd: -1 })).toThrow(TailorFeeError);
  });

  it('treats an explicit zero as a deliberate fee, not a missing value', () => {
    expect(resolveTailorFee({ productFeeBhd: 5, suppliedFeeBhd: 0 })).toBe(0);
  });
});

describe('frozen fee totals', () => {
  it('sums to three decimals', () => {
    expect(sumFrozenFees([1.1, 2.2, 3.3])).toBe(6.6);
    expect(sumFrozenFees(['0.001', '0.002'])).toBe(0.003);
    expect(sumFrozenFees([])).toBe(0);
  });
});
