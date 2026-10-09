import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { cleanStr } from '@/lib/admin/resource-utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  slug: z.string().min(1).max(160),
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().min(1).max(200),
  bodyEn: z.string().max(200_000).default(''),
  bodyAr: z.string().max(200_000).default(''),
  metaTitleEn: z.string().max(200).nullable().optional(),
  metaTitleAr: z.string().max(200).nullable().optional(),
  metaDescEn: z.string().max(400).nullable().optional(),
  metaDescAr: z.string().max(400).nullable().optional(),
  noIndex: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const PATCH = adminHandler('content.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Page not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  const slug = d.slug.trim().toLowerCase().replace(/\s+/g, '-');
  if (slug !== existing.slug) {
    const dupe = await prisma.page.findUnique({ where: { slug } });
    if (dupe) return NextResponse.json({ error: 'That slug is already in use' }, { status: 409 });
  }
  await prisma.page.update({
    where: { id },
    data: {
      slug,
      titleEn: d.titleEn,
      titleAr: d.titleAr,
      bodyEn: d.bodyEn,
      bodyAr: d.bodyAr,
      metaTitleEn: cleanStr(d.metaTitleEn),
      metaTitleAr: cleanStr(d.metaTitleAr),
      metaDescEn: cleanStr(d.metaDescEn),
      metaDescAr: cleanStr(d.metaDescAr),
      noIndex: d.noIndex,
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'page.update', entity: 'Page', entityId: id, metadata: { slug } } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('content.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Page not found', 'NOT_FOUND', 404);
  await prisma.page.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'page.delete', entity: 'Page', entityId: id, metadata: { slug: existing.slug } } });
  return NextResponse.json({ ok: true });
});
