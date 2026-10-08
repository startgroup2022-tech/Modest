import 'server-only';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getCurrentUser, type CurrentUser } from './auth';
import { prisma } from './prisma';
import { getEffectivePermissions, type Permission } from './permissions';
import { writeAudit } from './audit';
import { isSameOriginRequest, CSRF_ERROR } from './csrf';

/** HTTP methods that never change state, so origin checks do not apply. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface AdminUser extends CurrentUser {
  /** Effective permissions: role grants merged with per-employee overrides. */
  permissions: Set<Permission>;
}

/** Roles that may ever enter the admin area. */
const STAFF_ROLES = ['ADMIN', 'MANAGER', 'SUPPORT'];

export function isStaff(user: { role: string; sessionKind?: string } | null | undefined): boolean {
  if (!user) return false;
  // A tailor or customer session is never staff, even if a role were mis-set.
  if (user.sessionKind === 'tailor' || user.sessionKind === 'customer') return false;
  return STAFF_ROLES.includes(user.role);
}

/**
 * Resolves the signed-in staff user together with their effective permissions.
 * Returns null for anonymous, non-staff, or stale-session users.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return null;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { roleId: true } });
  const permissions = await getEffectivePermissions(user.id, row?.roleId ?? null);
  return { ...user, permissions };
}

/**
 * Page-level guard. Redirects anonymous visitors to sign-in and staff without
 * the permission back to the dashboard.
 */
export async function requireAdminPage(permission?: Permission, locale = 'en'): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) redirect(`/${locale}/account/sign-in?redirect=/${locale}/admin`);
  if (permission && !admin.permissions.has(permission)) redirect(`/${locale}/admin?denied=${permission}`);
  return admin;
}

export interface ApiGuardResult {
  admin?: AdminUser;
  error?: NextResponse;
}

/** API-level guard — returns a JSON error response instead of redirecting. */
export async function guardApi(permission?: Permission): Promise<ApiGuardResult> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (permission && !admin.permissions.has(permission)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { admin };
}

export interface ApiHandlerContext {
  admin: AdminUser;
  req: Request;
  ip: string;
  searchParams: URLSearchParams;
}

/**
 * Wraps an admin API handler with authentication, permission enforcement and
 * uniform error handling. Stack traces never reach the client.
 */
export function adminHandler(
  permission: Permission | undefined,
  handler: (ctx: ApiHandlerContext) => Promise<NextResponse>,
) {
  return async (req: Request): Promise<NextResponse> => {
    const { admin, error } = await guardApi(permission);
    if (error || !admin) return error!;
    // Cookie-authenticated writes must come from our own origin. SameSite=Lax
    // is the primary defence; this is the explicit check on top of it.
    if (!SAFE_METHODS.has(req.method.toUpperCase()) && !isSameOriginRequest(req)) {
      return NextResponse.json({ error: CSRF_ERROR, code: 'CSRF_BLOCKED' }, { status: 403 });
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    try {
      const url = new URL(req.url);
      return await handler({ admin, req, ip, searchParams: url.searchParams });
    } catch (err) {
      if (err instanceof AdminActionError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      console.error('[admin-api] failed', err);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}

/**
 * Like `adminHandler`, but the handler receives the parsed request body. The
 * body is read once here so individual handlers cannot accidentally read the
 * stream twice.
 */
export function adminBodyHandler<T>(
  permission: Permission | undefined,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown[] } } },
  handler: (ctx: ApiHandlerContext & { body: T }) => Promise<NextResponse>,
) {
  return adminHandler(permission, async (ctx) => {
    const raw = await ctx.req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    return handler({ ...ctx, body: parsed.data });
  });
}

export class AdminActionError extends Error {
  constructor(
    message: string,
    public code = 'ACTION_FAILED',
    public status = 400,
  ) {
    super(message);
    this.name = 'AdminActionError';
  }
}

/** Records a staff action in the audit trail. */
export async function auditAdmin(
  admin: AdminUser,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
  ip?: string | null,
) {
  await writeAudit({ userId: admin.id, action, entity, entityId, metadata, ip });
}

/**
 * Only a super-admin (an active ADMIN-role user) may administer accounts that
 * hold, or would hold, permissions the actor lacks. Managers with
 * `users.manage` can still operate on peers at or below their own authority.
 */
export function isSuperAdmin(admin: AdminUser): boolean {
  return admin.role === 'ADMIN';
}

/**
 * Counts active ADMIN-role users whose *effective* permissions include
 * `users.manage`. Role grants are not enough on their own: a DENY override can
 * strip `users.manage` from an individual admin, so coverage is measured on the
 * resolved permission set. Pass `excludeUserId` to ask "would anyone still be
 * able to manage employees if this account lost the permission?".
 */
export async function countEffectiveAdmins(excludeUserId?: string): Promise<number> {
  const admins = await prisma.user.findMany({
    where: {
      role: { name: 'ADMIN' },
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true, roleId: true, permissionOverrides: { select: { permission: true, effect: true } } },
  });
  let count = 0;
  for (const a of admins) {
    const effective = await getEffectivePermissions(a.id, a.roleId);
    if (effective.has('users.manage')) count += 1;
  }
  return count;
}
