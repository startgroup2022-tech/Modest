import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addressSchema, measurementSchema, profileSchema } from '@/lib/validation';

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
    const existing = await prisma.measurement.findFirst({
      where: { customerId: user.customerId, isDefault: true },
    });
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
    const measurement = existing
      ? await prisma.measurement.update({ where: { id: existing.id }, data })
      : await prisma.measurement.create({ data: { customerId: user.customerId, isDefault: true, ...data } });
    return NextResponse.json({ ok: true, measurement });
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

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await prisma.address.deleteMany({ where: { id, customerId: user.customerId } });
  return NextResponse.json({ ok: true });
}
