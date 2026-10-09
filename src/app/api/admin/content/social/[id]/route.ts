import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { cleanStr } from '@/lib/admin/resource-utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  platform: z.string().min(1).max(60),
  url: z.string().url().max(2000),
  labelEn: z.string().max(120).nullable().optional(),
  labelAr: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const PATCH = adminHandler('content.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.socialLink.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Social link not found', 'NOT_FOUND', 404);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  await prisma.socialLink.update({
    where: { id },
    data: {
      platform: d.platform.trim().toLowerCase(),
      url: d.url,
      labelEn: cleanStr(d.labelEn),
      labelAr: cleanStr(d.labelAr),
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'social.update', entity: 'SocialLink', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('content.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.socialLink.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Social link not found', 'NOT_FOUND', 404);
  await prisma.socialLink.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'social.delete', entity: 'SocialLink', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true });
});
