import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { tailorSchema } from '@/lib/admin/schemas';

export const dynamic = 'force-dynamic';

export const POST = adminHandler('tailors.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = tailorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;
  const row = await prisma.tailor.create({
    data: { ...d, code: d.code || null, phone: d.phone || null, email: d.email || null, specialization: d.specialization || null, notes: d.notes || null },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'tailor.create', entity: 'Tailor', entityId: row.id, metadata: {} } });
  return NextResponse.json({ ok: true, id: row.id });
});
