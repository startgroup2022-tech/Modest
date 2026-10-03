import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { createRefund } from '@/lib/admin/orders';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().min(1),
  amountBhd: z.number().positive().max(1_000_000),
  method: z.enum(['BANK_TRANSFER', 'BENEFIT', 'TAPP', 'CASH', 'STORE_CREDIT']),
  reference: z.string().max(200).optional(),
  reason: z.string().max(500).optional(),
});

export const POST = adminHandler('orders.refund', async ({ admin, req, ip }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const refund = await createRefund(admin, { ...parsed.data, ip });
  return NextResponse.json({ ok: true, id: refund.id });
});
