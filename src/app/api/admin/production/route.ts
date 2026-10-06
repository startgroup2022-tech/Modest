import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { nextSequenceStandalone } from '@/lib/sequences';
import { resolveTailorFee, TailorFeeError } from '@/lib/tailor-fees';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().min(1),
  orderItemId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  tailorId: z.string().nullable().optional(),
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().max(200).optional().default(''),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueDate: z.string().optional().default(''),
  notes: z.string().max(4000).optional().default(''),
  // Explicit fee from an authorised workflow; required when the product has no
  // configured fee and a tailor is being assigned.
  feeBhd: z.number().min(0).max(100_000).optional(),
});

export const POST = adminHandler('production.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: d.orderId } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const product = d.productId
    ? await prisma.product.findUnique({ where: { id: d.productId }, select: { tailorFeeBhd: true } })
    : null;

  // Freeze the fee whenever a tailor is assigned. No hidden fallback: if no
  // fee can be resolved the request fails rather than inventing a value.
  let feeBhd: number | null = null;
  if (d.tailorId) {
    try {
      feeBhd = resolveTailorFee({
        productFeeBhd: product?.tailorFeeBhd != null ? Number(product.tailorFeeBhd) : null,
        suppliedFeeBhd: d.feeBhd ?? null,
      });
    } catch (err) {
      if (err instanceof TailorFeeError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
      }
      throw err;
    }
  }

  const due = d.dueDate ? new Date(d.dueDate) : null;
  const code = await nextSequenceStandalone({ key: 'production', prefix: 'PRD', pad: 6 });
  const task = await prisma.productionTask.create({
    data: {
      code,
      orderId: d.orderId,
      orderItemId: d.orderItemId || null,
      productId: d.productId || null,
      tailorId: d.tailorId || null,
      titleEn: d.titleEn,
      titleAr: d.titleAr || null,
      priority: d.priority,
      status: d.tailorId ? 'ASSIGNED' : 'PENDING',
      feeBhd,
      dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
      notes: d.notes || null,
      createdById: admin.id,
    },
  });

  // Mirror the assignment onto the order item so per-piece assignment and the
  // frozen fee are consistent across production and settlements.
  if (d.orderItemId && d.tailorId && feeBhd != null) {
    await prisma.orderItem.update({
      where: { id: d.orderItemId },
      data: { assignedTailorId: d.tailorId, assignedAt: new Date(), tailorFeeBhd: feeBhd },
    });
  }

  await prisma.auditLog.create({ data: { userId: admin.id, action: 'production.create', entity: 'ProductionTask', entityId: task.id, metadata: { orderId: d.orderId, feeBhd } as never } });
  return NextResponse.json({ ok: true, id: task.id, code: task.code });
});
