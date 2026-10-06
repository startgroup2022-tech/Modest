import { describe, it, expect } from 'vitest';
import { bahrainParts, formatBahrainDate, formatBahrainDateTime, formatBahrainTime } from './bahrain-time';

describe('Bahrain time display convention', () => {
  it('converts a UTC instant to Bahrain local parts (UTC+3, no DST)', () => {
    // 2026-09-04T08:00:00Z == 11:00 in Manama.
    const p = bahrainParts('2026-09-04T08:00:00Z');
    expect(p).toMatchObject({ day: '04', month: '09', year: '2026', hour: '11', minute: '00', meridiem: 'AM' });
  });

  it('formats a date as DD/MM/YYYY', () => {
    expect(formatBahrainDate('2026-09-04T08:00:00Z')).toBe('04/09/2026');
  });

  it('formats a date-time with the Bahrain hour', () => {
    expect(formatBahrainDateTime('2026-09-04T08:00:00Z', 'en')).toBe('04/09/2026 — 11:00 AM');
  });

  it('localises the meridiem in Arabic', () => {
    expect(formatBahrainDateTime('2026-09-04T08:00:00Z', 'ar')).toBe('04/09/2026 — 11:00 ص');
    expect(formatBahrainTime('2026-09-04T17:30:00Z', 'ar')).toBe('08:30 م');
  });

  it('shows a placeholder for missing values', () => {
    expect(formatBahrainDate(null)).toBe('—');
    expect(formatBahrainDateTime(undefined)).toBe('—');
  });
});
