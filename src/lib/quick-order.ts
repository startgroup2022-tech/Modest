/**
 * Quick Order link token rules (pure). Tokens are opaque and high-entropy; the
 * link never encodes trusted price, name or availability — those are resolved
 * from the catalogue when the link is opened.
 */

import { generateToken } from './tokens';

/** Minimum entropy we accept for a public token. */
export const MIN_TOKEN_LENGTH = 24;

export type QuickOrderLinkState = 'SENT' | 'OPENED' | 'ORDER_CREATED' | 'REVOKED' | 'EXPIRED';

export interface QuickOrderLinkStateInput {
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  orderId?: string | null;
  openedAt?: Date | string | null;
  sentAt?: Date | string | null;
  now?: Date;
}

/** Derives the logical state of a link from its timestamps (never stored). */
export function quickOrderLinkState(input: QuickOrderLinkStateInput): QuickOrderLinkState {
  const now = input.now ?? new Date();
  if (input.revokedAt) return 'REVOKED';
  if (input.expiresAt && new Date(input.expiresAt).getTime() < now.getTime()) return 'EXPIRED';
  if (input.orderId) return 'ORDER_CREATED';
  if (input.openedAt) return 'OPENED';
  return 'SENT';
}

/** Generates a fresh public token. */
export function newQuickOrderToken(): string {
  return generateToken(24);
}

/** True when a token has enough entropy to be treated as unguessable. */
export function isValidTokenFormat(token: string): boolean {
  return typeof token === 'string' && token.length >= MIN_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token);
}
