import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  tailorId: z.string().min(1),
  periodStart: z.string().optional().default(''),
  periodEnd: z.string().optional().default(''),
  adjustmentsBhd: z.number().default(0),
  notes: z.string().max(4000).optional().default(''),
});

function nextNumber() {
  return `STL-${Date.now().toString(36).toUpperCase()}`;
}

export const POST = adminHandler('settlements.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;
  const tailor = await prisma.tailor.findUnique({ where: { id: d.tailorId } });
  if (!tailor) throw new AdminActionError('Tailor not found', 'NOT_FOUND', 404);

  const periodStart = d.periodStart ? new Date(d.periodStart) : null;
  const periodEnd = d.periodEnd ? new Date(d.periodEnd) : null;

  // Completed tasks in the period drive the gross amount from the tailor's rate.
  const tasks = await prisma.productionTask.findMany({
    where: {
      tailorId: d.tailorId,
      status: 'COMPLETED',
      completedAt: {
        ...(periodStart ? { gte: periodStart } : {}),
        ...(periodEnd ? { lte: periodEnd } : {}),
      },
    },
    select: { id: true },
  });

  const grossBhd = tasks.length * Number(tailor.rateBhd);
  const netBhd = grossBhd + d.adjustmentsBhd;

  const settlement = await prisma.tailorSettlement.create({
    data: {
      number: nextNumber(),
      tailorId: d.tailorId,
      periodStart,
      periodEnd,
      tasksCount: tasks.length,
      grossBhd,
      adjustmentsBhd: d.adjustmentsBhd,
      netBhd,
      status: 'PENDING',
      notes: d.notes || null,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'settlement.create', entity: 'TailorSettlement', entityId: settlement.id, metadata: { tailorId: d.tailorId } } });
  return NextResponse.json({ ok: true, id: settlement.id, number: settlement.number, netBhd });
});
