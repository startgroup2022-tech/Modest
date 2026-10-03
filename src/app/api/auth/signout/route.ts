import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  await clearSessionCookie();
  if (session) {
    await writeAudit({ userId: session.userId, action: 'signout', entity: 'User', entityId: session.userId });
  }
  return NextResponse.json({ ok: true });
}
