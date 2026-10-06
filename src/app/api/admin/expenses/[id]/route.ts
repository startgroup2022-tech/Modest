import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { expenseSchema, dateOrNull } from '@/lib/admin/schemas';
import { EXPENSE_TRANSITIONS, canTransition } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

const actionSchema = z
  .object({
    action: z.enum(['submit', 'approve', 'reject', 'pay']),
    approvalNote: z.string().max(1000).optional(),
  })
  .refine((d) => d.action !== 'reject' || (d.approvalNote ?? '').trim().length > 0, {
    message: 'A reason is required when rejecting an expense',
    path: ['approvalNote'],
  });

export const PATCH = adminHandler('expenses.manage', async ({ admin, req }) => {
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop()!;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new AdminActionError('Expense not found', 'NOT_FOUND', 404);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // Status transitions take a compact { action } payload; edits take full fields.
  if (body && typeof body.action === 'string') {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid action', issues: parsed.error.issues },
        { status: 422 },
      );
    }
    const { action, approvalNote } = parsed.data;
    const target = { submit: 'SUBMITTED', approve: 'APPROVED', reject: 'REJECTED', pay: 'PAID' } as const;
    const next = target[action];
    // Enforce the workflow server-side: no paying an unapproved expense, no
    // re-approving a paid one, no silently resurrecting a rejected expense.
    if (!canTransition(EXPENSE_TRANSITIONS, existing.status, next)) {
      return NextResponse.json(
        { error: `Cannot ${action} an expense in ${existing.status} state`, code: 'INVALID_TRANSITION' },
        { status: 409 },
      );
    }
    if ((action === 'approve' || action === 'reject') && !admin.permissions.has('finance.approve')) {
      return NextResponse.json({ error: 'You cannot approve expenses' }, { status: 403 });
    }
    // Separation of duties: nobody approves or rejects their own expense.
    if ((action === 'approve' || action === 'reject') && existing.submittedById === admin.id) {
      return NextResponse.json(
        { error: 'You cannot approve or reject an expense you submitted', code: 'SELF_APPROVAL' },
        { status: 403 },
      );
    }
    const map = {
      submit: { status: 'SUBMITTED' as const },
      approve: { status: 'APPROVED' as const, approvedById: admin.id, approvedAt: new Date(), approvalNote: approvalNote ?? null },
      reject: { status: 'REJECTED' as const, approvedById: admin.id, approvedAt: new Date(), approvalNote: approvalNote ?? null },
      pay: { status: 'PAID' as const, paidAt: new Date() },
    };
    await prisma.expense.update({ where: { id }, data: map[action] });
    await prisma.auditLog.create({ data: { userId: admin.id, action: `expense.${action}`, entity: 'Expense', entityId: id, metadata: { note: approvalNote ?? null } as never } });
    return NextResponse.json({ ok: true, id });
  }

  // Figures are locked once an expense leaves DRAFT, except a REJECTED expense
  // which may be corrected and returned to DRAFT for resubmission.
  if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Only draft or rejected expenses can be edited', code: 'LOCKED' }, { status: 409 });
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
      orderId: d.orderId || null, settlementId: d.settlementId || null, productId: d.productId || null,
      // Editing a rejected expense reopens it as a draft.
      ...(existing.status === 'REJECTED' ? { status: 'DRAFT' as const } : {}),
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
