import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Formats a monetary amount in the given currency and locale. */
export function formatMoney(
  amount: number | string,
  opts: { code: string; symbol: string; decimals: number; symbolPosition: 'prefix' | 'suffix'; locale: 'en' | 'ar' },
) {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString(opts.locale === 'ar' ? 'ar-BH' : 'en-US', {
    minimumFractionDigits: opts.decimals,
    maximumFractionDigits: opts.decimals,
    numberingSystem: 'latn',
  });
  return opts.symbolPosition === 'suffix'
    ? `${formatted} ${opts.symbol}`
    : `${opts.symbol} ${formatted}`;
}

export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `ATT-${y}${m}-${rand}`;
}

export function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

/** Deterministic rounding to 3 decimals for BHD accounting. */
export function roundBhd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
