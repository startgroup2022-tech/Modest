import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

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
