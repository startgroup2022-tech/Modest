import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  stock: z.number().int().min(0).max(1_000_000).optional(),
  priceBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  size: z.string().min(1).max(40).optional(),
  colorEn: z.string().max(60).optional(),
  colorAr: z.string().max(60).optional(),
  sku: z.string().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});

function variantId(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

export const PATCH = adminHandler('inventory.adjust', async ({ admin, req }) => {
  const id = variantId(req);
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Variant not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const d = parsed.data;

  const nextStock = d.stock ?? existing.stock;
  const variant = await prisma.$transaction(async (tx) => {
    const updated = await tx.productVariant.update({
      where: { id },
      data: {
        ...d,
        colorEn: d.colorEn === '' ? null : d.colorEn,
        colorAr: d.colorAr === '' ? null : d.colorAr,
        stockStatus:
          nextStock <= 0 ? 'OUT_OF_STOCK' : nextStock <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
      },
    });
    if (d.stock !== undefined && d.stock !== existing.stock) {
      await tx.inventoryMovement.create({
        data: {
          variantId: id,
          productId: existing.productId,
          type: 'MANUAL_ADJUSTMENT',
          quantity: d.stock - existing.stock,
          stockAfter: d.stock,
          reason: 'Variant stock edit',
          actorId: admin.id,
        },
      });
    }
    return updated;
  });

  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'variant.update', entity: 'ProductVariant', entityId: id, metadata: d as never },
  });
  return NextResponse.json({ ok: true, id: variant.id, stock: variant.stock });
});

export const DELETE = adminHandler('products.edit', async ({ admin, req }) => {
  const id = variantId(req);
  const existing = await prisma.productVariant.findUnique({ where: { id }, include: { orderItems: true } });
  if (!existing) throw new AdminActionError('Variant not found', 'NOT_FOUND', 404);

  if (existing.orderItems.length > 0) {
    await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await prisma.productVariant.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'variant.delete', entity: 'ProductVariant', entityId: id, metadata: {} },
  });
  return NextResponse.json({ ok: true });
});
