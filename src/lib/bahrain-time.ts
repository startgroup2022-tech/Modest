/**
 * Single display convention for the whole application: dates and times are
 * shown in Bahrain time (Asia/Bahrain) as `DD/MM/YYYY — HH:MM AM/PM`.
 *
 * Database columns stay real `DateTime` values (UTC-instants) so they remain
 * queryable and comparable; only *display* is localised. Conversion lives here
 * and nowhere else so components never re-implement timezone maths.
 */

export const BAHRAIN_TIME_ZONE = 'Asia/Bahrain';

export type DisplayLocale = 'en' | 'ar';

interface Parts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  meridiem: string;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Bahrain-local calendar/time parts with latin digits. `hourCycle: 'h12'`
 * yields a 1–12 hour plus a meridiem token.
 */
export function bahrainParts(value: Date | string | number | null | undefined): Parts | null {
  const date = toDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BAHRAIN_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h12',
    numberingSystem: 'latn',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    hour: get('hour'),
    minute: get('minute'),
    meridiem: get('dayPeriod').toUpperCase(),
  };
}

/** `04/09/2026` in Bahrain time. */
export function formatBahrainDate(
  value: Date | string | number | null | undefined,
  _locale: DisplayLocale = 'en',
): string {
  const p = bahrainParts(value);
  if (!p) return '—';
  return `${p.day}/${p.month}/${p.year}`;
}

/**
 * `04/09/2026 — 11:00 AM` (English) / `04/09/2026 — 11:00 ص` (Arabic).
 * Digits are always latin; only the meridiem is localised.
 */
export function formatBahrainDateTime(
  value: Date | string | number | null | undefined,
  locale: DisplayLocale = 'en',
): string {
  const p = bahrainParts(value);
  if (!p) return '—';
  const meridiem = locale === 'ar' ? (p.meridiem === 'AM' ? 'ص' : 'م') : p.meridiem;
  return `${p.day}/${p.month}/${p.year} — ${p.hour}:${p.minute} ${meridiem}`;
}

/** `11:00 AM` in Bahrain time. */
export function formatBahrainTime(
  value: Date | string | number | null | undefined,
  locale: DisplayLocale = 'en',
): string {
  const p = bahrainParts(value);
  if (!p) return '—';
  const meridiem = locale === 'ar' ? (p.meridiem === 'AM' ? 'ص' : 'م') : p.meridiem;
  return `${p.hour}:${p.minute} ${meridiem}`;
}

/** Start-of-day boundary for a date interpreted in Bahrain time. */
export function bahrainStartOfDay(value: Date | string | number): Date | null {
  const p = bahrainParts(value);
  if (!p) return null;
  // Bahrain is a fixed UTC+3 offset with no daylight saving, so the boundary is
  // unambiguous: midnight local == 21:00 UTC on the previous day.
  const iso = `${p.year}-${p.month}-${p.day}T00:00:00+03:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
