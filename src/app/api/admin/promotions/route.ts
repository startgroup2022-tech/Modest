import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
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

export const POST = adminHandler('promotions.create', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  const row = await prisma.promotion.create({
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
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'promotion.create', entity: 'Promotion', entityId: row.id, metadata: {} } });
  return NextResponse.json({ ok: true, id: row.id });
});
