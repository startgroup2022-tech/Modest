import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contactSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limit = rateLimit(`contact:${ip}`, 8, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', field: parsed.error.issues[0]?.path?.[0] }, { status: 400 });
  }

  // Persisted as an audited enquiry so nothing a customer submits is silently dropped.
  await prisma.auditLog.create({
    data: {
      action: 'contact.enquiry',
      entity: 'ContactMessage',
      metadata: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        message: parsed.data.message,
      },
      ip,
      userAgent: req.headers.get('user-agent') ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
