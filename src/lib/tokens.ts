import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { requireAuthSecret } from './secrets';

/**
 * Public tokens for shareable links (Quick Order). Tokens are high-entropy and
 * URL-safe; the hash helper lets a caller store only a digest if it prefers not
 * to persist the raw token.
 */

export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A stable, non-reversible anchor for a guest's coupon identity. The raw email
 * is never stored on a redemption row, so guests cannot be enumerated from the
 * coupon tables. The value is salted with `AUTH_SECRET` so it is not a plain
 * rainbow-table lookup of common addresses.
 *
 * The salt is mandatory: a predictable fallback would make every guest hash
 * reversible from a public email list, so this throws in production when the
 * secret is absent rather than degrading silently.
 */
export function hashGuestEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash('sha256').update(`${requireAuthSecret()}:${normalized}`).digest('hex');
}

