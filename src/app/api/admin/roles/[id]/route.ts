import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError, isSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { isPermission, forbiddenGrants } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const schema = z.object({ permissions: z.array(z.string()).max(200) });

export const PATCH = adminHandler('roles.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AdminActionError('Role not found', 'NOT_FOUND', 404);
  if (role.name === 'ADMIN') return NextResponse.json({ error: 'The admin role always holds every permission' }, { status: 409 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const valid = parsed.data.permissions.filter(isPermission);

  // A non-super-admin cannot widen a role template beyond their own authority.
  if (!isSuperAdmin(admin)) {
    const forbidden = forbiddenGrants(admin, valid);
    if (forbidden.length) {
      return NextResponse.json(
        { error: 'You cannot grant permissions you do not hold', code: 'PRIVILEGE_ESCALATION', permissions: forbidden },
        { status: 403 },
      );
    }
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({ data: valid.map((permission) => ({ roleId: id, permission })) }),
  ]);
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'role.permissions', entity: 'Role', entityId: id, metadata: { count: valid.length } } });
  return NextResponse.json({ ok: true, id, count: valid.length });
});
