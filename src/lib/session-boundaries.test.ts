import { describe, it, expect, beforeAll } from 'vitest';
import { isStaff } from './admin-auth';
import { createSessionToken, readSessionToken, type SessionKind } from './auth';

/**
 * Phase 2 — session-kind boundaries. A session's `kind` is authoritative: a
 * tailor or customer token must never be accepted as a staff session, and the
 * signed token must round-trip its kind and version intact.
 */
describe('isStaff session boundaries', () => {
  it('accepts only staff roles with a staff (or unspecified legacy) kind', () => {
    expect(isStaff({ role: 'ADMIN' })).toBe(true);
    expect(isStaff({ role: 'MANAGER' })).toBe(true);
    expect(isStaff({ role: 'SUPPORT' })).toBe(true);
    expect(isStaff({ role: 'ADMIN', sessionKind: 'staff' })).toBe(true);
  });

  it('rejects tailor and customer sessions even if the role looks like staff', () => {
    expect(isStaff({ role: 'ADMIN', sessionKind: 'tailor' })).toBe(false);
    expect(isStaff({ role: 'ADMIN', sessionKind: 'customer' })).toBe(false);
    expect(isStaff({ role: 'TAILOR', sessionKind: 'staff' })).toBe(false);
    expect(isStaff({ role: 'CUSTOMER', sessionKind: 'staff' })).toBe(false);
  });

  it('rejects anonymous and unknown roles', () => {
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff({ role: 'WHATEVER' })).toBe(false);
  });
});

describe('session token round-trip', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-value-at-least-24-chars-long';
  });

  it('preserves kind and sessionVersion through sign → verify', async () => {
    for (const kind of ['staff', 'customer', 'tailor'] as SessionKind[]) {
      const token = await createSessionToken({
        userId: 'u1',
        email: 'a@b.c',
        role: kind === 'tailor' ? 'TAILOR' : 'CUSTOMER',
        kind,
        sessionVersion: 7,
      });
      const payload = await readSessionToken(token);
      expect(payload?.kind).toBe(kind);
      expect(payload?.sessionVersion).toBe(7);
    }
  });

  it('rejects a tampered token', async () => {
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.c', role: 'ADMIN', kind: 'staff', sessionVersion: 1 });
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(await readSessionToken(tampered)).toBeNull();
  });
});
