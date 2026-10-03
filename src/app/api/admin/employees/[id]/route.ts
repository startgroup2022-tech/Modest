import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

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
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Employee not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;

  // Guard against removing the last active admin.
  if (existing.roleId && d.roleId !== existing.roleId) {
    const oldRole = await prisma.role.findUnique({ where: { id: existing.roleId } });
    if (oldRole?.name === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: { name: 'ADMIN' }, isActive: true, id: { not: id } } });
      if (admins === 0) return NextResponse.json({ error: 'At least one active admin must remain' }, { status: 409 });
    }
  }

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
      ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'employee.update', entity: 'User', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id });
});
