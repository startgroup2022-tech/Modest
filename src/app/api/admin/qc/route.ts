import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['PASSED', 'FAILED', 'REWORK_REQUIRED']),
  measurementsOk: z.boolean().default(false),
  stitchingOk: z.boolean().default(false),
  fabricOk: z.boolean().default(false),
  finishingOk: z.boolean().default(false),
  accessoriesOk: z.boolean().default(false),
  packagingOk: z.boolean().default(false),
  notes: z.string().max(4000).optional().default(''),
});

export const POST = adminHandler('qc.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  const task = await prisma.productionTask.findUnique({ where: { id: d.taskId } });
  if (!task) throw new AdminActionError('Task not found', 'NOT_FOUND', 404);

  const record = await prisma.$transaction(async (tx) => {
    const rec = await tx.qcRecord.create({
      data: {
        taskId: d.taskId,
        status: d.status,
        measurementsOk: d.measurementsOk,
        stitchingOk: d.stitchingOk,
        fabricOk: d.fabricOk,
        finishingOk: d.finishingOk,
        accessoriesOk: d.accessoriesOk,
        packagingOk: d.packagingOk,
        notes: d.notes || null,
        checkedById: admin.id,
        checkedAt: new Date(),
      },
    });
    await tx.productionTask.update({
      where: { id: d.taskId },
      data: { status: d.status === 'PASSED' ? 'COMPLETED' : 'REWORK', completedAt: d.status === 'PASSED' ? new Date() : null },
    });
    return rec;
  });

  await prisma.auditLog.create({ data: { userId: admin.id, action: 'qc.run', entity: 'QcRecord', entityId: record.id, metadata: { status: d.status } } });
  return NextResponse.json({ ok: true, id: record.id });
});
