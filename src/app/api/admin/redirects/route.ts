import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  fromPath: z.string().min(1).max(2000),
  toPath: z.string().min(1).max(2000),
  statusCode: z.number().int().min(301).max(308).default(301),
  isEnabled: z.boolean().default(true),
});

const normalize = (p: string) => (p.startsWith('/') ? p : `/${p}`).replace(/\/+$/, '') || '/';

export const POST = adminHandler('seo.edit', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const fromPath = normalize(parsed.data.fromPath.trim());
  const toPath = normalize(parsed.data.toPath.trim());
  if (fromPath === toPath) return NextResponse.json({ error: 'From and to paths cannot match' }, { status: 422 });
  const dupe = await prisma.redirect.findUnique({ where: { fromPath } });
  if (dupe) return NextResponse.json({ error: 'A redirect for that path already exists' }, { status: 409 });
  const row = await prisma.redirect.create({
    data: { fromPath, toPath, statusCode: parsed.data.statusCode, isEnabled: parsed.data.isEnabled },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'redirect.create', entity: 'Redirect', entityId: row.id, metadata: { fromPath, toPath } } });
  return NextResponse.json({ ok: true, id: row.id });
});
