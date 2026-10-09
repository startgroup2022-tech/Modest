import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { cleanStr, dateOrNull } from '@/lib/admin/resource-utils';

export const dynamic = 'force-dynamic';

const discountType = z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']);

const schema = z.object({
  code: z.string().min(1).max(64),
  discountType,
  valueBhd: z.number().min(0).max(1_000_000).default(0),
  minOrderBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  maxDiscountBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  usageLimit: z.number().int().min(0).max(1_000_000).nullable().optional(),
  perCustomerLimit: z.number().int().min(0).max(1_000_000).nullable().optional(),
  minQualifyingPieces: z.number().int().min(0).max(100_000).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  descriptionEn: z.string().max(2000).nullable().optional(),
  descriptionAr: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const PATCH = adminHandler('promotions.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Coupon not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  const code = d.code.trim().toUpperCase();
  if (code !== existing.code) {
    const dupe = await prisma.coupon.findUnique({ where: { code } });
    if (dupe) return NextResponse.json({ error: 'That coupon code already exists' }, { status: 409 });
  }
  await prisma.coupon.update({
    where: { id },
    data: {
      code,
      discountType: d.discountType,
      valueBhd: d.valueBhd,
      minOrderBhd: d.minOrderBhd ?? null,
      maxDiscountBhd: d.maxDiscountBhd ?? null,
      usageLimit: d.usageLimit ?? null,
      perCustomerLimit: d.perCustomerLimit ?? null,
      minQualifyingPieces: d.minQualifyingPieces ?? null,
      startsAt: dateOrNull(d.startsAt),
      expiresAt: dateOrNull(d.expiresAt),
      descriptionEn: cleanStr(d.descriptionEn),
      descriptionAr: cleanStr(d.descriptionAr),
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'coupon.update', entity: 'Coupon', entityId: id, metadata: { code } } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('promotions.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Coupon not found', 'NOT_FOUND', 404);
  if (existing.usedCount > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: 'coupon.deactivate', entity: 'Coupon', entityId: id, metadata: {} } });
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await prisma.coupon.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'coupon.delete', entity: 'Coupon', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true });
});
