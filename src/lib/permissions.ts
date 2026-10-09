import 'server-only';
import { cache } from 'react';
import { prisma } from './prisma';
import { isPermission, type Permission } from './permission-defs';

export {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  PERMISSION_COUNT,
  DEFAULT_ROLE_PERMISSIONS,
  isPermission,
} from './permission-defs';
export type { Permission } from './permission-defs';

/** The effective permission set for a role, from the database. */
export const getRolePermissions = cache(async (roleId: string | null): Promise<Set<Permission>> => {
  if (!roleId) return new Set();
  const rows = await prisma.rolePermission.findMany({ where: { roleId }, select: { permission: true } });
  const granted = new Set<Permission>();
  for (const r of rows) if (isPermission(r.permission)) granted.add(r.permission);
  return granted;
});

export interface PermissionOverride {
  permission: string;
  effect: 'ALLOW' | 'DENY';
}

/**
 * Effective permissions = (role grants ∪ ALLOW overrides) \ DENY overrides.
 *
 * DENY always wins over ALLOW, so a role that grants a permission can still be
 * narrowed for one employee without editing the role (which would affect
 * everyone). This is a pure function so it can be unit-tested and reused.
 */
export function resolveEffectivePermissions(
  rolePermissions: Iterable<string>,
  overrides: Iterable<PermissionOverride>,
): Set<Permission> {
  const effective = new Set<Permission>();
  for (const p of rolePermissions) if (isPermission(p)) effective.add(p);
  const denies: string[] = [];
  for (const o of overrides) {
    if (!isPermission(o.permission)) continue;
    if (o.effect === 'ALLOW') effective.add(o.permission);
    else denies.push(o.permission);
  }
  for (const p of denies) effective.delete(p as Permission);
  return effective;
}

/**
 * Resolves the effective permissions for a single user by merging their role
 * grants with their individual overrides. Cached per request.
 */
export const getEffectivePermissions = cache(
  async (userId: string, roleId: string | null): Promise<Set<Permission>> => {
    const [rolePermissions, overrides] = await Promise.all([
      getRolePermissions(roleId),
      prisma.userPermission.findMany({
        where: { userId },
        select: { permission: true, effect: true },
      }),
    ]);
    return resolveEffectivePermissions(rolePermissions, overrides);
  },
);

/**
 * Privilege-escalation guard. An administrator may only grant or revoke a
 * permission they themselves hold, unless they are a super-admin (an active
 * ADMIN-role user). This prevents, for example, a manager who can manage
 * employees from minting an account with more authority than they have.
 */
export function canAdministerPermission(
  actor: { role: string; permissions: Set<Permission> },
  permission: string,
): boolean {
  if (actor.role === 'ADMIN') return true;
  return actor.permissions.has(permission as Permission);
}

/**
 * Returns the permissions in `desired` that the actor is not allowed to set.
 * Used to reject a permission save before it mutates anything.
 */
export function forbiddenGrants(
  actor: { role: string; permissions: Set<Permission> },
  desired: Iterable<string>,
): string[] {
  const bad: string[] = [];
  for (const p of desired) if (!canAdministerPermission(actor, p)) bad.push(p);
  return bad;
}

/**
 * Whether a product status change is a publication decision rather than an
 * editorial one. Publishing, unpublishing, archiving or restoring any change of
 * `status` is treated as approval-level, so an employee who may edit product
 * copy cannot silently put a product live (or pull it) without
 * `products.approve`. Keeping a product in its current status needs only
 * `products.edit`.
 */
export function productStatusChangeRequiresApproval(current: string, next: string): boolean {
  return current !== next;
}
