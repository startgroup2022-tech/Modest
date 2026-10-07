import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { PRODUCTION_TRANSITIONS, canTransition } from '@/lib/workflow';

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

  // Reassigning a task to a different tailor (or unassigning it) is an
  // assignment decision and requires `orders.assign`, not merely the ability to
  // manage the production queue.
  if (d.action === 'assign' && d.tailorId !== task.tailorId && !admin.permissions.has('orders.assign')) {
    return NextResponse.json({ error: 'You cannot assign tailors', code: 'ASSIGN_FORBIDDEN' }, { status: 403 });
  }

  // Resolve the status this action would produce, then validate the edge.
  let target: string | null = null;
  if (d.action === 'assign') target = d.tailorId ? 'ASSIGNED' : 'PENDING';
  else if (d.action === 'start') target = 'IN_PROGRESS';
  else if (d.action === 'complete') target = 'COMPLETED';
  else if (d.action === 'rework') target = 'REWORK';
  else if (d.action === 'cancel') target = 'CANCELLED';

  if (target) {
    if (!canTransition(PRODUCTION_TRANSITIONS, task.status, target)) {
      return NextResponse.json(
        { error: `Cannot ${d.action} a task in ${task.status} state`, code: 'INVALID_TRANSITION' },
        { status: 409 },
      );
    }
  } else if (task.status === 'CANCELLED' || task.status === 'COMPLETED') {
    // No cosmetic edits to a finished/cancelled task.
    if (d.priority !== undefined || d.dueDate !== undefined) {
      return NextResponse.json(
        { error: `Cannot edit a task in ${task.status} state`, code: 'INVALID_TRANSITION' },
        { status: 409 },
      );
    }
  }

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
