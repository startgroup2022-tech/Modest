import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY, currencyMetaFor, selectCurrency, symbolFor, type StoreCurrency } from '@/lib/currency-select';

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

describe('currencyMetaFor', () => {
  it('uses ISO 4217 decimals per currency', () => {
    expect(currencyMetaFor('BHD').decimals).toBe(3);
    expect(currencyMetaFor('KWD').decimals).toBe(3);
    expect(currencyMetaFor('OMR').decimals).toBe(3);
    expect(currencyMetaFor('SAR').decimals).toBe(2);
    expect(currencyMetaFor('AED').decimals).toBe(2);
    expect(currencyMetaFor('QAR').decimals).toBe(2);
  });

  it('exposes locale-appropriate symbols', () => {
    expect(currencyMetaFor('SAR').symbolAr).toBe('ر.س');
    expect(currencyMetaFor('AED').symbolEn).toBe('AED');
  });

  it('falls back to the accounting currency for an unknown or missing code', () => {
    expect(currencyMetaFor(null).code).toBe('BHD');
    expect(currencyMetaFor(undefined).decimals).toBe(3);
    const unknown = currencyMetaFor('XYZ');
    expect(unknown.code).toBe('XYZ');
    expect(unknown.decimals).toBe(3);
  });
});
