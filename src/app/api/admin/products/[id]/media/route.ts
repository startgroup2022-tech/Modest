import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  url: z.string().url().max(2000),
  altEn: z.string().max(300).optional().default(''),
  altAr: z.string().max(300).optional().default(''),
  isPrimary: z.boolean().optional().default(false),
});

function productId(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return parts[parts.indexOf('products') + 1];
}

export const POST = adminHandler('products.edit', async ({ admin, req }) => {
  const id = productId(req);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const d = parsed.data;

  const count = await prisma.productMedia.count({ where: { productId: id } });
  const media = await prisma.$transaction(async (tx) => {
    if (d.isPrimary) {
      await tx.productMedia.updateMany({ where: { productId: id }, data: { isPrimary: false } });
    }
    return tx.productMedia.create({
      data: {
        productId: id,
        url: d.url,
        altEn: d.altEn || null,
        altAr: d.altAr || null,
        isPrimary: d.isPrimary || count === 0,
        sortOrder: count,
      },
    });
  });

  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'media.create', entity: 'ProductMedia', entityId: media.id, metadata: { productId: id } },
  });
  return NextResponse.json({ ok: true, id: media.id });
});
