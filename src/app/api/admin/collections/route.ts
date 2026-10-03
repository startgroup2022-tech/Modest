import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

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

export const POST = adminHandler('products.create', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const { slug, imageUrl, ...rest } = parsed.data;
  const finalSlug = slug?.trim() || slugify(rest.nameEn);
  const dupe = await prisma.collection.findUnique({ where: { slug: finalSlug } });
  if (dupe) return NextResponse.json({ error: 'That slug is already in use' }, { status: 409 });
  const row = await prisma.collection.create({ data: { ...clean(rest as unknown as Record<string, unknown>), heroImage: imageUrl || null, slug: finalSlug } as never });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'collection.create', entity: 'Collection', entityId: row.id, metadata: { slug: finalSlug } } });
  return NextResponse.json({ ok: true, id: row.id });
});
