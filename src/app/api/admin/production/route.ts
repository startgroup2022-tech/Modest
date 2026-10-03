import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().min(1),
  orderItemId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  tailorId: z.string().nullable().optional(),
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().max(200).optional().default(''),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueDate: z.string().optional().default(''),
  notes: z.string().max(4000).optional().default(''),
});

function nextCode() {
  return `TSK-${Date.now().toString(36).toUpperCase()}`;
}

export const POST = adminHandler('production.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: d.orderId } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const due = d.dueDate ? new Date(d.dueDate) : null;
  const task = await prisma.productionTask.create({
    data: {
      code: nextCode(),
      orderId: d.orderId,
      orderItemId: d.orderItemId || null,
      productId: d.productId || null,
      tailorId: d.tailorId || null,
      titleEn: d.titleEn,
      titleAr: d.titleAr || null,
      priority: d.priority,
      status: d.tailorId ? 'ASSIGNED' : 'PENDING',
      dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
      notes: d.notes || null,
      createdById: admin.id,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'production.create', entity: 'ProductionTask', entityId: task.id, metadata: { orderId: d.orderId } } });
  return NextResponse.json({ ok: true, id: task.id, code: task.code });
});
