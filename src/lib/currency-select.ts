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
