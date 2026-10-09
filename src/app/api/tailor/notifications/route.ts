import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveTailorApiPrincipal, guardTailorWrite } from '@/lib/tailor-principal';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Tailor notification feed. Scoped to the signed-in tailor; a supervisor may
 * read the feed for the tailor they are viewing but may not mark it read.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = url.searchParams.get('tailorId');
  const resolved = await resolveTailorApiPrincipal(requested);
  if (!resolved.ok) return resolved.error;

  const [items, unread] = await Promise.all([
    prisma.tailorNotification.findMany({
      where: { tailorId: resolved.access.tailorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, eventKey: true, titleEn: true, titleAr: true, bodyEn: true, bodyAr: true, href: true, readAt: true, createdAt: true },
    }),
    prisma.tailorNotification.count({ where: { tailorId: resolved.access.tailorId, readAt: null } }),
  ]);
  return NextResponse.json({ ok: true, unread, items });
}

const schema = z.object({
  ids: z.array(z.string()).max(200).optional(),
  all: z.boolean().optional(),
});

/** Marks notifications read. Tailor-only (a supervisor is read-only). */
export async function PATCH(req: Request) {
  const guarded = await guardTailorWrite(req);
  if ('error' in guarded) return guarded.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });

  const where = { tailorId: guarded.access.tailorId };
  if (parsed.data.all) {
    await prisma.tailorNotification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
  } else if (parsed.data.ids?.length) {
    await prisma.tailorNotification.updateMany({
      where: { ...where, id: { in: parsed.data.ids } },
      data: { readAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
