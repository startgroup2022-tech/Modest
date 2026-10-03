import { NextResponse } from 'next/server';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { currencySchema } from '@/lib/admin/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = adminHandler('settings.edit', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.currency.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Currency not found', 'NOT_FOUND', 404);

  const body = await req.json().catch(() => null);
  const parsed = currencySchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;

  // The default currency is the accounting base: its rate is locked at 1.
  const isBase = existing.isDefault;
  const nextRate = isBase ? 1 : (d.rateToBhd ?? Number(existing.rateToBhd));

  const currency = await prisma.$transaction(async (tx) => {
    const updated = await tx.currency.update({
      where: { id },
      data: {
        ...(d.nameEn !== undefined ? { nameEn: d.nameEn } : {}),
        ...(d.nameAr !== undefined ? { nameAr: d.nameAr } : {}),
        ...(d.symbolEn !== undefined ? { symbolEn: d.symbolEn } : {}),
        ...(d.symbolAr !== undefined ? { symbolAr: d.symbolAr } : {}),
        ...(d.decimals !== undefined ? { decimals: d.decimals } : {}),
        ...(d.symbolPosition !== undefined ? { symbolPosition: d.symbolPosition } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
        rateToBhd: nextRate,
      },
    });
    // Record rate changes so historical orders keep their captured rate.
    if (!isBase && d.rateToBhd !== undefined && Number(existing.rateToBhd) !== d.rateToBhd) {
      await tx.exchangeRate.create({ data: { currencyId: id, code: updated.code, rateToBhd: d.rateToBhd } });
    }
    return updated;
  });

  await prisma.auditLog.create({ data: { userId: admin.id, action: 'currency.update', entity: 'Currency', entityId: id, metadata: { rateToBhd: nextRate } } });
  return NextResponse.json({ ok: true, id: currency.id });
});
