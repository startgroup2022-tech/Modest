import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['assign', 'start', 'complete', 'rework', 'cancel', 'priority', 'due']).optional(),
  tailorId: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(4000).optional(),
});

export const PATCH = adminHandler('production.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const task = await prisma.productionTask.findUnique({ where: { id } });
  if (!task) throw new AdminActionError('Task not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.notes !== undefined) data.notes = d.notes || null;

  switch (d.action) {
    case 'assign':
      data.tailorId = d.tailorId ?? null;
      data.status = d.tailorId ? 'ASSIGNED' : 'PENDING';
      break;
    case 'start':
      data.status = 'IN_PROGRESS';
      data.startedAt = new Date();
      break;
    case 'complete':
      data.status = 'COMPLETED';
      data.completedAt = new Date();
      break;
    case 'rework':
      data.status = 'REWORK';
      data.completedAt = null;
      break;
    case 'cancel':
      data.status = 'CANCELLED';
      break;
    case 'priority':
      if (d.priority) data.priority = d.priority;
      break;
    case 'due':
      data.dueDate = d.dueDate ? new Date(d.dueDate) : null;
      break;
    default:
      break;
  }

  await prisma.productionTask.update({ where: { id }, data: data as never });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: `production.${d.action ?? 'update'}`, entity: 'ProductionTask', entityId: id, metadata: data as never },
  });
  return NextResponse.json({ ok: true, id });
});
