import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signInSchema } from '@/lib/validation';
import { verifyPassword, setSessionCookie } from '@/lib/auth';
import { mergeGuestCartInto, mergeGuestWishlistInto } from '@/lib/cart';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
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

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: user.role?.name ?? 'CUSTOMER',
    customerId: user.customer?.id ?? null,
  });

  if (user.customer?.id) {
    await mergeGuestCartInto(user.customer.id);
    await mergeGuestWishlistInto(user.customer.id);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ userId: user.id, action: 'signin.success', entity: 'User', entityId: user.id, ip });

  // Only echo a same-site absolute path; never reflect an external URL back to
  // the client, where it would be used as a redirect target (open redirect).
  const raw = parsed.data.redirect ?? '';
  const safeRedirect = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : null;

  return NextResponse.json({
    ok: true,
    role: user.role?.name ?? 'CUSTOMER',
    redirect: safeRedirect,
  });
}
