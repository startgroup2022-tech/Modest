import { NextRequest, NextResponse } from 'next/server';
import { requireUser, hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addressSchema, changePasswordSchema, measurementSchema, profileSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function unauthenticated() {
  return NextResponse.json({ error: 'sessionExpired' }, { status: 401 });
}

// ── Addresses ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return unauthenticated();
  }
  if (!user.customerId) return unauthenticated();

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (kind === 'address') {
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid address' }, { status: 400 });
    }
    const count = await prisma.address.count({ where: { customerId: user.customerId } });
    const makeDefault = parsed.data.isDefault || count === 0;
    if (makeDefault) {
      await prisma.address.updateMany({ where: { customerId: user.customerId }, data: { isDefault: false } });
    }
    const address = await prisma.address.create({
      data: {
        customerId: user.customerId,
        label: parsed.data.label || null,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        country: parsed.data.country,
        city: parsed.data.city,
        area: parsed.data.area || null,
        address: parsed.data.address,
        building: parsed.data.building || null,
        unit: parsed.data.unit || null,
        notes: parsed.data.notes || null,
        isDefault: makeDefault,
      },
    });
    return NextResponse.json({ ok: true, address });
  }

  if (kind === 'measurements') {
    const parsed = measurementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid measurements' }, { status: 400 });
    }
    const data = {
      name: parsed.data.name || 'My measurements',
      unit: parsed.data.unit,
      height: parsed.data.height ?? null,
      shoulder: parsed.data.shoulder ?? null,
      bust: parsed.data.bust ?? null,
      waist: parsed.data.waist ?? null,
      hip: parsed.data.hip ?? null,
      sleeve: parsed.data.sleeve ?? null,
      armhole: parsed.data.armhole ?? null,
      length: parsed.data.length ?? null,
      notes: parsed.data.notes || null,
    };

    // A profile may be edited by id, but only when it belongs to the caller.
    // Without an id, the caller's default profile is updated in place unless
    // the request is an explicit "create" (the Add-profile action), which must
    // always make a new row.
    const target = parsed.data.id
      ? await prisma.measurement.findFirst({ where: { id: parsed.data.id, customerId: user.customerId } })
      : parsed.data.create
        ? null
        : await prisma.measurement.findFirst({ where: { customerId: user.customerId, isDefault: true } });
    if (parsed.data.id && !target) {
      return NextResponse.json({ error: 'notFound' }, { status: 404 });
    }

    const count = await prisma.measurement.count({ where: { customerId: user.customerId } });
    const makeDefault = parsed.data.isDefault ?? (!target && count === 0);
    if (makeDefault) {
      await prisma.measurement.updateMany({ where: { customerId: user.customerId }, data: { isDefault: false } });
    }

    const measurement = target
      ? await prisma.measurement.update({
          where: { id: target.id },
          data: { ...data, ...(makeDefault ? { isDefault: true } : {}) },
        })
      : await prisma.measurement.create({
          data: { customerId: user.customerId, isDefault: makeDefault || count === 0, ...data },
        });
    return NextResponse.json({ ok: true, measurement });
  }

  if (kind === 'password') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const limit = rateLimit(`password:${user.id}:${ip}`, 6, 15 * 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid password', field: parsed.error.issues[0]?.path?.[0] },
        { status: 400 },
      );
    }
    // The current password is required and verified server-side; a session
    // alone is not enough to change the credential.
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!account?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
      await writeAudit({ userId: user.id, action: 'account.password_change_failed', entity: 'User', entityId: user.id, metadata: {}, ip });
      return NextResponse.json({ error: 'Your current password is incorrect', field: 'currentPassword' }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    await writeAudit({ userId: user.id, action: 'account.password_change', entity: 'User', entityId: user.id, metadata: {}, ip });
    return NextResponse.json({ ok: true });
  }

  if (kind === 'profile') {
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone || null,
        locale: parsed.data.locale,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return unauthenticated();
  }
  if (!user.customerId) return unauthenticated();

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const kind = url.searchParams.get('kind');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (kind === 'measurements') {
    const deleted = await prisma.measurement.deleteMany({ where: { id, customerId: user.customerId } });
    if (deleted.count === 0) return NextResponse.json({ error: 'notFound' }, { status: 404 });
    // If the default profile was removed, promote the most recent remaining one.
    const stillDefault = await prisma.measurement.findFirst({ where: { customerId: user.customerId, isDefault: true } });
    if (!stillDefault) {
      const next = await prisma.measurement.findFirst({
        where: { customerId: user.customerId },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) await prisma.measurement.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return NextResponse.json({ ok: true });
  }

  await prisma.address.deleteMany({ where: { id, customerId: user.customerId } });
  return NextResponse.json({ ok: true });
}
