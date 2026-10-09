import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { QC_ALLOWED_STATES, PRODUCTION_TRANSITIONS, canTransition } from './workflow';
import { notifyTailorQc } from './tailor-notifications';

/**
 * True when an error is InnoDB's "record has changed since last read" (1020)
 * raised by a write that lost a race with a concurrent transaction. Treated as
 * a lost QC decision rather than an unexpected failure.
 */
function isConcurrentWriteConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') return true;
  const message = err instanceof Error ? err.message : '';
  return /Record has changed since last read|1020|deadlock|write conflict/i.test(message);
}

/**
 * Quality control — the single place an inspection decision is made.
 *
 * The admin QC API and any future entry point funnel through `runQcInspection`
 * so the rules live in exactly one place:
 *  - QC only runs on a task whose work has actually started (`QC_ALLOWED_STATES`);
 *  - a non-PASSED result must carry a rejection reason;
 *  - each run appends a new immutable `QcRecord`, continuing the item's attempt
 *    history — nothing is overwritten;
 *  - PASS completes the task, otherwise it returns to REWORK (and reopens a
 *    COMPLETED task, so a post-completion failure is representable);
 *  - a duplicate or conflicting decision is refused rather than silently applied
 *    (the caller passes the `expectedStatus` it believes the task is in).
 */

export type QcResult = 'PASSED' | 'FAILED' | 'REWORK_REQUIRED';

export interface RunQcInput {
  taskId: string;
  result: QcResult;
  checklist: {
    measurementsOk?: boolean;
    stitchingOk?: boolean;
    fabricOk?: boolean;
    finishingOk?: boolean;
    accessoriesOk?: boolean;
    packagingOk?: boolean;
  };
  /** Required whenever the result is not PASSED. */
  rejectionReason?: string | null;
  notes?: string | null;
  /** The QC user. */
  actorId: string;
  /**
   * Status the caller observed when it loaded the piece. When present, the
   * inspection is refused if the task has since moved, so two inspectors cannot
   * race the same piece into conflicting records.
   */
  expectedStatus?: string | null;
}

export class QcError extends Error {
  constructor(message: string, public code: string = 'INVALID', public status = 409) {
    super(message);
    this.name = 'QcError';
  }
}

export async function runQcInspection(input: RunQcInput) {
  const reason = (input.rejectionReason ?? '').trim();
  if (input.result !== 'PASSED' && !reason) {
    throw new QcError('A rejection reason is required when quality control does not pass', 'REASON_REQUIRED', 422);
  }

  return prisma.$transaction(async (tx) => {
    const task = await tx.productionTask.findUnique({ where: { id: input.taskId } });
    if (!task) throw new QcError('Task not found', 'NOT_FOUND', 404);

    if (input.expectedStatus && input.expectedStatus !== task.status) {
      throw new QcError(
        `This piece has already been inspected or moved on (now ${task.status})`,
        'CONFLICT',
        409,
      );
    }

    // QC is only meaningful once work has started; a "PASSED" on a piece that
    // never began (or was cancelled) would be a phantom pass.
    if (!QC_ALLOWED_STATES.includes(task.status)) {
      throw new QcError(`Cannot run QC on a task in ${task.status} state`, 'INVALID_TRANSITION', 409);
    }

    const target = input.result === 'PASSED' ? 'COMPLETED' : 'REWORK';
    if (!canTransition(PRODUCTION_TRANSITIONS, task.status, target)) {
      throw new QcError(`Cannot apply ${target} to a task in ${task.status} state`, 'INVALID_TRANSITION', 409);
    }

    // Move the task with a compare-and-swap on the status we just read. A
    // concurrent inspection of the same piece either matches zero rows (the
    // other transaction already committed) or, under InnoDB's REPEATABLE READ,
    // fails with a serialization error (1020) — both mean "you lost the race".
    // Exactly one decision wins and the loser is refused with CONFLICT rather
    // than appending a conflicting record.
    let moved: { count: number };
    try {
      moved = await tx.productionTask.updateMany({
        where: { id: input.taskId, status: task.status },
        data: {
          status: target,
          completedAt: target === 'COMPLETED' ? new Date() : null,
        },
      });
    } catch (err) {
      if (isConcurrentWriteConflict(err)) {
        throw new QcError('This piece has already been inspected or moved on', 'CONFLICT', 409);
      }
      throw err;
    }
    if (moved.count === 0) {
      throw new QcError(
        'This piece has already been inspected or moved on',
        'CONFLICT',
        409,
      );
    }

    const previous = await tx.qcRecord.count({ where: { taskId: input.taskId } });
    const record = await tx.qcRecord.create({
      data: {
        taskId: input.taskId,
        orderItemId: task.orderItemId ?? null,
        tailorId: task.tailorId ?? null,
        attempt: previous + 1,
        status: input.result,
        measurementsOk: input.checklist.measurementsOk ?? false,
        stitchingOk: input.checklist.stitchingOk ?? false,
        fabricOk: input.checklist.fabricOk ?? false,
        finishingOk: input.checklist.finishingOk ?? false,
        accessoriesOk: input.checklist.accessoriesOk ?? false,
        packagingOk: input.checklist.packagingOk ?? false,
        rejectionReason: input.result === 'PASSED' ? null : reason,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        checkedById: input.actorId,
        checkedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        action: 'qc.run',
        entity: 'QcRecord',
        entityId: record.id,
        metadata: {
          status: input.result,
          attempt: record.attempt,
          from: task.status,
          to: target,
          orderItemId: task.orderItemId ?? null,
        } as never,
      },
    });

    // Tell the tailor who worked the piece — including the mandatory reason so
    // rework is actionable from the portal.
    if (task.tailorId) {
      await notifyTailorQc(
        {
          tailorId: task.tailorId,
          taskId: task.id,
          taskCode: task.code,
          passed: input.result === 'PASSED',
          reason: input.result === 'PASSED' ? null : reason,
        },
        tx,
      );
    }

    return record;
  });
}
