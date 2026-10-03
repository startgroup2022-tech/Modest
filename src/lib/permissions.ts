import 'server-only';
import { cache } from 'react';
import { prisma } from './prisma';
import { isPermission, type Permission } from './permission-defs';

export {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
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
