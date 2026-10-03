import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  isPrimary: z.boolean().optional(),
  altEn: z.string().max(300).optional(),
  altAr: z.string().max(300).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

function mediaId(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

export const PATCH = adminHandler('products.edit', async ({ admin, req }) => {
  const id = mediaId(req);
  const existing = await prisma.productMedia.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Media not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const d = parsed.data;

  const media = await prisma.$transaction(async (tx) => {
    if (d.isPrimary) {
      await tx.productMedia.updateMany({ where: { productId: existing.productId }, data: { isPrimary: false } });
    }
    return tx.productMedia.update({ where: { id }, data: d });
  });
  return NextResponse.json({ ok: true, id: media.id });
});

export const DELETE = adminHandler('products.edit', async ({ admin, req }) => {
  const id = mediaId(req);
  const existing = await prisma.productMedia.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Media not found', 'NOT_FOUND', 404);
  await prisma.productMedia.delete({ where: { id } });

  // Promote another image to primary so a product is never left without one.
  if (existing.isPrimary) {
    const next = await prisma.productMedia.findFirst({
      where: { productId: existing.productId },
      orderBy: { sortOrder: 'asc' },
    });
    if (next) await prisma.productMedia.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  return NextResponse.json({ ok: true });
});
