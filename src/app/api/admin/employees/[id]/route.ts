import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError, isSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, bumpSessionVersion } from '@/lib/auth';
import { getRolePermissions, forbiddenGrants } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const schema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  jobTitle: z.string().max(120).optional().default(''),
  roleId: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  password: z.string().max(200).optional().default(''),
});

export const PATCH = adminHandler('users.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!existing) throw new AdminActionError('Employee not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;

  const role = await prisma.role.findUnique({ where: { id: d.roleId } });
  if (!role) throw new AdminActionError('Role not found', 'NOT_FOUND', 404);

  // Self-protection: an employee may not disable, suspend, or demote themselves
  // — that would lock them out and is a common footgun.
  const isSelf = existing.id === admin.id;
  if (isSelf && d.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'You cannot disable your own account', code: 'SELF_DISABLE' }, { status: 409 });
  }
  if (isSelf && d.roleId !== existing.roleId) {
    return NextResponse.json({ error: 'You cannot change your own role', code: 'SELF_ROLE' }, { status: 409 });
  }

  // Privilege escalation guard: only a super-admin may move an account onto a
  // role carrying permissions the actor does not hold.
  if (!isSuperAdmin(admin)) {
    const rolePerms = await getRolePermissions(role.id);
    const forbidden = forbiddenGrants(admin, rolePerms);
    if (forbidden.length) {
      return NextResponse.json(
        { error: 'You cannot assign a role with permissions you do not hold', code: 'PRIVILEGE_ESCALATION', permissions: forbidden },
        { status: 403 },
      );
    }
  }

  // Guard against removing the last active super-admin (role ADMIN, active).
  const losingAdmin = existing.role?.name === 'ADMIN' && (d.roleId !== existing.roleId || d.status !== 'ACTIVE');
  if (losingAdmin) {
    const remaining = await prisma.user.count({
      where: { role: { name: 'ADMIN' }, isActive: true, id: { not: id } },
    });
    if (remaining === 0) {
      return NextResponse.json({ error: 'At least one active administrator must remain', code: 'LAST_ADMIN' }, { status: 409 });
    }
  }

  const statusChanged = existing.status !== d.status || existing.isActive !== (d.status === 'ACTIVE');
  const roleChanged = existing.roleId !== d.roleId;
  const passwordChanged = Boolean(d.password);

  await prisma.user.update({
    where: { id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName || null,
      phone: d.phone || null,
      jobTitle: d.jobTitle || null,
      roleId: d.roleId,
      status: d.status,
      isActive: d.status === 'ACTIVE',
      ...(passwordChanged ? { passwordHash: await hashPassword(d.password) } : {}),
    },
  });

  // Any of these invalidates live sessions for the affected employee, so a
  // disabled account cannot be used with an old cookie.
  if (statusChanged || roleChanged || passwordChanged) {
    await bumpSessionVersion(id);
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'employee.update',
      entity: 'User',
      entityId: id,
      metadata: { roleChanged, statusChanged, passwordChanged, newStatus: d.status } as never,
    },
  });
  return NextResponse.json({ ok: true, id });
});
