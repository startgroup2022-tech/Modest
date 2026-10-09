import { describe, it, expect } from 'vitest';
import { isLate, CLOSED_ORDER_STATUSES } from './lateness';

const now = new Date('2026-09-10T12:00:00Z');

describe('lateness is derived, never stored', () => {
  it('flags an open order past its expected date', () => {
    const r = isLate({ expectedDeliveryAt: '2026-09-05T12:00:00Z', status: 'PREPARING', now });
    expect(r.late).toBe(true);
    expect(r.daysLate).toBe(5);
  });

  it('does not flag an order before its expected date', () => {
    expect(isLate({ expectedDeliveryAt: '2026-09-15T12:00:00Z', status: 'PREPARING', now }).late).toBe(false);
  });

  it('never flags a closed order', () => {
    for (const status of CLOSED_ORDER_STATUSES) {
      expect(isLate({ expectedDeliveryAt: '2026-01-01T00:00:00Z', status, now }).late).toBe(false);
    }
  });

  it('treats a missing or invalid date as not late', () => {
    expect(isLate({ expectedDeliveryAt: null, status: 'PENDING', now }).late).toBe(false);
    expect(isLate({ expectedDeliveryAt: 'not-a-date', status: 'PENDING', now }).late).toBe(false);
  });

  it('is exactly on time at the boundary', () => {
    expect(isLate({ expectedDeliveryAt: now, status: 'PENDING', now }).late).toBe(false);
  });
});
