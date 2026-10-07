import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { requireAuthSecret, authSecretKey, MIN_SECRET_LENGTH } from './secrets';
import { hashGuestEmail } from './tokens';

const original = process.env.AUTH_SECRET;

describe('secret material fails closed', () => {
  beforeEach(() => {
    delete process.env.AUTH_SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it('throws when AUTH_SECRET is absent rather than using a default', () => {
    expect(() => requireAuthSecret()).toThrow(/AUTH_SECRET/);
  });

  it('throws when AUTH_SECRET is shorter than the minimum', () => {
    process.env.AUTH_SECRET = 'a'.repeat(MIN_SECRET_LENGTH - 1);
    expect(() => requireAuthSecret()).toThrow(/too short/);
  });

  it('returns the secret once it meets the minimum length', () => {
    const value = 'b'.repeat(MIN_SECRET_LENGTH);
    process.env.AUTH_SECRET = value;
    expect(requireAuthSecret()).toBe(value);
    expect(authSecretKey()).toBeInstanceOf(Uint8Array);
  });

  it('does not fall back to the historical literal "attention" salt', () => {
    // The old implementation salted with "attention"; a guest hash computed with
    // no secret must now throw instead of producing that predictable value.
    expect(() => hashGuestEmail('guest@example.com')).toThrow(/AUTH_SECRET/);
  });

  it('produces a stable, secret-dependent guest hash when configured', () => {
    process.env.AUTH_SECRET = 'c'.repeat(MIN_SECRET_LENGTH);
    const a = hashGuestEmail('Guest@Example.com');
    const b = hashGuestEmail(' guest@example.com ');
    expect(a).toBe(b); // normalised: trimmed + lowercased

    process.env.AUTH_SECRET = 'd'.repeat(MIN_SECRET_LENGTH);
    expect(hashGuestEmail('guest@example.com')).not.toBe(a); // salt actually used
  });
});
