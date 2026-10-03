import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

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
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'employee.create', entity: 'User', entityId: user.id, metadata: { email: user.email } } });
  return NextResponse.json({ ok: true, id: user.id });
});
