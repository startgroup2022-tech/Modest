import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getActiveCurrencies, CURRENCY_COOKIE } from '@/lib/currency';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().length(3) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });

  const active = await getActiveCurrencies();
  if (!active.some((c) => c.code === parsed.data.code)) {
    return NextResponse.json({ error: 'Currency not available' }, { status: 400 });
  }

  const store = await cookies();
  store.set(CURRENCY_COOKIE, parsed.data.code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ code: parsed.data.code });
}
