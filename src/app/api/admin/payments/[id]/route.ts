import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { updatePayment } from '@/lib/admin/orders';

export const dynamic = 'force-dynamic';

const schema = z.object({
  status: z.enum(['INITIATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']),
  reference: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});

export const PATCH = adminHandler('payments.verify', async ({ admin, req, ip }) => {
  const paymentId = new URL(req.url).pathname.split('/').slice(-1)[0];
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const updated = await updatePayment(admin, { paymentId, ...parsed.data, ip });
  return NextResponse.json({ ok: true, status: updated.status });
});
