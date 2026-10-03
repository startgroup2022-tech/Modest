import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const num = z.number().nullable().optional();
const schema = z.object({
  name: z.string().min(1).max(120).default('My measurements'),
  unit: z.enum(['cm', 'in']).default('cm'),
  height: num, shoulder: num, bust: num, waist: num, hip: num, sleeve: num, armhole: num, length: num,
  notes: z.string().max(2000).optional().default(''),
  isDefault: z.boolean().default(false),
});

export const POST = adminHandler('measurements.edit', async ({ admin, req }) => {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 3]; // /api/admin/customers/[id]/measurements
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new AdminActionError('Customer not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    if (d.isDefault) await tx.measurement.updateMany({ where: { customerId: id }, data: { isDefault: false } });
    return tx.measurement.create({
      data: {
        customerId: id, name: d.name, unit: d.unit,
        height: d.height ?? null, shoulder: d.shoulder ?? null, bust: d.bust ?? null, waist: d.waist ?? null,
        hip: d.hip ?? null, sleeve: d.sleeve ?? null, armhole: d.armhole ?? null, length: d.length ?? null,
        notes: d.notes || null, isDefault: d.isDefault,
      },
    });
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'measurement.create', entity: 'Measurement', entityId: created.id, metadata: { customerId: id } } });
  return NextResponse.json({ ok: true, id: created.id });
});
