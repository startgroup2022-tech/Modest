import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { QC_ALLOWED_STATES } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    taskId: z.string().min(1),
    status: z.enum(['PASSED', 'FAILED', 'REWORK_REQUIRED']),
    measurementsOk: z.boolean().default(false),
    stitchingOk: z.boolean().default(false),
    fabricOk: z.boolean().default(false),
    finishingOk: z.boolean().default(false),
    accessoriesOk: z.boolean().default(false),
    packagingOk: z.boolean().default(false),
    // Mandatory whenever the result is not PASSED; enforced below.
    rejectionReason: z.string().max(2000).optional().default(''),
    notes: z.string().max(4000).optional().default(''),
  })
  .refine((d) => d.status === 'PASSED' || d.rejectionReason.trim().length > 0, {
    message: 'A rejection reason is required when quality control does not pass',
    path: ['rejectionReason'],
  });

export const POST = adminHandler('qc.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;
  const task = await prisma.productionTask.findUnique({ where: { id: d.taskId } });
  if (!task) throw new AdminActionError('Task not found', 'NOT_FOUND', 404);

  // Quality control only makes sense once work is under way. Rejecting QC on a
  // task that never started (or was cancelled) prevents a phantom "PASSED".
  if (!QC_ALLOWED_STATES.includes(task.status)) {
    return NextResponse.json(
      { error: `Cannot run QC on a task in ${task.status} state`, code: 'INVALID_TRANSITION' },
      { status: 409 },
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    // Attempt number continues the item's QC history; history is never
    // overwritten — each run appends a new immutable row.
    const previous = await tx.qcRecord.count({ where: { taskId: d.taskId } });
    const rec = await tx.qcRecord.create({
      data: {
        taskId: d.taskId,
        orderItemId: task.orderItemId ?? null,
        tailorId: task.tailorId ?? null,
        attempt: previous + 1,
        status: d.status,
        measurementsOk: d.measurementsOk,
        stitchingOk: d.stitchingOk,
        fabricOk: d.fabricOk,
        finishingOk: d.finishingOk,
        accessoriesOk: d.accessoriesOk,
        packagingOk: d.packagingOk,
        rejectionReason: d.status === 'PASSED' ? null : d.rejectionReason.trim(),
        notes: d.notes || null,
        checkedById: admin.id,
        checkedAt: new Date(),
      },
    });
    await tx.productionTask.update({
      where: { id: d.taskId },
      data: {
        status: d.status === 'PASSED' ? 'COMPLETED' : 'REWORK',
        completedAt: d.status === 'PASSED' ? new Date() : null,
      },
    });
    return rec;
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'qc.run',
      entity: 'QcRecord',
      entityId: record.id,
      metadata: { status: d.status, attempt: record.attempt, orderItemId: task.orderItemId ?? null } as never,
    },
  });
  return NextResponse.json({ ok: true, id: record.id, attempt: record.attempt });
});
