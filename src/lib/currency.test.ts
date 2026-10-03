import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY, selectCurrency, symbolFor, type StoreCurrency } from '@/lib/currency-select';

const currency = (over: Partial<StoreCurrency>): StoreCurrency => ({
  code: 'BHD',
  nameEn: 'Bahraini Dinar',
  nameAr: 'دينار بحريني',
  symbolEn: 'BHD',
  symbolAr: 'د.ب',
  decimals: 3,
  symbolPosition: 'prefix',
  rateToBhd: 1,
  isDefault: false,
  ...over,
});

describe('selectCurrency', () => {
  const bhd = currency({ code: 'BHD', isDefault: true });
  const sar = currency({ code: 'SAR', symbolEn: 'SAR', rateToBhd: 9.97, decimals: 2 });

  it('returns a fresh-database BHD fallback instead of throwing', () => {
    expect(selectCurrency([])).toEqual(DEFAULT_CURRENCY);
    expect(selectCurrency([], 'SAR')).toEqual(DEFAULT_CURRENCY);
  });

  it('honours an explicit cookie choice when it is active', () => {
    expect(selectCurrency([bhd, sar], 'SAR')).toBe(sar);
  });

  it('ignores a cookie for a currency that is no longer active', () => {
    expect(selectCurrency([bhd], 'SAR')).toBe(bhd);
  });

  it('falls back to the default then the first entry', () => {
    expect(selectCurrency([sar, bhd])).toBe(bhd);
    expect(selectCurrency([sar])).toBe(sar);
  });
});

describe('symbolFor', () => {
  it('uses the Arabic symbol for ar and the English symbol for en', () => {
    const c = currency({ code: 'BHD' });
    expect(symbolFor(c, 'ar')).toBe('د.ب');
    expect(symbolFor(c, 'en')).toBe('BHD');
  });

  it('falls back to the English symbol when no Arabic symbol exists', () => {
    expect(symbolFor(currency({ symbolAr: '' }), 'ar')).toBe('BHD');
  });
});
