import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError, isSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { bumpSessionVersion } from '@/lib/auth';
import {
  isPermission,
  getRolePermissions,
  forbiddenGrants,
  resolveEffectivePermissions,
} from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const schema = z.object({
  overrides: z
    .array(z.object({ permission: z.string(), effect: z.enum(['ALLOW', 'DENY']) }))
    .max(200),
});

/**
 * Atomically replaces an employee's individual permission overrides. Requires
 * `users.manage`; a non-super-admin may only grant/revoke permissions they hold
 * themselves. Every write bumps the employee's session version so the change
 * applies to their live session on the next request, and is audited with the
 * exact permissions added and removed.
 */
export const PUT = adminHandler('users.manage', async ({ admin, req, ip }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).slice(-2)[0];
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: true, permissionOverrides: true },
  });
  if (!existing) throw new AdminActionError('Employee not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });

  // Deduplicate by permission; a later entry wins.
  const byPermission = new Map<string, 'ALLOW' | 'DENY'>();
  for (const o of parsed.data.overrides) {
    if (isPermission(o.permission)) byPermission.set(o.permission, o.effect);
  }
  const desired = [...byPermission.entries()].map(([permission, effect]) => ({ permission, effect }));

  if (!isSuperAdmin(admin)) {
    const forbidden = forbiddenGrants(admin, desired.map((o) => o.permission));
    if (forbidden.length) {
      return NextResponse.json(
        { error: 'You cannot grant permissions you do not hold', code: 'PRIVILEGE_ESCALATION', permissions: forbidden },
        { status: 403 },
      );
    }
  }

  // Self-protection: an administrator must not strip their own ability to
  // administer employees, which would make the permission system unmanageable.
  if (existing.id === admin.id) {
    const after = resolveEffectivePermissions(await getRolePermissions(existing.roleId), desired);
    if (admin.role !== 'ADMIN' && !after.has('users.manage')) {
      return NextResponse.json(
        { error: 'You cannot remove your own employee-management permission', code: 'SELF_LOCKOUT' },
        { status: 409 },
      );
    }
  }

  const before = resolveEffectivePermissions(
    await getRolePermissions(existing.roleId),
    existing.permissionOverrides.map((o) => ({ permission: o.permission, effect: o.effect })),
  );
  const after = resolveEffectivePermissions(await getRolePermissions(existing.roleId), desired);
  const added = [...after].filter((p) => !before.has(p));
  const removed = [...before].filter((p) => !after.has(p));

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId: id } });
    if (desired.length) {
      await tx.userPermission.createMany({
        data: desired.map((o) => ({ userId: id, permission: o.permission, effect: o.effect })),
        skipDuplicates: true,
      });
    }
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: 'employee.permissions',
        entity: 'User',
        entityId: id,
        ip,
        metadata: { added, removed, effectiveCount: after.size } as never,
      },
    });
  });

  await bumpSessionVersion(id);
  return NextResponse.json({ ok: true, id, added, removed, effectiveCount: after.size });
});
