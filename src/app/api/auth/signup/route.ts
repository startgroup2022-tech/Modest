import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signUpSchema } from '@/lib/validation';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { mergeGuestCartInto, mergeGuestWishlistInto } from '@/lib/cart';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limit = rateLimit(`signup:${ip}`, 8, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }
  const { email, password, firstName, lastName, phone, acceptsMarketing } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'emailTaken' }, { status: 409 });

  const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      firstName,
      lastName,
      phone: phone || null,
      roleId: customerRole?.id ?? null,
      locale: 'en',
      customer: {
        create: { phone: phone || null, acceptsMarketing: acceptsMarketing ?? false },
      },
    },
    include: { role: true, customer: true },
  });

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: user.role?.name ?? 'CUSTOMER',
    customerId: user.customer?.id ?? null,
    kind: 'customer',
    sessionVersion: user.sessionVersion,
  });

  if (user.customer?.id) {
    await mergeGuestCartInto(user.customer.id);
    await mergeGuestWishlistInto(user.customer.id);
  }

  await writeAudit({ userId: user.id, action: 'signup', entity: 'User', entityId: user.id, ip });

  return NextResponse.json({ ok: true, redirect: '/' });
}
