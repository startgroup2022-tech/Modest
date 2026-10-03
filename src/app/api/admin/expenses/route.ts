import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { expenseSchema, dateOrNull } from '@/lib/admin/schemas';

export const dynamic = 'force-dynamic';

function nextNumber() {
  return `EXP-${Date.now().toString(36).toUpperCase()}`;
}

export const POST = adminHandler('expenses.manage', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  const d = parsed.data;
  const row = await prisma.expense.create({
    data: {
      number: nextNumber(),
      categoryId: d.categoryId || null,
      description: d.description,
      amountBhd: d.amountBhd,
      currencyCode: d.currencyCode,
      vendor: d.vendor || null,
      notes: d.notes || null,
      attachmentUrl: d.attachmentUrl || null,
      expenseDate: dateOrNull(d.expenseDate) ?? new Date(),
      status: 'DRAFT',
      submittedById: admin.id,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'expense.create', entity: 'Expense', entityId: row.id, metadata: { amount: d.amountBhd } } });
  return NextResponse.json({ ok: true, id: row.id });
});
