export interface StoreCurrency {
  code: string;
  nameEn: string;
  nameAr: string;
  symbolEn: string;
  symbolAr: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
  rateToBhd: number;
  isDefault: boolean;
}

/**
 * Base currency fallback. A freshly migrated database has no Currency rows
 * until the owner configures them, so the storefront must still render. BHD is
 * the platform's accounting currency, so it is always a valid default.
 */
export const DEFAULT_CURRENCY: StoreCurrency = {
  code: 'BHD',
  nameEn: 'Bahraini Dinar',
  nameAr: 'دينار بحريني',
  symbolEn: 'BHD',
  symbolAr: 'د.ب',
  decimals: 3,
  symbolPosition: 'prefix',
  rateToBhd: 1,
  isDefault: true,
};

/**
 * Pure currency selection: an explicit cookie choice wins, then the currency
 * flagged default, then the first active one, and finally the BHD fallback so
 * an unconfigured database still renders instead of throwing.
 */
export function selectCurrency(list: StoreCurrency[], code?: string | null): StoreCurrency {
  const chosen = code ? list.find((c) => c.code === code) : undefined;
  return chosen ?? list.find((c) => c.isDefault) ?? list[0] ?? DEFAULT_CURRENCY;
}

export function symbolFor(currency: StoreCurrency, locale: 'en' | 'ar'): string {
  return locale === 'ar' ? currency.symbolAr || currency.symbolEn : currency.symbolEn;
}

/**
 * Conventional presentation metadata for a currency code, independent of the
 * live Currency table. Used to render historical orders whose currency is
 * frozen: the decimal precision follows ISO 4217 (BHD/KWD/OMR use 3, the rest
 * use 2), so a past order renders identically even if the owner later changes
 * the storefront currency configuration. The exchange rate is not part of this
 * object — historical orders carry their own captured rate.
 */
const CURRENCY_META: Record<string, { symbolEn: string; symbolAr: string; decimals: number; symbolPosition: 'prefix' | 'suffix' }> = {
  BHD: { symbolEn: 'BHD', symbolAr: 'د.ب', decimals: 3, symbolPosition: 'prefix' },
  SAR: { symbolEn: 'SAR', symbolAr: 'ر.س', decimals: 2, symbolPosition: 'prefix' },
  AED: { symbolEn: 'AED', symbolAr: 'د.إ', decimals: 2, symbolPosition: 'prefix' },
  KWD: { symbolEn: 'KWD', symbolAr: 'د.ك', decimals: 3, symbolPosition: 'prefix' },
  QAR: { symbolEn: 'QAR', symbolAr: 'ر.ق', decimals: 2, symbolPosition: 'prefix' },
  OMR: { symbolEn: 'OMR', symbolAr: 'ر.ع', decimals: 3, symbolPosition: 'prefix' },
};

export function currencyMetaFor(code: string | null | undefined): {
  code: string;
  symbolEn: string;
  symbolAr: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
} {
  const meta = code ? CURRENCY_META[code] : undefined;
  return { code: code ?? DEFAULT_CURRENCY.code, ...(meta ?? { symbolEn: code ?? DEFAULT_CURRENCY.symbolEn, symbolAr: code ?? DEFAULT_CURRENCY.symbolAr, decimals: DEFAULT_CURRENCY.decimals, symbolPosition: DEFAULT_CURRENCY.symbolPosition }) };
}
