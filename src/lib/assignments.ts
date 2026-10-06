import 'server-only';
import { prisma } from './prisma';
import { nextSequence } from './sequences';
import { resolveTailorFee, TailorFeeError } from './tailor-fees';
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

/** Assigns a single order item to a tailor, freezing the fee. */
export async function assignTailorToItem(input: AssignTailorInput) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: input.orderItemId },
      include: { product: { select: { nameEn: true, nameAr: true, tailorFeeBhd: true } } },
    });
    if (!item) throw new AssignmentError('Order item not found', 'NOT_FOUND');

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
    if (existingTask) {
      const task = await tx.productionTask.update({
        where: { id: existingTask.id },
        data: { tailorId: input.tailorId, feeBhd: fee, status: 'ASSIGNED' },
      });
      taskId = task.id;
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
