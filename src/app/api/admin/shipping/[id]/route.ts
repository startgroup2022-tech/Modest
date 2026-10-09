import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { cleanStr } from '@/lib/admin/resource-utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().min(1).max(64),
  nameEn: z.string().min(1).max(160),
  nameAr: z.string().min(1).max(160),
  descriptionEn: z.string().max(2000).nullable().optional(),
  descriptionAr: z.string().max(2000).nullable().optional(),
  priceBhd: z.number().min(0).max(1_000_000).default(0),
  freeOverBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  courier: z.string().max(120).nullable().optional(),
  etaMinDays: z.number().int().min(0).max(365).default(2),
  etaMaxDays: z.number().int().min(0).max(365).default(5),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const PATCH = adminHandler('shipping.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Shipping method not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  const code = d.code.trim().toUpperCase();
  if (code !== existing.code) {
    const dupe = await prisma.shippingMethod.findUnique({ where: { code } });
    if (dupe) return NextResponse.json({ error: 'That shipping code already exists' }, { status: 409 });
  }
  await prisma.shippingMethod.update({
    where: { id },
    data: {
      code,
      nameEn: d.nameEn,
      nameAr: d.nameAr,
      descriptionEn: cleanStr(d.descriptionEn),
      descriptionAr: cleanStr(d.descriptionAr),
      priceBhd: d.priceBhd,
      freeOverBhd: d.freeOverBhd ?? null,
      courier: cleanStr(d.courier),
      etaMinDays: d.etaMinDays,
      etaMaxDays: d.etaMaxDays,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'shipping.update', entity: 'ShippingMethod', entityId: id, metadata: { code } } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('shipping.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Shipping method not found', 'NOT_FOUND', 404);
  await prisma.shippingMethod.update({ where: { id }, data: { isActive: false } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'shipping.deactivate', entity: 'ShippingMethod', entityId: id, metadata: { code: existing.code } } });
  return NextResponse.json({ ok: true, deactivated: true });
});
