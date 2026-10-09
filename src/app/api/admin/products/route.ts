import { NextResponse } from 'next/server';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { productSchema } from '@/lib/admin/product-schema';

export const dynamic = 'force-dynamic';

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

  // Creating a product directly in a published state is an approval decision.
  if (rest.status !== 'DRAFT' && !admin.permissions.has('products.approve')) {
    return NextResponse.json(
      { error: 'You cannot publish a product without approval permission', code: 'APPROVAL_REQUIRED' },
      { status: 403 },
    );
  }

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
