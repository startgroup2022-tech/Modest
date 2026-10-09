import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError, isSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getRolePermissions, forbiddenGrants } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  jobTitle: z.string().max(120).optional().default(''),
  roleId: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  password: z.string().min(8).max(200),
  locale: z.enum(['en', 'ar']).default('en'),
});

export const POST = adminHandler('users.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;

  const role = await prisma.role.findUnique({ where: { id: d.roleId } });
  if (!role) throw new AdminActionError('Role not found', 'NOT_FOUND', 404);

  // Privilege escalation guard: a non-super-admin may not create an account
  // whose role carries permissions they do not themselves hold.
  if (!isSuperAdmin(admin)) {
    const rolePerms = await getRolePermissions(role.id);
    const forbidden = forbiddenGrants(admin, rolePerms);
    if (forbidden.length) {
      return NextResponse.json(
        { error: 'You cannot create an account with permissions you do not hold', code: 'PRIVILEGE_ESCALATION', permissions: forbidden },
        { status: 403 },
      );
    }
  }

  const dupe = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
  if (dupe) return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      email: d.email.toLowerCase(),
      firstName: d.firstName,
      lastName: d.lastName || null,
      phone: d.phone || null,
      jobTitle: d.jobTitle || null,
      roleId: d.roleId,
      status: d.status,
      locale: d.locale,
      passwordHash: await hashPassword(d.password),
      isActive: d.status === 'ACTIVE',
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'employee.create',
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: role.name, jobTitle: d.jobTitle || null } as never,
    },
  });
  return NextResponse.json({ ok: true, id: user.id });
});
