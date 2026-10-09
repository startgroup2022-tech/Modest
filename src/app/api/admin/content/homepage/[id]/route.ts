import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { cleanStr } from '@/lib/admin/resource-utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  titleEn: z.string().max(300).nullable().optional(),
  titleAr: z.string().max(300).nullable().optional(),
  bodyEn: z.string().max(20_000).nullable().optional(),
  bodyAr: z.string().max(20_000).nullable().optional(),
  ctaLabelEn: z.string().max(120).nullable().optional(),
  ctaLabelAr: z.string().max(120).nullable().optional(),
  ctaHref: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  mobileImageUrl: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const PATCH = adminHandler('content.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.homeSection.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Section not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  await prisma.homeSection.update({
    where: { id },
    data: {
      titleEn: cleanStr(d.titleEn),
      titleAr: cleanStr(d.titleAr),
      bodyEn: cleanStr(d.bodyEn),
      bodyAr: cleanStr(d.bodyAr),
      ctaLabelEn: cleanStr(d.ctaLabelEn),
      ctaLabelAr: cleanStr(d.ctaLabelAr),
      ctaHref: cleanStr(d.ctaHref),
      imageUrl: cleanStr(d.imageUrl),
      mobileImageUrl: cleanStr(d.mobileImageUrl),
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'homepage.update', entity: 'HomeSection', entityId: id, metadata: { key: existing.key } } });
  return NextResponse.json({ ok: true, id });
});
