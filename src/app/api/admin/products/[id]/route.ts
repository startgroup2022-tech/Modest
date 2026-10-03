import { NextResponse } from 'next/server';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { productSchema } from '../route';

export const dynamic = 'force-dynamic';

function normalise(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v;
  return out;
}

export const PATCH = adminHandler('products.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Product not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  const { categoryIds, collectionIds, slug, ...rest } = parsed.data;
  const nextSlug = slug?.trim() || existing.slug;

  if (nextSlug !== existing.slug) {
    const dupe = await prisma.product.findUnique({ where: { slug: nextSlug } });
    if (dupe) return NextResponse.json({ error: 'That slug is already in use' }, { status: 409 });
  }

  const product = await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { productId: id } });
    await tx.productCollection.deleteMany({ where: { productId: id } });
    const payload = {
      ...normalise(rest as unknown as Record<string, unknown>),
      slug: nextSlug,
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      collections: { create: collectionIds.map((collectionId) => ({ collectionId })) },
    };
    return tx.product.update({ where: { id }, data: payload as never });
  });

  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'product.update', entity: 'Product', entityId: id, metadata: { slug: nextSlug } },
  });
  return NextResponse.json({ ok: true, id: product.id });
});

export const DELETE = adminHandler('products.delete', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.product.findUnique({ where: { id }, include: { orderItems: true } });
  if (!existing) throw new AdminActionError('Product not found', 'NOT_FOUND', 404);

  // Products referenced by historical orders are archived, never deleted, so
  // financial history stays intact.
  if (existing.orderItems.length > 0) {
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await prisma.auditLog.create({
      data: { userId: admin.id, action: 'product.archive', entity: 'Product', entityId: id, metadata: { reason: 'has_orders' } },
    });
    return NextResponse.json({ ok: true, archived: true });
  }

  await prisma.product.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'product.delete', entity: 'Product', entityId: id, metadata: {} },
  });
  return NextResponse.json({ ok: true });
});
