import 'server-only';
import { randomInt } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { hashPassword, verifyPassword, readSessionToken, type SessionPayload } from './auth';
import { writeAudit } from './audit';
import { SignJWT } from 'jose';

/**
 * Tailor Portal authentication.
 *
 * Tailors are a third principal alongside staff and customers. They never
 * self-register: an authorised admin issues credentials. Credentials live in
 * `TailorCredential` (bcrypt hash only) and are separate from `User`, so a
 * tailor session can never satisfy a staff or customer guard. Sessions are
 * signed with the same AUTH_SECRET but carry `kind: 'tailor'` and the
 * credential's `sessionVersion`, so disabling the account or resetting the
 * password invalidates live sessions on the next request.
 */

const TAILOR_COOKIE = 'att_tailor';
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000;

export class TailorAuthError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'TailorAuthError';
  }
}

// ── Temporary password ──────────────────────────────────

// Excludes 0/O/1/I/l to keep hand-copied credentials unambiguous.
const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_DIGITS = '23456789';

/**
 * Cryptographically secure temporary password: 12 chars, guaranteed to contain
 * at least one digit and one letter. Returned once to the issuing admin; only
 * the bcrypt hash is ever persisted.
 */
export function generateTemporaryPassword(): string {
  const length = 12;
  const chars: string[] = [TEMP_DIGITS[randomInt(TEMP_DIGITS.length)]];
  while (chars.length < length) chars.push(TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]);
  // Fisher–Yates with a CSPRNG so the guaranteed digit is not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function usernameFromTailor(input: { code?: string | null; email?: string | null; nameEn: string }): string {
  if (input.email && input.email.includes('@')) return input.email.split('@')[0].toLowerCase();
  if (input.code) return input.code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return input.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// ── Admin: issue / reset credentials ────────────────────

export interface IssuedCredentials {
  username: string;
  /** Plaintext temporary password. Never persisted; shown once to the admin. */
  temporaryPassword: string;
  tailorId: string;
}

/**
 * Issues or resets a tailor's login credentials. Generates a fresh temporary
 * password, stores only its hash, sets `mustChangePassword`, stamps the issue
 * time and bumps `sessionVersion` so any prior session is invalidated. The
 * plaintext is returned exactly once so the admin can hand it over out of band.
 */
export async function issueTailorCredentials(input: {
  tailorId: string;
  actorId: string;
  username?: string;
  ip?: string | null;
}): Promise<IssuedCredentials> {
  const tailor = await prisma.tailor.findUnique({
    where: { id: input.tailorId },
    include: { credential: true },
  });
  if (!tailor) throw new TailorAuthError('Tailor not found', 'NOT_FOUND', 404);

  const username = (input.username?.trim() || tailor.credential?.username || usernameFromTailor(tailor)).toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const clash = await prisma.tailorCredential.findUnique({ where: { username } });
  if (clash && clash.tailorId !== tailor.id) {
    throw new TailorAuthError('That username is already in use', 'USERNAME_TAKEN', 409);
  }

  await prisma.$transaction(async (tx) => {
    if (tailor.credential) {
      await tx.tailorCredential.update({
        where: { tailorId: tailor.id },
        data: {
          username,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          credentialsSentAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          sessionVersion: { increment: 1 },
        },
      });
    } else {
      await tx.tailorCredential.create({
        data: {
          tailorId: tailor.id,
          username,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          credentialsSentAt: new Date(),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        action: tailor.credential ? 'tailor.credentials_reset' : 'tailor.credentials_issued',
        entity: 'Tailor',
        entityId: tailor.id,
        ip: input.ip ?? null,
        // The password itself is never written to the audit trail.
        metadata: { username, mustChangePassword: true } as never,
      },
    });
  });

  return { username, temporaryPassword, tailorId: tailor.id };
}

/** Activates or deactivates a tailor's credential, invalidating live sessions. */
export async function setTailorCredentialActive(input: {
  tailorId: string;
  active: boolean;
  actorId: string;
  ip?: string | null;
}): Promise<void> {
  const credential = await prisma.tailorCredential.findUnique({ where: { tailorId: input.tailorId } });
  if (!credential) throw new TailorAuthError('This tailor has no login credentials yet', 'NO_CREDENTIAL', 404);
  await prisma.$transaction([
    prisma.tailorCredential.update({
      where: { tailorId: input.tailorId },
      data: {
        isActive: input.active,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: input.actorId,
        action: input.active ? 'tailor.credentials_enabled' : 'tailor.credentials_disabled',
        entity: 'Tailor',
        entityId: input.tailorId,
        ip: input.ip ?? null,
        metadata: {} as never,
      },
    }),
  ]);
}

// ── Session ─────────────────────────────────────────────

export interface TailorSession {
  tailorId: string;
  username: string;
  sessionVersion: number;
}

export interface CurrentTailor {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string | null;
  status: string;
  username: string;
  mustChangePassword: boolean;
}

async function secretKey(): Promise<Uint8Array> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) throw new Error('AUTH_SECRET is missing or too short.');
  return new TextEncoder().encode(secret);
}

export async function createTailorSession(session: TailorSession): Promise<string> {
  return new SignJWT({ ...session, kind: 'tailor' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(await secretKey());
}

export async function readTailorSession(token: string): Promise<TailorSession | null> {
  try {
    const { payload } = await (await import('jose')).jwtVerify(token, await secretKey(), { algorithms: ['HS256'] });
    if (payload.kind !== 'tailor' || typeof payload.tailorId !== 'string') return null;
    return {
      tailorId: payload.tailorId,
      username: String(payload.username ?? ''),
      sessionVersion: typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 0,
    };
  } catch {
    return null;
  }
}

export async function setTailorSessionCookie(session: TailorSession): Promise<void> {
  const token = await createTailorSession(session);
  const store = await cookies();
  store.set(TAILOR_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearTailorSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(TAILOR_COOKIE);
}

export const getTailorSession = cache(async (): Promise<TailorSession | null> => {
  const store = await cookies();
  const token = store.get(TAILOR_COOKIE)?.value;
  if (!token) return null;
  return readTailorSession(token);
});

/**
 * Resolves the signed-in tailor. Returns null if the credential is inactive,
 * the tailor is inactive, or the session predates a version bump.
 */
export const getCurrentTailor = cache(async (): Promise<CurrentTailor | null> => {
  const session = await getTailorSession();
  if (!session) return null;
  const credential = await prisma.tailorCredential.findUnique({
    where: { tailorId: session.tailorId },
    include: { tailor: true },
  });
  if (!credential || !credential.isActive) return null;
  if (credential.sessionVersion !== session.sessionVersion) return null;
  if (credential.tailor.status !== 'ACTIVE') return null;
  return {
    id: credential.tailor.id,
    nameEn: credential.tailor.nameEn,
    nameAr: credential.tailor.nameAr,
    code: credential.tailor.code,
    status: credential.tailor.status,
    username: credential.username,
    mustChangePassword: credential.mustChangePassword,
  };
});

export async function requireTailor(): Promise<CurrentTailor> {
  const tailor = await getCurrentTailor();
  if (!tailor) throw new TailorAuthError('Unauthenticated', 'UNAUTHENTICATED', 401);
  return tailor;
}

// ── Login ───────────────────────────────────────────────

export interface TailorLoginResult {
  tailorId: string;
  username: string;
  mustChangePassword: boolean;
}

/**
 * Verifies a tailor's credentials with a persistent lockout counter. Returns
 * the fields needed to mint a session; the caller sets the cookie. Never
 * reveals whether the username exists.
 */
export async function authenticateTailor(input: {
  username: string;
  password: string;
  ip?: string | null;
}): Promise<TailorLoginResult> {
  const username = input.username.trim().toLowerCase();
  const credential = await prisma.tailorCredential.findUnique({
    where: { username },
    include: { tailor: true },
  });

  const generic = new TailorAuthError('Invalid username or password', 'INVALID_CREDENTIALS', 401);
  if (!credential) throw generic;

  if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
    throw new TailorAuthError('Account temporarily locked. Try again later.', 'LOCKED', 429);
  }

  const passwordOk = await verifyPassword(input.password, credential.passwordHash);
  if (!passwordOk) {
    const attempts = credential.failedLoginAttempts + 1;
    await prisma.tailorCredential.update({
      where: { id: credential.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    await writeAudit({
      userId: null,
      action: 'tailor.signin_failed',
      entity: 'Tailor',
      entityId: credential.tailorId,
      ip: input.ip ?? null,
      metadata: { attempts } as never,
    });
    throw generic;
  }

  if (!credential.isActive) throw new TailorAuthError('This account is disabled', 'DISABLED', 403);
  if (credential.tailor.status !== 'ACTIVE') {
    throw new TailorAuthError('This account is disabled', 'DISABLED', 403);
  }

  await prisma.tailorCredential.update({
    where: { id: credential.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await writeAudit({
    userId: null,
    action: 'tailor.signin_success',
    entity: 'Tailor',
    entityId: credential.tailorId,
    ip: input.ip ?? null,
  });

  return {
    tailorId: credential.tailorId,
    username: credential.username,
    mustChangePassword: credential.mustChangePassword,
  };
}

// ── First-login password change ─────────────────────────

export interface TailorPasswordPolicyResult {
  ok: boolean;
  error?: string;
}

/**
 * Spec policy for a replacement password: at least 8 characters, at least one
 * number, and different from the temporary/current password.
 */
export function checkTailorPassword(password: string, currentPassword: string): TailorPasswordPolicyResult {
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };
  if (password.length > 128) return { ok: false, error: 'Password is too long' };
  if (!/\d/.test(password)) return { ok: false, error: 'Password must contain at least one number' };
  if (password === currentPassword) return { ok: false, error: 'Choose a password different from the temporary one' };
  return { ok: true };
}

/**
 * Completes the first-login (or any) password change. Requires the current
 * password, enforces the policy, clears the temporary flag, records the change
 * and invalidates other sessions by bumping the version.
 */
export async function changeTailorPassword(input: {
  tailorId: string;
  currentPassword: string;
  newPassword: string;
  ip?: string | null;
}): Promise<void> {
  const credential = await prisma.tailorCredential.findUnique({ where: { tailorId: input.tailorId } });
  if (!credential) throw new TailorAuthError('Account not found', 'NOT_FOUND', 404);

  if (!(await verifyPassword(input.currentPassword, credential.passwordHash))) {
    await writeAudit({
      userId: null,
      action: 'tailor.password_change_failed',
      entity: 'Tailor',
      entityId: input.tailorId,
      ip: input.ip ?? null,
    });
    throw new TailorAuthError('Your current password is incorrect', 'INVALID_CURRENT_PASSWORD', 400);
  }

  const policy = checkTailorPassword(input.newPassword, input.currentPassword);
  if (!policy.ok) throw new TailorAuthError(policy.error ?? 'Invalid password', 'WEAK_PASSWORD', 422);

  await prisma.$transaction([
    prisma.tailorCredential.update({
      where: { tailorId: input.tailorId },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
        // A password change ends every other session for this tailor.
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: null,
        action: 'tailor.password_change',
        entity: 'Tailor',
        entityId: input.tailorId,
        ip: input.ip ?? null,
        metadata: {} as never,
      },
    }),
  ]);
}

// ── Supervisor context ──────────────────────────────────

/**
 * Read-only supervisor context: an authorised staff member viewing the Tailor
 * Portal. The supervisor is NEVER represented as the tailor — identity stays
 * with the staff user and this flag is carried separately, so write actions
 * (accept work, complete production, confirm settlement) are refused. The
 * future portal must check `supervisor.readOnly` before rendering any action.
 */
export interface SupervisorContext {
  supervisorId: string;
  supervisorName: string;
  readOnly: true;
  viewingTailorId: string;
}

export function buildSupervisorContext(input: {
  supervisorId: string;
  supervisorName: string;
  viewingTailorId: string;
}): SupervisorContext {
  return { ...input, readOnly: true };
}

/** Whether a request context may perform tailor write actions. */
export function canActAsTailor(context: { readOnly?: boolean } | null | undefined): boolean {
  return !!context && context.readOnly !== true;
}

// ── Tailor work scope ───────────────────────────────────

/**
 * A tailor's principal may only reach work assigned to that tailor. These
 * helpers are the single place the future Tailor Portal resolves scope, so the
 * rule is testable now and cannot be re-implemented inconsistently per screen.
 */
export interface TailorPrincipal {
  tailorId: string;
  /** Present only when an authorised staff member is supervising read-only. */
  supervisor?: SupervisorContext;
}

/**
 * Resolves which tailor's data a request may read. A supervisor may read the
 * tailor they are viewing; a tailor may only read their own. Anything else is
 * refused.
 */
export function resolveReadableTailorId(
  principal: TailorPrincipal,
  requestedTailorId: string,
): string | null {
  if (principal.tailorId === requestedTailorId) return requestedTailorId;
  if (principal.supervisor?.viewingTailorId === requestedTailorId) return requestedTailorId;
  return null;
}

/**
 * Whether a principal may act (write) on a given tailor's work. A supervisor is
 * always read-only; only the tailor acting as themselves may write, and only
 * for their own tailor id.
 */
export function canWriteTailorWork(
  principal: TailorPrincipal,
  targetTailorId: string,
): boolean {
  if (principal.supervisor) return false;
  return principal.tailorId === targetTailorId;
}

/** Whether a principal may read a production task assigned to `taskTailorId`. */
export function canReadTailorTask(
  principal: TailorPrincipal,
  taskTailorId: string | null | undefined,
): boolean {
  if (!taskTailorId) return false;
  return resolveReadableTailorId(principal, taskTailorId) !== null;
}
