import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import {
  getTailorSession,
  changeTailorPassword,
  setTailorSessionCookie,
  TailorAuthError,
  getCurrentTailor,
} from '@/lib/tailor-auth';
import { prisma } from '@/lib/prisma';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * First-login (and subsequent) password change for a tailor. Requires an
 * authenticated tailor session. The current password is verified server-side;
 * the policy (8+ chars, at least one number, different from the temporary
 * password) is enforced by `changeTailorPassword`.
 */
export async function POST(req: NextRequest) {
  const session = await getTailorSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const tailor = await getCurrentTailor();
  if (!tailor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const ip = clientIp(req);
  const limit = rateLimit(`tailor-password:${tailor.id}:${ip}`, 6, 15 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid password' },
      { status: 422 },
    );
  }

  try {
    await changeTailorPassword({
      tailorId: tailor.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      ip,
    });

    // The change bumped sessionVersion (ending other sessions). Re-mint this
    // session so the tailor who just changed their own password stays signed in
    // instead of being logged out by their own version bump.
    const credential = await prisma.tailorCredential.findUnique({
      where: { tailorId: tailor.id },
      select: { sessionVersion: true },
    });
    await setTailorSessionCookie({
      tailorId: tailor.id,
      username: tailor.username,
      sessionVersion: credential?.sessionVersion ?? 0,
    });

    return NextResponse.json({ ok: true, redirect: '/tailor' });
  } catch (err) {
    if (err instanceof TailorAuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}
