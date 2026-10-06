import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { createSettlement, eligibleSettlementItems, SettlementError } from '@/lib/settlements';

export const dynamic = 'force-dynamic';

const schema = z.object({
  tailorId: z.string().min(1),
  // Preferred: an explicit list of delivered pieces. When omitted, every
  // eligible (delivered, assigned, unsettled) piece in the period is used.
  orderItemIds: z.array(z.string().min(1)).optional(),
  periodStart: z.string().optional().default(''),
  periodEnd: z.string().optional().default(''),
  adjustmentsBhd: z.number().default(0),
  notes: z.string().max(4000).optional().default(''),
});

export const POST = adminHandler('settlements.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;
  const tailor = await prisma.tailor.findUnique({ where: { id: d.tailorId } });
  if (!tailor) throw new AdminActionError('Tailor not found', 'NOT_FOUND', 404);

  const periodStart = d.periodStart ? new Date(d.periodStart) : null;
  const periodEnd = d.periodEnd ? new Date(d.periodEnd) : null;

  // Resolve the explicit pieces to settle. A piece is only ever counted once —
  // the service and a unique index both reject a double settlement.
  let itemIds = d.orderItemIds ?? [];
  if (itemIds.length === 0) {
    const eligible = await eligibleSettlementItems(d.tailorId);
    itemIds = eligible
      .filter((i) => {
        const at = i.assignedAt ?? i.order.deliveredAt;
        if (!at) return true;
        const t = new Date(at).getTime();
        if (periodStart && t < periodStart.getTime()) return false;
        if (periodEnd && t > periodEnd.getTime()) return false;
        return true;
      })
      .map((i) => i.id);
  }

  try {
    const settlement = await createSettlement({
      tailorId: d.tailorId,
      orderItemIds: itemIds,
      periodStart,
      periodEnd,
      adjustmentsBhd: d.adjustmentsBhd,
      notes: d.notes || null,
      actorId: admin.id,
    });
    return NextResponse.json({ ok: true, id: settlement.id, number: settlement.number, netBhd: settlement.netBhd });
  } catch (err) {
    if (err instanceof SettlementError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    throw err;
  }
});
