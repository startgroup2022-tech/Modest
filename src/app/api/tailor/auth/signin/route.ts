import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import {
  authenticateTailor,
  setTailorSessionCookie,
  TailorAuthError,
} from '@/lib/tailor-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

/**
 * Tailor Portal sign-in. Separate from the staff/customer sign-in: a tailor
 * credential can only ever mint a `kind: 'tailor'` session. Rate limited per IP
 * and additionally protected by a persistent per-credential lockout.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limit = rateLimit(`tailor-signin:${ip}`, 10, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });

  try {
    const result = await authenticateTailor({
      username: parsed.data.username,
      password: parsed.data.password,
      ip,
    });

    const credential = await prisma.tailorCredential.findUnique({
      where: { tailorId: result.tailorId },
      select: { sessionVersion: true },
    });

    await setTailorSessionCookie({
      tailorId: result.tailorId,
      username: result.username,
      sessionVersion: credential?.sessionVersion ?? 0,
    });

    return NextResponse.json({
      ok: true,
      mustChangePassword: result.mustChangePassword,
      // The portal routes the tailor to the password-change screen first.
      redirect: result.mustChangePassword ? '/tailor/password' : '/tailor',
    });
  } catch (err) {
    if (err instanceof TailorAuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('[tailor-signin] failed', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
