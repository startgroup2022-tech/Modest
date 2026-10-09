import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { runQcInspection, QcError } from '@/lib/qc';

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
    // Mandatory whenever the result is not PASSED; enforced by the service.
    rejectionReason: z.string().max(2000).optional().default(''),
    notes: z.string().max(4000).optional().default(''),
    // Status the client observed when it opened the piece; guards against two
    // inspectors recording conflicting decisions on the same piece.
    expectedStatus: z.string().max(40).optional(),
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

  try {
    const record = await runQcInspection({
      taskId: d.taskId,
      result: d.status,
      checklist: {
        measurementsOk: d.measurementsOk,
        stitchingOk: d.stitchingOk,
        fabricOk: d.fabricOk,
        finishingOk: d.finishingOk,
        accessoriesOk: d.accessoriesOk,
        packagingOk: d.packagingOk,
      },
      rejectionReason: d.rejectionReason,
      notes: d.notes,
      actorId: admin.id,
      expectedStatus: d.expectedStatus ?? null,
    });
    return NextResponse.json({ ok: true, id: record.id, attempt: record.attempt });
  } catch (err) {
    if (err instanceof QcError) {
      if (err.code === 'NOT_FOUND') throw new AdminActionError(err.message, err.code, err.status);
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
});
