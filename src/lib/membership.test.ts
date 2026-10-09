import { describe, it, expect } from 'vitest';
import { countQualifyingPieces, resolveMembershipTier } from './membership';

const tiers = [
  { id: 't1', code: 'BRONZE', nameEn: 'Bronze', nameAr: 'برونزي', minQualifying: 5, isActive: true, sortOrder: 1 },
  { id: 't2', code: 'SILVER', nameEn: 'Silver', nameAr: 'فضي', minQualifying: 10, isActive: true, sortOrder: 2 },
  { id: 't3', code: 'GOLD', nameEn: 'Gold', nameAr: 'ذهبي', minQualifying: 20, isActive: true, sortOrder: 3 },
  { id: 't4', code: 'LEGACY', nameEn: 'Legacy', nameAr: 'قديم', minQualifying: 1, isActive: false, sortOrder: 4 },
];

describe('membership calculation', () => {
  it('counts only paid, non-refunded pieces', () => {
    expect(
      countQualifyingPieces([
        { quantity: 2, paid: true, refunded: false },
        { quantity: 3, paid: false, refunded: false },
        { quantity: 4, paid: true, refunded: true },
      ]),
    ).toBe(2);
  });

  it('resolves the highest met tier', () => {
    expect(resolveMembershipTier(12, tiers)?.code).toBe('SILVER');
    expect(resolveMembershipTier(25, tiers)?.code).toBe('GOLD');
  });

  it('ignores inactive tiers even when the threshold is met', () => {
    expect(resolveMembershipTier(1, tiers)).toBeNull();
  });

  it('returns null below every active threshold', () => {
    expect(resolveMembershipTier(3, tiers)).toBeNull();
  });
});
