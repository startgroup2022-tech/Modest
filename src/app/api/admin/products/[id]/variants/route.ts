import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  size: z.string().min(1).max(40),
  colorEn: z.string().max(60).optional().default(''),
  colorAr: z.string().max(60).optional().default(''),
  sku: z.string().max(80).nullable().optional(),
  priceBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).default(0),
});

function productId(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return parts[parts.indexOf('products') + 1];
}

export const POST = adminHandler('products.edit', async ({ admin, req }) => {
  const id = productId(req);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const d = parsed.data;

  const variant = await prisma.productVariant.create({
    data: {
      productId: id,
      size: d.size,
      colorEn: d.colorEn || null,
      colorAr: d.colorAr || null,
      sku: d.sku || null,
      priceBhd: d.priceBhd ?? null,
      stock: d.stock,
      stockStatus: d.stock <= 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
    },
  });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'variant.create', entity: 'ProductVariant', entityId: variant.id, metadata: { productId: id } },
  });
  return NextResponse.json({ ok: true, id: variant.id });
});
