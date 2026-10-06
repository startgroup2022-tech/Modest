import { describe, it, expect } from 'vitest';
import { quickOrderLinkState, isValidTokenFormat, newQuickOrderToken } from './quick-order';

const now = new Date('2026-09-10T12:00:00Z');

describe('quick order links', () => {
  it('derives logical state from timestamps', () => {
    expect(quickOrderLinkState({ now })).toBe('SENT');
    expect(quickOrderLinkState({ openedAt: now, now })).toBe('OPENED');
    expect(quickOrderLinkState({ openedAt: now, orderId: 'o1', now })).toBe('ORDER_CREATED');
    expect(quickOrderLinkState({ revokedAt: now, orderId: 'o1', now })).toBe('REVOKED');
    expect(quickOrderLinkState({ expiresAt: '2026-09-01T00:00:00Z', now })).toBe('EXPIRED');
  });

  it('revocation and order creation outrank expiry', () => {
    expect(quickOrderLinkState({ revokedAt: now, expiresAt: '2026-01-01T00:00:00Z', now })).toBe('REVOKED');
  });

  it('issues high-entropy url-safe tokens', () => {
    const token = newQuickOrderToken();
    expect(isValidTokenFormat(token)).toBe(true);
    expect(newQuickOrderToken()).not.toBe(token);
  });

  it('rejects short or unsafe token formats', () => {
    expect(isValidTokenFormat('short')).toBe(false);
    expect(isValidTokenFormat('has spaces and is long enough to pass length')).toBe(false);
  });
});
