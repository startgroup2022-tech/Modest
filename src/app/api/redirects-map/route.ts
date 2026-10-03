import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Public, read-only redirect map consumed by the edge middleware, which cannot
 * reach Prisma directly. Only enabled redirects are exposed, and the response is
 * cacheable so middleware lookups stay cheap.
 */
export async function GET() {
  const rows = await prisma.redirect.findMany({
    where: { isEnabled: true },
    select: { id: true, fromPath: true, toPath: true, statusCode: true },
  });
  const map: Record<string, { id: string; to: string; code: number }> = {};
  for (const r of rows) map[r.fromPath] = { id: r.id, to: r.toPath, code: r.statusCode };
  return NextResponse.json(map, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
  });
}

// Hit counters are best-effort and self-throttling: at most one increment per
// redirect id per second, so a burst of traffic cannot be amplified into write
// pressure. The counter is the only thing this endpoint can change.
const lastHit = new Map<string, number>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const now = Date.now();
  if ((lastHit.get(id) ?? 0) > now - 1000) return NextResponse.json({ ok: true, throttled: true });
  lastHit.set(id, now);
  try {
    await prisma.redirect.update({ where: { id }, data: { hits: { increment: 1 } } });
  } catch {
    /* redirect may have been deleted — ignore */
  }
  return NextResponse.json({ ok: true });
}
