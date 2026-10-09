import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signInSchema } from '@/lib/validation';
import { verifyPassword, setSessionCookie, type SessionKind } from '@/lib/auth';
import { mergeGuestCartInto, mergeGuestWishlistInto } from '@/lib/cart';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { safeRedirect } from '@/lib/redirect-safety';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const STAFF_ROLE_NAMES = ['ADMIN', 'MANAGER', 'SUPPORT'];

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`signin:${ip}`, 10, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { role: true, customer: true },
  });
  if (!user || !user.passwordHash || !user.isActive) {
    return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await writeAudit({ userId: user.id, action: 'signin.failed', entity: 'User', entityId: user.id, ip });
    return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
  }

  // Staff roles always mint a staff session, even if the user also happens to
  // have a customer profile (e.g. an admin who shops). Tailors authenticate
  // only through the Tailor Portal, so a TAILOR-role user is refused here.
  const roleName = user.role?.name ?? 'CUSTOMER';
  if (roleName === 'TAILOR') {
    return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
  }
  const kind: SessionKind = STAFF_ROLE_NAMES.includes(roleName) ? 'staff' : 'customer';

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: roleName,
    customerId: user.customer?.id ?? null,
    kind,
    sessionVersion: user.sessionVersion,
  });

  if (user.customer?.id) {
    await mergeGuestCartInto(user.customer.id);
    await mergeGuestWishlistInto(user.customer.id);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ userId: user.id, action: 'signin.success', entity: 'User', entityId: user.id, ip });

  // Only echo a same-site absolute path; never reflect an external URL back to
  // the client, where it would be used as a redirect target (open redirect).
  const redirect = safeRedirect(parsed.data.redirect);

  return NextResponse.json({
    ok: true,
    role: user.role?.name ?? 'CUSTOMER',
    redirect,
  });
}
