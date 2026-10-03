import { describe, expect, it } from 'vitest';
import { generateOrderNumber, formatMoney, roundBhd, slugify, truncate } from '@/lib/utils';

describe('roundBhd', () => {
  it('rounds to three decimals (fils)', () => {
    expect(roundBhd(1.2345)).toBe(1.235);
    expect(roundBhd(0.1 + 0.2)).toBe(0.3);
  });
});

describe('generateOrderNumber', () => {
  it('matches the ATT-YYMM-XXXXXX shape', () => {
    expect(generateOrderNumber()).toMatch(/^ATT-\d{4}-\d{6}$/);
  });

  it('is not trivially constant across calls', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateOrderNumber()));
    expect(set.size).toBeGreaterThan(1);
  });
});

describe('formatMoney', () => {
  const base = { code: 'BHD', symbol: 'BD', decimals: 3, symbolPosition: 'prefix' as const };

  it('formats with the requested precision and latin numerals', () => {
    expect(formatMoney(12.5, { ...base, locale: 'en' })).toBe('BD 12.500');
  });

  it('supports suffix symbol position', () => {
    expect(formatMoney(12.5, { ...base, symbolPosition: 'suffix', locale: 'en' })).toBe('12.500 BD');
  });

  it('does not emit arabic-indic digits for the ar locale', () => {
    expect(formatMoney(1234.5, { ...base, locale: 'ar' })).toBe('BD 1,234.500');
  });

  it('coerces non-finite input to zero', () => {
    expect(formatMoney(Number.NaN, { ...base, locale: 'en' })).toBe('BD 0.000');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Abaya  Étoile — Noir')).toBe('abaya-etoile-noir');
  });
});

describe('truncate', () => {
  it('appends an ellipsis only when needed', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a longer sentence', 10)).toBe('a longer…');
  });
});
