import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { preserveSecrets } from '@/lib/admin/settings';

export const dynamic = 'force-dynamic';

const schema = z.object({
  key: z.string().min(1).max(80),
  value: z.record(z.string(), z.unknown()),
});

/** Settings that hold credentials: a masked sentinel keeps the stored value. */
const SECRET_KEYS: Record<string, string[]> = {
  tapp_config: ['apiKey', 'webhookSecret'],
};

export const PATCH = adminHandler('settings.edit', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const { key, value } = parsed.data;

  const existing = await prisma.siteSetting.findUnique({ where: { key } });
  const existingValue = (existing?.value as Record<string, unknown>) ?? {};
  const secrets = SECRET_KEYS[key] ?? [];
  const merged = secrets.length ? preserveSecrets(value, existingValue, secrets) : value;

  const row = await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: merged as never },
    update: { value: merged as never },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'settings.update', entity: 'SiteSetting', entityId: key, metadata: {} } });
  return NextResponse.json({ ok: true, key: row.key });
});
