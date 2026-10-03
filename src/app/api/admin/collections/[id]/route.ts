import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  slug: z.string().max(160).optional(),
  nameEn: z.string().min(1).max(160),
  nameAr: z.string().min(1).max(160),
  taglineEn: z.string().max(300).optional().default(''),
  taglineAr: z.string().max(300).optional().default(''),
  descriptionEn: z.string().max(4000).optional().default(''),
  descriptionAr: z.string().max(4000).optional().default(''),
  imageUrl: z.string().max(2000).optional().default(''),
  metaTitleEn: z.string().max(200).optional().default(''),
  metaTitleAr: z.string().max(200).optional().default(''),
  metaDescEn: z.string().max(400).optional().default(''),
  metaDescAr: z.string().max(400).optional().default(''),
  noIndex: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  return out;
}

export const PATCH = adminHandler('products.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Collection not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const { slug, imageUrl, ...rest } = parsed.data;
  const row = await prisma.collection.update({
    where: { id },
    data: { ...clean(rest as unknown as Record<string, unknown>), heroImage: imageUrl || existing.heroImage, slug: slug?.trim() || existing.slug } as never,
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'collection.update', entity: 'Collection', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id: row.id });
});

export const DELETE = adminHandler('products.delete', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const links = await prisma.productCollection.count({ where: { collectionId: id } });
  if (links > 0) {
    await prisma.collection.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await prisma.collection.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'collection.delete', entity: 'Collection', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true });
});
