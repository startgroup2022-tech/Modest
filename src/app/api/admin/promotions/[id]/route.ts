import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { cleanStr, dateOrNull } from '@/lib/admin/resource-utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().min(1).max(200),
  bodyEn: z.string().max(4000).nullable().optional(),
  bodyAr: z.string().max(4000).nullable().optional(),
  ctaLabelEn: z.string().max(120).nullable().optional(),
  ctaLabelAr: z.string().max(120).nullable().optional(),
  ctaHref: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  placement: z.enum(['announcement', 'home_banner']).default('announcement'),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const PATCH = adminHandler('promotions.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Promotion not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  await prisma.promotion.update({
    where: { id },
    data: {
      titleEn: d.titleEn,
      titleAr: d.titleAr,
      bodyEn: cleanStr(d.bodyEn),
      bodyAr: cleanStr(d.bodyAr),
      ctaLabelEn: cleanStr(d.ctaLabelEn),
      ctaLabelAr: cleanStr(d.ctaLabelAr),
      ctaHref: cleanStr(d.ctaHref),
      imageUrl: cleanStr(d.imageUrl),
      placement: d.placement,
      sortOrder: d.sortOrder,
      startsAt: dateOrNull(d.startsAt),
      endsAt: dateOrNull(d.endsAt),
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'promotion.update', entity: 'Promotion', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('promotions.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Promotion not found', 'NOT_FOUND', 404);
  await prisma.promotion.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'promotion.delete', entity: 'Promotion', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true });
});
