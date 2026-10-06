import 'server-only';
import { prisma } from './prisma';
import { nextSequence } from './sequences';
import { sumFrozenFees } from './tailor-fees';
import { SETTLEMENT_TRANSITIONS, canTransition } from './workflow';
import type { Prisma } from '@prisma/client';

/**
 * Tailor settlement service.
 *
 * Invariants enforced here (not merely in the UI):
 *  - a settlement belongs to exactly one tailor;
 *  - only eligible delivered, unsettled pieces can be added;
 *  - a piece can never be settled twice (also guaranteed by a unique index);
 *  - the total is always recomputed from frozen per-item fees;
 *  - a transfer proof is required to enter the TRANSFERRED state.
 */

export class SettlementError extends Error {
  constructor(message: string, public code: string = 'INVALID') {
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

const ACTION_TARGET = {
  approve: 'APPROVED',
  transfer: 'TRANSFERRED',
  pay: 'PAID',
  confirm: 'CONFIRMED',
  cancel: 'CANCELLED',
} as const;

/**
 * Applies a settlement state change, enforcing the workflow and the transfer
 * proof requirement. Transfers must carry a proof reference; the total is never
 * mutated here.
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

    return updated;
  });
}
