/**
 * Quick Order link rules (pure, no DB/React dependency).
 *
 * A Quick Order link is an opaque, high-entropy handle that opens a
 * server-resolved product page for one customer. Nothing trusted — price,
 * product name, tailoring fee, availability, measurement requirements or the
 * payable amount — is ever encoded in the URL. Every one of those is resolved
 * from the database when the link is opened, so tampering with the URL cannot
 * change what the customer pays or what they are shown.
 */

import { generateToken } from './tokens';

/** Minimum entropy we accept for a public token (bytes of randomness). */
export const QUICK_ORDER_TOKEN_BYTES = 24;
export const MIN_TOKEN_LENGTH = 24;
/** Default lifetime of a link, in days. */
export const DEFAULT_TTL_DAYS = 30;

/**
 * Lifecycle states are always derived from timestamps, never stored, so they
 * can never drift from the underlying facts.
 *
 * - GENERATED       — created, no send action initiated yet.
 * - SEND_INITIATED  — staff opened a WhatsApp deep link (or otherwise started a
 *                     send). This is explicitly NOT "delivered": no messaging
 *                     provider confirms delivery, so we never claim it.
 * - OPENED          — a customer actually opened a valid link.
 * - ORDER_CREATED   — an order was created from the link.
 * - REVOKED         — staff revoked it.
 * - EXPIRED         — its lifetime elapsed.
 */
export type QuickOrderLinkState =
  | 'GENERATED'
  | 'SEND_INITIATED'
  | 'OPENED'
  | 'ORDER_CREATED'
  | 'REVOKED'
  | 'EXPIRED';

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
  // Revocation is an explicit staff decision and always wins.
  if (input.revokedAt) return 'REVOKED';
  if (input.expiresAt && new Date(input.expiresAt).getTime() < now.getTime()) return 'EXPIRED';
  if (input.orderId) return 'ORDER_CREATED';
  if (input.openedAt) return 'OPENED';
  if (input.sentAt) return 'SEND_INITIATED';
  return 'GENERATED';
}

/** True when the link may still be used to open the product and place an order. */
export function isQuickOrderLinkUsable(state: QuickOrderLinkState): boolean {
  return state === 'GENERATED' || state === 'SEND_INITIATED' || state === 'OPENED';
}

/** Generates a fresh public token (high-entropy, URL-safe). */
export function newQuickOrderToken(): string {
  return generateToken(QUICK_ORDER_TOKEN_BYTES);
}

/** True when a token has enough entropy to be treated as unguessable. */
export function isValidTokenFormat(token: string): boolean {
  return (
    typeof token === 'string' &&
    token.length >= MIN_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(token)
  );
}

/** The short, non-secret suffix kept for staff display. */
export function tokenLast4(token: string): string {
  return token.slice(-4);
}

/** Digits-only form of a phone number, for building a wa.me deep link. */
export function normalizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Builds a WhatsApp click-to-chat deep link. Opening it only *initiates* a
 * send in the staff member's own WhatsApp client — there is no provider
 * callback, so the system never records this as delivered. Returns null when
 * the phone is missing or unusable, so the caller can require it explicitly.
 */
export function buildWhatsAppDeepLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = normalizePhoneForWhatsApp(phone);
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** The localized message a staff member sends alongside a Quick Order link. */
export function quickOrderMessage(locale: 'en' | 'ar', productName: string, url: string): string {
  if (locale === 'ar') {
    return `طلبك السريع من Attention: ${productName}\n${url}`;
  }
  return `Your Attention Quick Order: ${productName}\n${url}`;
}

/** The public path for a token, locale-prefixed. */
export function quickOrderPath(locale: 'en' | 'ar', token: string): string {
  return `/${locale}/q/${token}`;
}

/** The absolute public URL for a token. */
export function quickOrderUrl(baseUrl: string, locale: 'en' | 'ar', token: string): string {
  return `${baseUrl.replace(/\/$/, '')}${quickOrderPath(locale, token)}`;
}
