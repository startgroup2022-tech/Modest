import { NextResponse } from 'next/server';
import { guardTailorWrite, tailorErrorResponse } from '@/lib/tailor-principal';
import { confirmSettlementByTailor } from '@/lib/settlements';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

/**
 * Tailor-only confirmation that a settlement was received. A supervisor is
 * refused by `guardTailorWrite` (confirmation is an attestation that must come
 * from the tailor), and ownership is enforced in the service.
 */
export async function POST(req: Request) {
  const guarded = await guardTailorWrite(req);
  if ('error' in guarded) return guarded.error;
  const { access } = guarded;

  const id = new URL(req.url).pathname.split('/').filter(Boolean)[3];
  if (!id) return NextResponse.json({ error: 'Missing settlement id' }, { status: 400 });

  try {
    const updated = await confirmSettlementByTailor({
      settlementId: id,
      tailorId: access.tailorId,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    return tailorErrorResponse(err);
  }
}
