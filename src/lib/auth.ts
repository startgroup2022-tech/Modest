import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { prisma } from './prisma';
import { authSecretKey } from './secrets';

const COOKIE_NAME = 'att_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Who a session belongs to. A tailor session can never satisfy a staff guard. */
export type SessionKind = 'staff' | 'customer' | 'tailor';

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  customerId?: string | null;
  /** Account kind, used to keep staff / customer / tailor boundaries explicit. */
  kind?: SessionKind;
  /**
   * Snapshot of the account's `sessionVersion`. When an admin disables the
   * account, changes its permissions, or resets a password, the DB value is
   * incremented and every existing token is rejected on its next use.
   */
  sessionVersion?: number;
}

function secretKey(): Uint8Array {
  return authSecretKey();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (typeof payload.userId !== 'string') return null;
    const kind = payload.kind;
    return {
      userId: payload.userId,
      email: String(payload.email ?? ''),
      role: String(payload.role ?? 'CUSTOMER'),
      customerId: (payload.customerId as string | null) ?? null,
      kind: kind === 'staff' || kind === 'customer' || kind === 'tailor' ? kind : undefined,
      sessionVersion: typeof payload.sessionVersion === 'number' ? payload.sessionVersion : undefined,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionToken(token);
});

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  customerId: string | null;
  locale: string;
  /** Account kind from the session; used to enforce role boundaries. */
  sessionKind: SessionKind | undefined;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true, customer: true },
  });
  if (!user || !user.isActive) return null;
  // A session minted before a permission change / disable carries a stale
  // version and is refused here — revocation takes effect on the next request,
  // not after the cookie's 30-day expiry.
  if (session.sessionVersion !== undefined && session.sessionVersion !== user.sessionVersion) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role?.name ?? 'CUSTOMER',
    customerId: user.customer?.id ?? null,
    locale: user.locale,
    sessionKind: session.kind,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!['ADMIN', 'MANAGER', 'SUPPORT'].includes(user.role)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}

export function isAdminRole(role: string | undefined | null): boolean {
  return !!role && ['ADMIN', 'MANAGER', 'SUPPORT'].includes(role);
}

/**
 * Invalidates every live session for a user by advancing their session version.
 * Call whenever an account is disabled, its permissions change, or its role
 * changes. The current request's own cookie is not refreshed here — the caller
 * decides whether the acting admin's own session should be renewed.
 */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return updated.sessionVersion;
}
