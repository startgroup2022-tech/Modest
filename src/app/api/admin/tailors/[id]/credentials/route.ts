import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { issueTailorCredentials, setTailorCredentialActive, TailorAuthError } from '@/lib/tailor-auth';

export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('issue'), username: z.string().min(3).max(60).optional() }),
  z.object({ action: z.literal('enable') }),
  z.object({ action: z.literal('disable') }),
]);

/**
 * Tailor credential administration. Requires `tailors.manage`. The plaintext
 * temporary password is returned exactly once (for the admin to hand over) and
 * is never persisted or logged — only its bcrypt hash is stored.
 */
export const POST = adminHandler('tailors.manage', async ({ admin, req, ip }) => {
  const tailorId = new URL(req.url).pathname.split('/').filter(Boolean).slice(-2)[0];
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 422 });

  const tailor = await prisma.tailor.findUnique({ where: { id: tailorId } });
  if (!tailor) throw new AdminActionError('Tailor not found', 'NOT_FOUND', 404);

  try {
    if (parsed.data.action === 'issue') {
      const issued = await issueTailorCredentials({
        tailorId,
        actorId: admin.id,
        username: parsed.data.username,
        ip,
      });
      return NextResponse.json({
        ok: true,
        username: issued.username,
        // Shown once to the administrator; the server keeps only the hash.
        temporaryPassword: issued.temporaryPassword,
        mustChangePassword: true,
      });
    }
    await setTailorCredentialActive({
      tailorId,
      active: parsed.data.action === 'enable',
      actorId: admin.id,
      ip,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TailorAuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
});
