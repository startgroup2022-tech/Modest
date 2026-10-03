import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.enum(['approve', 'pay', 'cancel']) });

export const PATCH = adminHandler('settlements.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const settlement = await prisma.tailorSettlement.findUnique({ where: { id } });
  if (!settlement) throw new AdminActionError('Settlement not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 422 });

  const map = {
    approve: { status: 'APPROVED' as const, approvedById: admin.id, approvedAt: new Date() },
    pay: { status: 'PAID' as const, paidAt: new Date(), paidBhd: settlement.netBhd },
    cancel: { status: 'CANCELLED' as const },
  };
  await prisma.tailorSettlement.update({ where: { id }, data: map[parsed.data.action] });
  await prisma.auditLog.create({ data: { userId: admin.id, action: `settlement.${parsed.data.action}`, entity: 'TailorSettlement', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id });
});
