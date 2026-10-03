import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { newsletterSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limit = rateLimit(`newsletter:${ip}`, 10, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ status: 'alreadySubscribed' });
  }
  await prisma.newsletterSubscriber.create({
    data: { email: parsed.data.email, locale: parsed.data.locale },
  });
  return NextResponse.json({ status: 'success' });
}
