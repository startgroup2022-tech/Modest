import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const productSchema = z.object({
  slug: z.string().max(160).optional(),
  sku: z.string().max(80).nullable().optional(),
  nameEn: z.string().min(1).max(200),
  nameAr: z.string().min(1).max(200),
  subtitleEn: z.string().max(300).optional().default(''),
  subtitleAr: z.string().max(300).optional().default(''),
  descriptionEn: z.string().max(8000).optional().default(''),
  descriptionAr: z.string().max(8000).optional().default(''),
  materialsEn: z.string().max(4000).optional().default(''),
  materialsAr: z.string().max(4000).optional().default(''),
  careEn: z.string().max(4000).optional().default(''),
  careAr: z.string().max(4000).optional().default(''),
  priceBhd: z.number().min(0).max(1_000_000),
  compareAtBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  kind: z.enum(['READY_TO_WEAR', 'MADE_TO_ORDER']).default('READY_TO_WEAR'),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  madeToOrder: z.boolean().default(false),
  leadTimeMinDays: z.number().int().min(0).max(365).default(14),
  leadTimeMaxDays: z.number().int().min(0).max(365).default(21),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(5),
  metaTitleEn: z.string().max(200).optional().default(''),
  metaTitleAr: z.string().max(200).optional().default(''),
  metaDescEn: z.string().max(400).optional().default(''),
  metaDescAr: z.string().max(400).optional().default(''),
  noIndex: z.boolean().default(false),
  categoryIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
});

/** Normalises empty optional strings to null for the database. */
function normalise(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = v === '' ? null : v;
  }
  return out;
}

export const POST = adminHandler('products.create', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  const { categoryIds, collectionIds, ...rest } = parsed.data;
  const slug = rest.slug?.trim() || slugify(rest.nameEn);
  if (!slug) throw new AdminActionError('A slug is required', 'INVALID', 400);

  const dupe = await prisma.product.findUnique({ where: { slug } });
  if (dupe) return NextResponse.json({ error: 'That slug is already in use' }, { status: 409 });

  const payload = {
    ...normalise(rest as unknown as Record<string, unknown>),
    slug,
    categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    collections: { create: collectionIds.map((collectionId) => ({ collectionId })) },
  };
  const product = await prisma.product.create({ data: payload as never });

  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'product.create', entity: 'Product', entityId: product.id, metadata: { slug } },
  });
  return NextResponse.json({ ok: true, id: product.id });
});
