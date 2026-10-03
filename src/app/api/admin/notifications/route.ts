import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() });

export const PATCH = adminHandler('notifications.view', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });

  if (parsed.data.all) {
    await prisma.staffNotification.updateMany({
      where: { OR: [{ userId: admin.id }, { userId: null }], readAt: null },
      data: { readAt: new Date() },
    });
  } else if (parsed.data.ids?.length) {
    await prisma.staffNotification.updateMany({
      where: { id: { in: parsed.data.ids } },
      data: { readAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
});
