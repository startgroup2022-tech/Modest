import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { expenseSchema, dateOrNull } from '@/lib/admin/schemas';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'pay']),
  approvalNote: z.string().max(1000).optional(),
});

export const PATCH = adminHandler('expenses.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Expense not found', 'NOT_FOUND', 404);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // Status transitions take a compact { action } payload; edits take full fields.
  if (body && typeof body.action === 'string') {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 422 });
    const { action, approvalNote } = parsed.data;
    const map = {
      submit: { status: 'SUBMITTED' as const },
      approve: { status: 'APPROVED' as const, approvedById: admin.id, approvedAt: new Date(), approvalNote: approvalNote ?? null },
      reject: { status: 'REJECTED' as const, approvedById: admin.id, approvedAt: new Date(), approvalNote: approvalNote ?? null },
      pay: { status: 'PAID' as const, paidAt: new Date() },
    };
    if ((action === 'approve' || action === 'reject') && !admin.permissions.has('finance.approve')) {
      return NextResponse.json({ error: 'You cannot approve expenses' }, { status: 403 });
    }
    await prisma.expense.update({ where: { id }, data: map[action] });
    await prisma.auditLog.create({ data: { userId: admin.id, action: `expense.${action}`, entity: 'Expense', entityId: id, metadata: {} } });
    return NextResponse.json({ ok: true, id });
  }

  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  const d = parsed.data;
  await prisma.expense.update({
    where: { id },
    data: {
      categoryId: d.categoryId || null, description: d.description, amountBhd: d.amountBhd, currencyCode: d.currencyCode,
      vendor: d.vendor || null, notes: d.notes || null, attachmentUrl: d.attachmentUrl || null,
      expenseDate: dateOrNull(d.expenseDate) ?? existing.expenseDate,
    },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'expense.update', entity: 'Expense', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true, id });
});

export const DELETE = adminHandler('expenses.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Expense not found', 'NOT_FOUND', 404);
  if (existing.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft expenses can be deleted' }, { status: 409 });
  await prisma.expense.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'expense.delete', entity: 'Expense', entityId: id, metadata: {} } });
  return NextResponse.json({ ok: true });
});
