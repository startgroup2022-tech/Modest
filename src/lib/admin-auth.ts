import 'server-only';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getCurrentUser, type CurrentUser } from './auth';
import { prisma } from './prisma';
import { getRolePermissions, type Permission } from './permissions';
import { writeAudit } from './audit';

export interface AdminUser extends CurrentUser {
  permissions: Set<Permission>;
}

/** Roles that may ever enter the admin area. */
const STAFF_ROLES = ['ADMIN', 'MANAGER', 'SUPPORT'];

export function isStaff(user: { role: string } | null | undefined): boolean {
  return !!user && STAFF_ROLES.includes(user.role);
}

/**
 * Resolves the signed-in staff user together with their effective permissions.
 * Returns null for anonymous or non-staff users.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return null;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { roleId: true } });
  const permissions = await getRolePermissions(row?.roleId ?? null);
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
