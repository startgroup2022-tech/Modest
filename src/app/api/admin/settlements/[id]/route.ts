import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { applySettlementAction, SettlementError } from '@/lib/settlements';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    action: z.enum(['approve', 'transfer', 'pay', 'confirm', 'cancel']),
    transferProofUrl: z.string().max(2000).optional(),
    transferReference: z.string().max(300).optional(),
    note: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.action !== 'transfer' ||
      Boolean((d.transferProofUrl ?? '').trim() || (d.transferReference ?? '').trim()),
    { message: 'A transfer proof (file or reference) is required', path: ['transferProofUrl'] },
  );

export const PATCH = adminHandler('settlements.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const settlement = await prisma.tailorSettlement.findUnique({ where: { id } });
  if (!settlement) throw new AdminActionError('Settlement not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid action', issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  try {
    const updated = await applySettlementAction({
      settlementId: id,
      action: d.action,
      actorId: admin.id,
      transferProofUrl: d.transferProofUrl || null,
      transferReference: d.transferReference || null,
      note: d.note || null,
    });
    return NextResponse.json({ ok: true, id, status: updated.status });
  } catch (err) {
    if (err instanceof SettlementError) {
      const status = err.code === 'INVALID_TRANSITION' ? 409 : 422;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
});
