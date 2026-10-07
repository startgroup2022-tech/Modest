import 'server-only';

/**
 * Server-only secret material.
 *
 * Production must fail closed: a missing or weak secret is a configuration
 * error, never silently replaced with a predictable default. A hardcoded
 * fallback would let an attacker forge session tokens or build a rainbow table
 * against salted identifiers, so every consumer of `AUTH_SECRET` goes through
 * `requireAuthSecret()`.
 */

export const MIN_SECRET_LENGTH = 24;

/** Returns `AUTH_SECRET` or throws when it is absent or too weak. */
export function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET is missing or too short. Set a random value of at least ${MIN_SECRET_LENGTH} ` +
        'characters in the server environment before starting the application.',
    );
  }
  return secret;
}

/** `AUTH_SECRET` as signing-key bytes for `jose`. */
export function authSecretKey(): Uint8Array {
  return new TextEncoder().encode(requireAuthSecret());
}
