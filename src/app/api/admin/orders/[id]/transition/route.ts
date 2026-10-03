import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { transitionOrder } from '@/lib/admin/orders';
import type { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const schema = z.object({
  to: z.enum([
    'PENDING', 'CONFIRMED', 'PREPARING', 'IN_PRODUCTION', 'QUALITY_CHECK',
    'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED',
  ]),
  note: z.string().max(1000).optional(),
  trackingNumber: z.string().max(120).optional(),
  carrier: z.string().max(120).optional(),
  cancelReason: z.string().max(500).optional(),
});

export const POST = adminHandler('orders.edit', async ({ admin, req, ip }) => {
  const url = new URL(req.url);
  const orderId = url.pathname.split('/').slice(-2)[0];
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const to = parsed.data.to as OrderStatus;
  // Cancellation and refunds require the dedicated permissions.
  if (to === 'CANCELLED' && !admin.permissions.has('orders.cancel')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if ((to === 'REFUND_REQUESTED' || to === 'REFUNDED') && !admin.permissions.has('orders.refund')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await transitionOrder(admin, { orderId, ...parsed.data, ip });
  return NextResponse.json({ ok: true, status: updated.status });
});
