import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  slug: z.string().max(160).optional(),
  nameEn: z.string().min(1).max(160),
  nameAr: z.string().min(1).max(160),
  descriptionEn: z.string().max(4000).optional().default(''),
  descriptionAr: z.string().max(4000).optional().default(''),
  imageUrl: z.string().max(2000).optional().default(''),
  metaTitleEn: z.string().max(200).optional().default(''),
  metaTitleAr: z.string().max(200).optional().default(''),
  metaDescEn: z.string().max(400).optional().default(''),
  metaDescAr: z.string().max(400).optional().default(''),
  noIndex: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  return out;
}

export const PATCH = adminHandler('products.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Category not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const { slug, ...rest } = parsed.data;
  const row = await prisma.category.update({ where: { id }, data: { ...clean(rest as unknown as Record<string, unknown>), slug: slug?.trim() || existing.slug } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'category.update', entity: 'Category', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id: row.id });
});

export const DELETE = adminHandler('products.delete', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const links = await prisma.productCategory.count({ where: { categoryId: id } });
  if (links > 0) {
    await prisma.category.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await prisma.category.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'category.delete', entity: 'Category', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true });
});
