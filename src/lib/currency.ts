import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { bhdToPresentment, presentmentToBhd } from './money';

export const CURRENCY_COOKIE = 'att_currency';

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

function toStoreCurrency(c: {
  code: string;
  nameEn: string;
  nameAr: string;
  symbolEn: string;
  symbolAr: string;
  decimals: number;
  symbolPosition: string;
  rateToBhd: unknown;
  isDefault: boolean;
}): StoreCurrency {
  return {
    code: c.code,
    nameEn: c.nameEn,
    nameAr: c.nameAr,
    symbolEn: c.symbolEn,
    symbolAr: c.symbolAr,
    decimals: c.decimals,
    symbolPosition: c.symbolPosition === 'suffix' ? 'suffix' : 'prefix',
    rateToBhd: Number(c.rateToBhd),
    isDefault: c.isDefault,
  };
}

export async function getActiveCurrencies(): Promise<StoreCurrency[]> {
  const rows = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
  });
  return rows.map(toStoreCurrency);
}

export async function getSelectedCurrency(): Promise<StoreCurrency> {
  const list = await getActiveCurrencies();
  const store = await cookies();
  const code = store.get(CURRENCY_COOKIE)?.value;
  const found = code ? list.find((c) => c.code === code) : undefined;
  return found ?? list.find((c) => c.isDefault) ?? list[0];
}

export interface PriceView {
  bhd: number;
  display: number;
  code: string;
  symbol: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
  rateToBhd: number;
}

export function presentPrice(amountBhd: number, currency: StoreCurrency): PriceView {
  const symbol = currency.symbolEn;
  return {
    bhd: amountBhd,
    display: bhdToPresentment(amountBhd, currency.rateToBhd, currency.decimals),
    code: currency.code,
    symbol,
    decimals: currency.decimals,
    symbolPosition: currency.symbolPosition,
    rateToBhd: currency.rateToBhd,
  };
}

export function symbolFor(currency: StoreCurrency, locale: 'en' | 'ar'): string {
  return locale === 'ar' ? currency.symbolAr || currency.symbolEn : currency.symbolEn;
}

export { presentmentToBhd, bhdToPresentment };
