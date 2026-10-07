import { describe, it, expect } from 'vitest';
import {
  quickOrderLinkState,
  isQuickOrderLinkUsable,
  isValidTokenFormat,
  newQuickOrderToken,
  tokenLast4,
  buildWhatsAppDeepLink,
  quickOrderMessage,
  quickOrderPath,
  quickOrderUrl,
  QUICK_ORDER_TOKEN_BYTES,
  MIN_TOKEN_LENGTH,
} from './quick-order';

const now = new Date('2026-09-10T12:00:00Z');

describe('quick order link state', () => {
  it('derives the lifecycle state from timestamps, never storing it', () => {
    expect(quickOrderLinkState({ now })).toBe('GENERATED');
    expect(quickOrderLinkState({ sentAt: now, now })).toBe('SEND_INITIATED');
    expect(quickOrderLinkState({ sentAt: now, openedAt: now, now })).toBe('OPENED');
    expect(quickOrderLinkState({ sentAt: now, openedAt: now, orderId: 'o1', now })).toBe('ORDER_CREATED');
    expect(quickOrderLinkState({ revokedAt: now, orderId: 'o1', now })).toBe('REVOKED');
    expect(quickOrderLinkState({ expiresAt: '2026-09-01T00:00:00Z', now })).toBe('EXPIRED');
  });

  it('revocation and expiry outrank later lifecycle states', () => {
    expect(quickOrderLinkState({ revokedAt: now, expiresAt: '2026-01-01T00:00:00Z', now })).toBe('REVOKED');
    expect(quickOrderLinkState({ orderId: 'o1', expiresAt: '2026-01-01T00:00:00Z', now })).toBe('EXPIRED');
  });

  it('treats only generated, send-initiated and opened links as usable', () => {
    expect(isQuickOrderLinkUsable('GENERATED')).toBe(true);
    expect(isQuickOrderLinkUsable('SEND_INITIATED')).toBe(true);
    expect(isQuickOrderLinkUsable('OPENED')).toBe(true);
    expect(isQuickOrderLinkUsable('ORDER_CREATED')).toBe(false);
    expect(isQuickOrderLinkUsable('REVOKED')).toBe(false);
    expect(isQuickOrderLinkUsable('EXPIRED')).toBe(false);
  });
});

describe('quick order tokens', () => {
  it('issues high-entropy url-safe tokens', () => {
    const token = newQuickOrderToken();
    expect(isValidTokenFormat(token)).toBe(true);
    expect(newQuickOrderToken()).not.toBe(token);
    expect(QUICK_ORDER_TOKEN_BYTES).toBeGreaterThanOrEqual(16);
  });

  it('rejects short or unsafe token formats', () => {
    expect(isValidTokenFormat('short')).toBe(false);
    expect(isValidTokenFormat('has spaces and is long enough to pass length')).toBe(false);
    expect(isValidTokenFormat('a'.repeat(MIN_TOKEN_LENGTH - 1))).toBe(false);
    expect(isValidTokenFormat('a'.repeat(MIN_TOKEN_LENGTH))).toBe(true);
  });

  it('keeps only a non-secret suffix for display', () => {
    const token = 'abcdefghijklmnopqrstuvwx';
    expect(tokenLast4(token)).toBe('uvwx');
    expect(token.length).toBeGreaterThan(4);
  });
});

describe('quick order messaging and urls', () => {
  it('builds a WhatsApp deep link only when the phone is usable', () => {
    const link = buildWhatsAppDeepLink('+973 3300 0000', 'hello');
    expect(link).toBe('https://wa.me/97333000000?text=hello');
    expect(buildWhatsAppDeepLink(null, 'hello')).toBeNull();
    expect(buildWhatsAppDeepLink('123', 'hello')).toBeNull();
  });

  it('localizes the sent message', () => {
    expect(quickOrderMessage('en', 'Abaya', 'https://x/y')).toContain('Quick Order');
    expect(quickOrderMessage('ar', 'عباية', 'https://x/y')).toContain('عباية');
  });

  it('builds locale-prefixed paths and absolute urls', () => {
    expect(quickOrderPath('en', 'tok')).toBe('/en/q/tok');
    expect(quickOrderUrl('https://attention.test/', 'ar', 'tok')).toBe('https://attention.test/ar/q/tok');
  });
});
