import 'server-only';
import { prisma } from './prisma';
import { nextSequence } from './sequences';
import { sumFrozenFees } from './tailor-fees';
import { SETTLEMENT_TRANSITIONS, canTransition } from './workflow';
import { notifyTailorSettlement } from './tailor-notifications';
import type { Prisma } from '@prisma/client';

/**
 * Tailor settlement service.
 *
 * Invariants enforced here (not merely in the UI):
 *  - a settlement belongs to exactly one tailor;
 *  - only eligible delivered, unsettled pieces can be added;
 *  - a piece can never be settled twice (also guaranteed by a unique index);
 *  - the total is always recomputed from frozen per-item fees;
 *  - a transfer proof is required to enter the TRANSFERRED state;
 *  - payout may not skip the transfer step (APPROVED → TRANSFERRED → PAID);
 *  - a payout raises exactly one linked TAILOR_DUE expense, idempotently.
 */

export class SettlementError extends Error {
  constructor(message: string, public code: string = 'INVALID', public status = 400) {
    super(message);
    this.name = 'SettlementError';
  }
}

export interface CreateSettlementInput {
  tailorId: string;
  orderItemIds: string[];
  periodStart?: Date | null;
  periodEnd?: Date | null;
  adjustmentsBhd?: number;
  notes?: string | null;
  actorId: string;
}

/**
 * Creates a settlement from explicit order items. Every item must already be
 * assigned to the settlement's tailor with a frozen fee, and must not belong to
 * another settlement. The total is derived from those frozen fees.
 */
export async function createSettlement(input: CreateSettlementInput) {
  if (!input.orderItemIds.length) {
    throw new SettlementError('Select at least one delivered piece', 'EMPTY');
  }

  return prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({
      where: { id: { in: input.orderItemIds } },
      include: { settlementItems: true },
    });

    if (items.length !== input.orderItemIds.length) {
      throw new SettlementError('One or more pieces were not found', 'NOT_FOUND');
    }

    for (const item of items) {
      if (item.assignedTailorId !== input.tailorId) {
        throw new SettlementError(
          'A settlement may only contain pieces assigned to its tailor',
          'WRONG_TAILOR',
        );
      }
      if (item.tailorFeeBhd == null) {
        throw new SettlementError('A piece has no frozen tailoring fee', 'MISSING_FEE');
      }
      if (item.settlementItems.length > 0) {
        throw new SettlementError('A piece has already been settled', 'ALREADY_SETTLED');
      }
    }

    const grossBhd = sumFrozenFees(items.map((i) => Number(i.tailorFeeBhd)));
    const adjustmentsBhd = Math.round(((input.adjustmentsBhd ?? 0) + Number.EPSILON) * 1000) / 1000;
    const netBhd = Math.round((grossBhd + adjustmentsBhd + Number.EPSILON) * 1000) / 1000;

    const number = await nextSequence(tx, { key: 'settlement', prefix: 'STL', pad: 6 });

    const settlement = await tx.tailorSettlement.create({
      data: {
        number,
        tailorId: input.tailorId,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        tasksCount: items.length,
        grossBhd,
        adjustmentsBhd,
        netBhd,
        status: 'PENDING',
        notes: input.notes ?? null,
        items: {
          create: items.map((i) => ({
            orderItemId: i.id,
            tailorFeeBhd: Number(i.tailorFeeBhd),
          })),
        },
      },
      include: { items: true },
    });

    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        action: 'settlement.create',
        entity: 'TailorSettlement',
        entityId: settlement.id,
        metadata: { tailorId: input.tailorId, items: items.length, netBhd } as never,
      },
    });

    await notifyTailorSettlement(
      { tailorId: input.tailorId, settlementId: settlement.id, number: settlement.number, event: 'created', netBhd },
      tx,
    );

    return settlement;
  });
}

/** Delivered, assigned, unsettled pieces eligible for a tailor's settlement. */
export async function eligibleSettlementItems(tailorId: string) {
  return prisma.orderItem.findMany({
    where: {
      assignedTailorId: tailorId,
      tailorFeeBhd: { not: null },
      settlementItems: { none: {} },
      order: { status: 'DELIVERED' },
    },
    orderBy: { assignedAt: 'asc' },
    select: {
      id: true,
      productName: true,
      variantLabel: true,
      tailorFeeBhd: true,
      assignedAt: true,
      order: { select: { orderNumber: true, deliveredAt: true } },
    },
  });
}

export interface SettlementActionInput {
  settlementId: string;
  action: 'approve' | 'transfer' | 'pay' | 'confirm' | 'cancel';
  actorId: string;
  transferProofUrl?: string | null;
  transferReference?: string | null;
  note?: string | null;
}

/** Settlement list for a tailor's own portal. Scoped by tailor id. */
export async function listTailorSettlements(tailorId: string) {
  const rows = await prisma.tailorSettlement.findMany({
    where: { tailorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      number: true,
      status: true,
      tasksCount: true,
      grossBhd: true,
      adjustmentsBhd: true,
      netBhd: true,
      paidBhd: true,
      periodStart: true,
      periodEnd: true,
      transferredAt: true,
      paidAt: true,
      confirmedByTailorAt: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    itemsCount: r._count.items,
    grossBhd: Number(r.grossBhd),
    adjustmentsBhd: Number(r.adjustmentsBhd),
    netBhd: Number(r.netBhd),
    paidBhd: Number(r.paidBhd),
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    transferredAt: r.transferredAt,
    paidAt: r.paidAt,
    confirmedByTailorAt: r.confirmedByTailorAt,
    createdAt: r.createdAt,
  }));
}

/** One settlement with its pieces, scoped to the tailor. Null if not theirs. */
export async function getTailorSettlement(tailorId: string, settlementId: string) {
  const s = await prisma.tailorSettlement.findFirst({
    where: { id: settlementId, tailorId },
    select: {
      id: true,
      number: true,
      status: true,
      grossBhd: true,
      adjustmentsBhd: true,
      netBhd: true,
      paidBhd: true,
      notes: true,
      periodStart: true,
      periodEnd: true,
      transferReference: true,
      transferredAt: true,
      paidAt: true,
      confirmedByTailorAt: true,
      createdAt: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          tailorFeeBhd: true,
          orderItem: { select: { productName: true, variantLabel: true, sku: true } },
        },
      },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    number: s.number,
    status: s.status,
    grossBhd: Number(s.grossBhd),
    adjustmentsBhd: Number(s.adjustmentsBhd),
    netBhd: Number(s.netBhd),
    paidBhd: Number(s.paidBhd),
    notes: s.notes,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    transferReference: s.transferReference,
    transferredAt: s.transferredAt,
    paidAt: s.paidAt,
    confirmedByTailorAt: s.confirmedByTailorAt,
    createdAt: s.createdAt,
    items: s.items.map((i) => ({
      id: i.id,
      productName: i.orderItem?.productName ?? '—',
      variantLabel: i.orderItem?.variantLabel ?? null,
      sku: i.orderItem?.sku ?? null,
      feeBhd: Number(i.tailorFeeBhd),
    })),
  };
}

/**
 * Records a tailor's confirmation of a settlement. Only a tailor (never a
 * supervisor) may confirm, only their own settlement, and only once it has been
 * paid. Confirmation is a separate, attributable act from the admin's payout.
 */
export async function confirmSettlementByTailor(input: {
  settlementId: string;
  tailorId: string;
  ip?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.tailorSettlement.findFirst({
      where: { id: input.settlementId, tailorId: input.tailorId },
      select: { id: true, status: true, number: true, confirmedByTailorAt: true },
    });
    if (!settlement) throw new SettlementError('Settlement not found', 'NOT_FOUND', 404);
    if (!canTransition(SETTLEMENT_TRANSITIONS, settlement.status, 'CONFIRMED')) {
      throw new SettlementError('A settlement can only be confirmed after it has been paid', 'INVALID_TRANSITION', 409);
    }
    const updated = await tx.tailorSettlement.update({
      where: { id: settlement.id },
      data: { status: 'CONFIRMED', confirmedByTailorAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        action: 'settlement.confirm_by_tailor',
        entity: 'TailorSettlement',
        entityId: settlement.id,
        metadata: { number: settlement.number, tailorId: input.tailorId } as never,
        ip: input.ip ?? null,
      },
    });
    await notifyTailorSettlement(
      {
        tailorId: input.tailorId,
        settlementId: settlement.id,
        number: settlement.number,
        event: 'confirmed',
      },
      tx,
    );
    return updated;
  });
}

const ACTION_TARGET = {
  approve: 'APPROVED',
  transfer: 'TRANSFERRED',
  pay: 'PAID',
  confirm: 'CONFIRMED',
  cancel: 'CANCELLED',
} as const;

/**
 * Resolves the system TAILOR_DUE expense category, creating it on first use.
 * Accounting keys off the stable `type`, never the display name, so renaming
 * the category can never break the linkage.
 */
async function resolveTailorDueCategoryId(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.expenseCategory.findFirst({
    where: { type: 'TAILOR_DUE' },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.expenseCategory.create({
    data: { type: 'TAILOR_DUE', nameEn: 'Tailor dues', nameAr: 'مستحقات الخياطة', isSystem: true },
  });
  return created.id;
}

/**
 * Raises exactly one TAILOR_DUE expense for a settlement, linked via
 * `TailorSettlement.expenseId` (unique). Idempotent: a settlement that already
 * carries an expense returns it unchanged, so a retried/duplicate payout can
 * never double-count the tailor's dues in accounting.
 *
 * The expense is created already PAID — it records a payout that has happened,
 * it is not a request awaiting approval.
 */
export async function ensureSettlementExpense(
  settlementId: string,
  actorId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const run = async (tx: Prisma.TransactionClient) => {
    const settlement = await tx.tailorSettlement.findUnique({
      where: { id: settlementId },
      include: { tailor: { select: { nameEn: true, nameAr: true, code: true } } },
    });
    if (!settlement) throw new SettlementError('Settlement not found', 'NOT_FOUND');
    if (settlement.expenseId) {
      const existing = await tx.expense.findUnique({ where: { id: settlement.expenseId } });
      if (existing) return { expense: existing, created: false };
    }

    const categoryId = await resolveTailorDueCategoryId(tx);
    const number = await nextSequence(tx, { key: 'expense', prefix: 'EXP', pad: 6 });
    const now = new Date();
    const expense = await tx.expense.create({
      data: {
        number,
        categoryId,
        description: `Tailor settlement ${settlement.number} — ${settlement.tailor.nameEn}`,
        amountBhd: settlement.netBhd,
        currencyCode: 'BHD',
        expenseDate: settlement.paidAt ?? now,
        status: 'PAID',
        paidAt: settlement.paidAt ?? now,
        submittedById: actorId,
        approvedById: actorId,
        approvedAt: now,
        settlementId: settlement.id,
        notes: `Auto-generated on settlement payout (${settlement.tailor.code ?? settlement.tailor.nameEn})`,
      },
    });
    await tx.tailorSettlement.update({ where: { id: settlement.id }, data: { expenseId: expense.id } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'settlement.expense_created',
        entity: 'Expense',
        entityId: expense.id,
        metadata: { settlementId: settlement.id, amountBhd: Number(settlement.netBhd) } as never,
      },
    });
    return { expense, created: true };
  };

  // Callers that already hold a transaction pass it in; standalone callers get
  // their own so the create + link commit atomically.
  if ('$transaction' in client) return client.$transaction(run);
  return run(client);
}

/**
 * Applies a settlement state change, enforcing the workflow and the transfer
 * proof requirement. Transfers must carry a proof reference, and a payout may
 * only follow a recorded transfer (`APPROVED → TRANSFERRED → PAID`); the total
 * is never mutated here.
 *
 * Paying a settlement raises its linked TAILOR_DUE expense in the same
 * transaction, so the payout and the accounting entry commit together.
 */
export async function applySettlementAction(input: SettlementActionInput) {
  const target = ACTION_TARGET[input.action];

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.tailorSettlement.findUnique({
      where: { id: input.settlementId },
      include: { items: true },
    });
    if (!settlement) throw new SettlementError('Settlement not found', 'NOT_FOUND');
    if (!canTransition(SETTLEMENT_TRANSITIONS, settlement.status, target)) {
      throw new SettlementError(
        `Cannot ${input.action} a settlement in ${settlement.status} state`,
        'INVALID_TRANSITION',
      );
    }

    if (input.action === 'transfer' && !(input.transferProofUrl || input.transferReference)) {
      throw new SettlementError('A transfer proof is required to mark a settlement transferred', 'PROOF_REQUIRED');
    }

    // Money may only leave once a transfer with proof has been recorded. The
    // workflow map already forbids PENDING→PAID; this closes the remaining
    // APPROVED→PAID shortcut so no payout can skip the proof step.
    if (input.action === 'pay' && settlement.status !== 'TRANSFERRED') {
      throw new SettlementError(
        'A settlement must be transferred (with proof) before it can be paid',
        'PROOF_REQUIRED',
      );
    }

    const data: Prisma.TailorSettlementUncheckedUpdateInput = { status: target };
    if (input.action === 'approve') {
      data.approvedById = input.actorId;
      data.approvedAt = new Date();
    }
    if (input.action === 'transfer') {
      data.transferredAt = new Date();
      data.transferProofUrl = input.transferProofUrl ?? null;
      data.transferReference = input.transferReference ?? null;
    }
    if (input.action === 'pay') {
      data.paidAt = new Date();
      data.paidBhd = settlement.netBhd;
    }
    if (input.action === 'confirm') {
      data.confirmedByTailorAt = new Date();
    }

    const updated = await tx.tailorSettlement.update({ where: { id: settlement.id }, data });

    // Raise the linked expense on payout (idempotent via the unique expenseId).
    if (input.action === 'pay') {
      await ensureSettlementExpense(settlement.id, input.actorId, tx);
    }

    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        action: `settlement.${input.action}`,
        entity: 'TailorSettlement',
        entityId: settlement.id,
        metadata: {
          number: settlement.number,
          from: settlement.status,
          to: target,
          note: input.note ?? null,
        } as never,
      },
    });

    const notifyEvent =
      input.action === 'transfer' ? 'transferred'
      : input.action === 'pay' ? 'paid'
      : input.action === 'confirm' ? 'confirmed'
      : null;
    if (notifyEvent) {
      await notifyTailorSettlement(
        {
          tailorId: settlement.tailorId,
          settlementId: settlement.id,
          number: settlement.number,
          event: notifyEvent,
          netBhd: Number(settlement.netBhd),
        },
        tx,
      );
    }

    return updated;
  });
}
