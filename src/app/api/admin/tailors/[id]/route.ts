import { NextResponse } from 'next/server';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { tailorSchema } from '@/lib/admin/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = adminHandler('tailors.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.tailor.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Tailor not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = tailorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  await prisma.tailor.update({
    where: { id },
    data: { ...d, code: d.code || null, phone: d.phone || null, email: d.email || null, specialization: d.specialization || null, notes: d.notes || null },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'tailor.update', entity: 'Tailor', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('tailors.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  await prisma.tailor.update({ where: { id }, data: { status: 'INACTIVE' } });
  return NextResponse.json({ ok: true, deactivated: true });
});
