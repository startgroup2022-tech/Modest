import 'server-only';
import { prisma } from './prisma';
import { nextSequence } from './sequences';
import { resolveTailorFee, TailorFeeError } from './tailor-fees';
import { assertOrderSettledForProduction, ProductionGateError } from './production-gate';
import { notifyTailorAssigned } from './tailor-notifications';
import { PRODUCTION_TRANSITIONS, canTransition } from './workflow';
import type { Prisma } from '@prisma/client';

/**
 * Per-piece tailor assignment.
 *
 * Assignment is at the order-item level so one order can be split across
 * tailors. The fee is frozen onto the item (and mirrored onto the production
 * task) at this moment; later product fee changes never touch it. If no valid
 * fee can be resolved, assignment fails — there is no hidden fallback.
 */

export class AssignmentError extends Error {
  constructor(message: string, public code: string = 'INVALID') {
    super(message);
    this.name = 'AssignmentError';
  }
}

export interface AssignTailorInput {
  orderItemId: string;
  tailorId: string;
  /** Explicit fee from an authorised workflow; overrides the product default. */
  suppliedFeeBhd?: number | null;
  actorId: string;
  dueDate?: Date | null;
}

export interface AssignmentSideEffectInput {
  /** The production task whose tailor just changed. */
  taskId: string;
  taskCode: string;
  /** Tailor now responsible for the task; null when the task is unassigned. */
  tailorId: string | null;
  /** Tailor the task was assigned to before the change; null when unassigned. */
  previousTailorId: string | null;
  /** Order item the task belongs to, when it is a per-piece task. */
  orderItemId?: string | null;
  /** Frozen fee to mirror onto the order item; omitted to leave it untouched. */
  feeBhd?: number | null;
  /** Copy for the notification body. */
  titleEn: string;
  titleAr?: string | null;
  actorId?: string | null;
}

/**
 * The single place assignment side-effects happen: mirroring the assignment
 * onto the order item and telling the newly responsible tailor they have work.
 *
 * Every assignment entry point — the per-piece service below and the admin
 * production API (create and reassign) — funnels through here so the two can
 * never drift. It is deliberately transaction-scoped: the notification and the
 * mirror are written on the caller's `tx`, so a later failure in the same
 * transaction rolls them back (no notification for an assignment that never
 * committed).
 *
 * Emission rules, in one place:
 *  - exactly one notification per *actual* change to a named tailor;
 *  - a re-assignment to the same tailor is not "new work" and does not notify;
 *  - an un-assignment notifies nobody;
 *  - the mirror always re-points the order item, so a piece can never remain
 *    settled-payable to the tailor who lost it.
 */
export async function applyAssignmentSideEffects(
  tx: Prisma.TransactionClient,
  input: AssignmentSideEffectInput,
): Promise<void> {
  const changed = input.previousTailorId !== input.tailorId;

  if (input.orderItemId && changed) {
    await tx.orderItem.update({
      where: { id: input.orderItemId },
      data: {
        assignedTailorId: input.tailorId,
        assignedAt: input.tailorId ? new Date() : null,
        // Keep the frozen fee only while a tailor holds the piece; unassignment
        // clears the holder but never rewrites fee history.
        ...(input.tailorId && input.feeBhd != null ? { tailorFeeBhd: input.feeBhd } : {}),
      },
    });
  }

  if (changed && input.tailorId) {
    await notifyTailorAssigned(
      {
        tailorId: input.tailorId,
        taskId: input.taskId,
        taskCode: input.taskCode,
        titleEn: input.titleEn,
        titleAr: input.titleAr ?? null,
      },
      tx,
    );
  }
}

/** Assigns a single order item to a tailor, freezing the fee. */
export async function assignTailorToItem(input: AssignTailorInput) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: input.orderItemId },
      include: { product: { select: { nameEn: true, nameAr: true, tailorFeeBhd: true } } },
    });
    if (!item) throw new AssignmentError('Order item not found', 'NOT_FOUND');

    // Assignment starts production work, so it is gated on captured payment just
    // like the order-status transition. A direct assignment call cannot put an
    // unpaid order onto the sewing floor.
    try {
      await assertOrderSettledForProduction(item.orderId, tx);
    } catch (err) {
      if (err instanceof ProductionGateError) {
        throw new AssignmentError('Payment must be confirmed before assigning production work', 'PAYMENT_REQUIRED');
      }
      throw err;
    }

    const tailor = await tx.tailor.findUnique({ where: { id: input.tailorId } });
    if (!tailor) throw new AssignmentError('Tailor not found', 'NOT_FOUND');
    if (tailor.status !== 'ACTIVE') throw new AssignmentError('Tailor is not active', 'INACTIVE');

    let fee: number;
    try {
      fee = resolveTailorFee({
        productFeeBhd: item.product?.tailorFeeBhd != null ? Number(item.product.tailorFeeBhd) : null,
        suppliedFeeBhd: input.suppliedFeeBhd ?? null,
      });
    } catch (err) {
      if (err instanceof TailorFeeError) throw new AssignmentError(err.message, err.code);
      throw err;
    }

    const updated = await tx.orderItem.update({
      where: { id: item.id },
      data: {
        assignedTailorId: input.tailorId,
        assignedAt: new Date(),
        tailorFeeBhd: fee,
      },
    });

    // Mirror onto a production task, carrying the frozen fee so the sewing
    // floor and settlements agree on the amount.
    const existingTask = await tx.productionTask.findFirst({ where: { orderItemId: item.id } });
    let taskId: string;
    let taskCode: string;
    let previousTailorId: string | null;
    if (existingTask) {
      const task = await tx.productionTask.update({
        where: { id: existingTask.id },
        data: { tailorId: input.tailorId, feeBhd: fee, status: 'ASSIGNED' },
      });
      taskId = task.id;
      taskCode = task.code;
      previousTailorId = existingTask.tailorId;
    } else {
      const code = await nextSequence(tx, { key: 'production', prefix: 'PRD', pad: 6 });
      const task = await tx.productionTask.create({
        data: {
          code,
          orderId: item.orderId,
          orderItemId: item.id,
          productId: item.productId ?? null,
          tailorId: input.tailorId,
          titleEn: item.productName,
          titleAr: null,
          status: 'ASSIGNED',
          feeBhd: fee,
          dueDate: input.dueDate ?? null,
          createdById: input.actorId,
        },
      });
      taskId = task.id;
      taskCode = task.code;
      previousTailorId = null;
    }

    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        action: 'order_item.assign_tailor',
        entity: 'OrderItem',
        entityId: item.id,
        metadata: { tailorId: input.tailorId, feeBhd: fee, taskId } as never,
      },
    });

    // Notify only when the tailor actually changed; the mirror above already
    // re-pointed the item, so this path passes no orderItemId to avoid a
    // redundant write.
    await applyAssignmentSideEffects(tx, {
      taskId,
      taskCode,
      tailorId: input.tailorId,
      previousTailorId,
      titleEn: item.productName,
      titleAr: item.product?.nameAr ?? null,
    });

    return { item: updated, taskId, feeBhd: fee };
  });
}

/** Assigns every (unassigned) item of an order to a single tailor. */
export async function assignTailorToOrder(input: {
  orderId: string;
  tailorId: string;
  suppliedFeeBhd?: number | null;
  actorId: string;
  dueDate?: Date | null;
}) {
  const items = await prisma.orderItem.findMany({
    where: { orderId: input.orderId, assignedTailorId: null },
    select: { id: true },
  });
  const results = [];
  for (const item of items) {
    results.push(
      await assignTailorToItem({
        orderItemId: item.id,
        tailorId: input.tailorId,
        suppliedFeeBhd: input.suppliedFeeBhd,
        actorId: input.actorId,
        dueDate: input.dueDate,
      }),
    );
  }
  return results;
}

/**
 * Names (or clears) the tailor on an existing production task — the admin
 * queue's reassign control.
 *
 * Like `assignTailorToItem`, this is the domain layer, so the rules hold for a
 * direct API call: a named tailor must exist and be ACTIVE, the assignment must
 * be a legal workflow edge, and the order must be paid before work is handed
 * over. The assignment side-effects (order-item mirror + the single
 * `production.assigned` notification to the new tailor) are applied through the
 * same helper the per-piece service uses, so the queue and per-piece paths
 * cannot diverge and a reassignment never leaks to the previous tailor.
 */
export async function assignTailorToProductionTask(input: {
  taskId: string;
  /** New tailor, or null to unassign. */
  tailorId: string | null;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.productionTask.findUnique({ where: { id: input.taskId } });
    if (!task) throw new AssignmentError('Task not found', 'NOT_FOUND');

    const target = input.tailorId ? 'ASSIGNED' : 'PENDING';
    if (!canTransition(PRODUCTION_TRANSITIONS, task.status, target)) {
      throw new AssignmentError(`Cannot assign a task in ${task.status} state`, 'INVALID_TRANSITION');
    }

    let feeBhd: number | null = task.feeBhd != null ? Number(task.feeBhd) : null;
    if (input.tailorId) {
      const tailor = await tx.tailor.findUnique({ where: { id: input.tailorId } });
      if (!tailor) throw new AssignmentError('Tailor not found', 'NOT_FOUND');
      if (tailor.status !== 'ACTIVE') throw new AssignmentError('Tailor is not active', 'INACTIVE');

      // Handing work to a tailor starts production; it is gated on payment just
      // like the per-piece and order-transition paths.
      try {
        await assertOrderSettledForProduction(task.orderId, tx);
      } catch (err) {
        if (err instanceof ProductionGateError) {
          throw new AssignmentError('Payment must be confirmed before assigning production work', 'PAYMENT_REQUIRED');
        }
        throw err;
      }

      // A task created without a tailor carries no frozen fee. Resolve it from
      // the piece's product now so the reassignment path freezes a fee exactly
      // as the per-piece service does — otherwise the piece could never be
      // settled. An unresolvable fee is left null (not invented).
      if (feeBhd == null && task.orderItemId) {
        const item = await tx.orderItem.findUnique({
          where: { id: task.orderItemId },
          select: { tailorFeeBhd: true, product: { select: { tailorFeeBhd: true } } },
        });
        if (item?.tailorFeeBhd != null) {
          feeBhd = Number(item.tailorFeeBhd);
        } else if (item?.product?.tailorFeeBhd != null) {
          feeBhd = Number(item.product.tailorFeeBhd);
        }
      }
    }

    const updated = await tx.productionTask.update({
      where: { id: task.id },
      data: { tailorId: input.tailorId, status: target, ...(feeBhd != null ? { feeBhd } : {}) },
    });

    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        action: 'production.assign_tailor',
        entity: 'ProductionTask',
        entityId: task.id,
        metadata: { tailorId: input.tailorId, from: task.status, to: target, feeBhd } as never,
      },
    });

    await applyAssignmentSideEffects(tx, {
      taskId: task.id,
      taskCode: task.code,
      tailorId: input.tailorId,
      previousTailorId: task.tailorId,
      orderItemId: task.orderItemId,
      feeBhd,
      titleEn: task.titleEn,
      titleAr: task.titleAr,
    });

    return { task: updated };
  });
}
