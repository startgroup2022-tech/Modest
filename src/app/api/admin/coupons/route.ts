import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
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
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  descriptionEn: z.string().max(2000).nullable().optional(),
  descriptionAr: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const POST = adminHandler('promotions.edit', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  const code = d.code.trim().toUpperCase();
  const dupe = await prisma.coupon.findUnique({ where: { code } });
  if (dupe) return NextResponse.json({ error: 'That coupon code already exists' }, { status: 409 });

  const row = await prisma.coupon.create({
    data: {
      code,
      discountType: d.discountType,
      valueBhd: d.valueBhd,
      minOrderBhd: d.minOrderBhd ?? null,
      maxDiscountBhd: d.maxDiscountBhd ?? null,
      usageLimit: d.usageLimit ?? null,
      perCustomerLimit: d.perCustomerLimit ?? null,
      startsAt: dateOrNull(d.startsAt),
      expiresAt: dateOrNull(d.expiresAt),
      descriptionEn: cleanStr(d.descriptionEn),
      descriptionAr: cleanStr(d.descriptionAr),
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'coupon.create', entity: 'Coupon', entityId: row.id, metadata: { code } } });
  return NextResponse.json({ ok: true, id: row.id });
});
