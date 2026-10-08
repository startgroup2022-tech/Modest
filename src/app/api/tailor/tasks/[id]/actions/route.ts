import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guardTailorWrite, tailorErrorResponse } from '@/lib/tailor-principal';
import { applyTailorTaskAction } from '@/lib/tailor-work';

export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.enum(['accept', 'start', 'submit_for_qc']) });

/**
 * Tailor-driven production action for one assigned piece.
 *
 * Ownership is enforced in the service (the task must belong to the tailor),
 * not merely here. A supervisor is refused by `guardTailorWrite` before this
 * runs, so a read-only viewer can never advance work.
 */
export async function POST(req: Request) {
  const guarded = await guardTailorWrite(req);
  if ('error' in guarded) return guarded.error;
  const { access } = guarded;

  const id = new URL(req.url).pathname.split('/').filter(Boolean)[3];
  if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 422 });

  try {
    const result = await applyTailorTaskAction({
      tailorId: access.tailorId,
      taskId: id,
      action: parsed.data.action,
      actorLabel: `tailor:${access.tailorId}`,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    return tailorErrorResponse(err);
  }
}
