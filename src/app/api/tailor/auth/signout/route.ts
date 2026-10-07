import { NextResponse } from 'next/server';
import { clearTailorSessionCookie, getTailorSession } from '@/lib/tailor-auth';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getTailorSession();
  await clearTailorSessionCookie();
  if (session) {
    await writeAudit({ action: 'tailor.signout', entity: 'Tailor', entityId: session.tailorId });
  }
  return NextResponse.json({ ok: true });
}
