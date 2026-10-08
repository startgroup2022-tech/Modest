import 'server-only';
import { prisma } from './prisma';
import { PRODUCTION_TRANSITIONS, canTransition } from './workflow';
import { assertOrderSettledForProduction, ProductionGateError } from './production-gate';
import { isMeasurementSnapshot, type MeasurementSnapshot } from './order-measurements';

/**
 * Tailor Portal work read/write service.
 *
 * Everything a tailor sees is assembled here through an explicit allow-list
 * projection. Customer money never crosses this boundary: order totals, item
 * prices, discounts, payments and profit are simply not selected. A tailor sees
 * the piece (product, size, measurements), the deadline, their own frozen fee,
 * QC outcomes and their own settlements — nothing about what the customer paid.
 *
 * Ownership is enforced on the tailor id, not on a UI flag: a query is always
 * scoped to `tailorId`, and a task that does not belong to that tailor is
 * indistinguishable from one that does not exist.
 */

export class TailorWorkError extends Error {
  constructor(message: string, public code: string = 'INVALID', public status = 400) {
    super(message);
    this.name = 'TailorWorkError';
  }
}

const OPEN_TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED_FOR_QC', 'REWORK'] as const;

export interface TailorMeasurementView {
  kind: 'READY' | 'CUSTOM';
  unit: string;
  sizeCode: string | null;
  cutNameEn: string | null;
  cutNameAr: string | null;
  fields: { key: string; labelEn: string; labelAr: string; value: number }[];
}

/** Normalizes the two immutable snapshot shapes into one display shape. */
function measurementView(item: {
  measurementKind: string | null;
  sizeCode: string | null;
  sizeSnapshot: unknown;
  measurementSnapshot: unknown;
}): TailorMeasurementView | null {
  const snapshot: MeasurementSnapshot | null =
    isMeasurementSnapshot(item.measurementSnapshot) ? item.measurementSnapshot
    : isMeasurementSnapshot(item.sizeSnapshot) ? item.sizeSnapshot
    : null;
  if (!snapshot) return null;

  const fields = Object.entries(snapshot.values).map(([key, value]) => ({
    key,
    labelEn: snapshot.fieldLabels[key]?.en ?? key,
    labelAr: snapshot.fieldLabels[key]?.ar ?? key,
    value,
  }));

  return {
    kind: snapshot.kind,
    unit: snapshot.unit,
    sizeCode: snapshot.kind === 'READY' ? snapshot.sizeCode : item.sizeCode,
    cutNameEn: snapshot.cutNameEn,
    cutNameAr: snapshot.cutNameAr,
    fields,
  };
}

/** QC history is read-only and shown newest-first; reasons are never hidden. */
function qcView(records: {
  id: string;
  attempt: number;
  status: string;
  rejectionReason: string | null;
  notes: string | null;
  checkedAt: Date | null;
}[]) {
  return records
    .slice()
    .sort((a, b) => b.attempt - a.attempt)
    .map((r) => ({
      id: r.id,
      attempt: r.attempt,
      status: r.status,
      rejectionReason: r.rejectionReason,
      notes: r.notes,
      checkedAt: r.checkedAt,
    }));
}

export interface TailorTaskListItem {
  id: string;
  code: string;
  titleEn: string;
  titleAr: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  feeBhd: number | null;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  measurementKind: string | null;
  sizeCode: string | null;
  orderNumber: string;
  acceptedAt: Date | null;
  startedAt: Date | null;
  submittedForQcAt: Date | null;
  lastQc: { status: string; rejectionReason: string | null } | null;
  overdue: boolean;
}

function isOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate) return false;
  if ((OPEN_TASK_STATUSES as readonly string[]).includes(status) === false) return false;
  return dueDate.getTime() < Date.now();
}

/**
 * Lists the pieces assigned to a tailor. A task without an order item (e.g. an
 * order-level task) is still shown, but its product snapshot fields are null.
 */
export async function listTailorTasks(
  tailorId: string,
  opts: { status?: string; includeCompleted?: boolean } = {},
): Promise<TailorTaskListItem[]> {
  const tasks = await prisma.productionTask.findMany({
    where: {
      tailorId,
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.status || opts.includeCompleted ? {} : { status: { not: 'CANCELLED' } }),
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      code: true,
      titleEn: true,
      titleAr: true,
      status: true,
      priority: true,
      dueDate: true,
      feeBhd: true,
      acceptedAt: true,
      startedAt: true,
      submittedForQcAt: true,
      order: { select: { orderNumber: true } },
      orderItem: {
        select: {
          productName: true,
          variantLabel: true,
          sku: true,
          imageUrl: true,
          measurementKind: true,
          sizeCode: true,
        },
      },
      qcRecords: {
        orderBy: { attempt: 'desc' },
        take: 1,
        select: { status: true, rejectionReason: true },
      },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    code: t.code,
    titleEn: t.titleEn,
    titleAr: t.titleAr,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    feeBhd: t.feeBhd != null ? Number(t.feeBhd) : null,
    productName: t.orderItem?.productName ?? t.titleEn,
    variantLabel: t.orderItem?.variantLabel ?? null,
    sku: t.orderItem?.sku ?? null,
    imageUrl: t.orderItem?.imageUrl ?? null,
    measurementKind: t.orderItem?.measurementKind ?? null,
    sizeCode: t.orderItem?.sizeCode ?? null,
    orderNumber: t.order.orderNumber,
    acceptedAt: t.acceptedAt,
    startedAt: t.startedAt,
    submittedForQcAt: t.submittedForQcAt,
    lastQc: t.qcRecords[0] ? { status: t.qcRecords[0].status, rejectionReason: t.qcRecords[0].rejectionReason } : null,
    overdue: isOverdue(t.dueDate, t.status),
  }));
}

export interface TailorTaskDetail extends TailorTaskListItem {
  notes: string | null;
  measurement: TailorMeasurementView | null;
  qcHistory: ReturnType<typeof qcView>;
  /** Allowed next statuses the tailor may drive from here. */
  actions: TailorTaskAction[];
}

export type TailorTaskAction = 'accept' | 'start' | 'submit_for_qc';

const ACTION_TARGETS: Record<TailorTaskAction, string> = {
  accept: 'ACCEPTED',
  start: 'IN_PROGRESS',
  submit_for_qc: 'SUBMITTED_FOR_QC',
};

/** The tailor-drivable actions available from a task's current status. */
export function availableTailorActions(status: string): TailorTaskAction[] {
  const out: TailorTaskAction[] = [];
  for (const action of Object.keys(ACTION_TARGETS) as TailorTaskAction[]) {
    if (canTransition(PRODUCTION_TRANSITIONS, status, ACTION_TARGETS[action])) out.push(action);
  }
  return out;
}

/** Loads one task, scoped to the tailor. Returns null if it is not theirs. */
export async function getTailorTask(tailorId: string, taskId: string): Promise<TailorTaskDetail | null> {
  const t = await prisma.productionTask.findFirst({
    where: { id: taskId, tailorId },
    select: {
      id: true,
      code: true,
      titleEn: true,
      titleAr: true,
      status: true,
      priority: true,
      dueDate: true,
      feeBhd: true,
      notes: true,
      acceptedAt: true,
      startedAt: true,
      submittedForQcAt: true,
      order: { select: { orderNumber: true } },
      orderItem: {
        select: {
          productName: true,
          variantLabel: true,
          sku: true,
          imageUrl: true,
          measurementKind: true,
          sizeCode: true,
          sizeSnapshot: true,
          measurementSnapshot: true,
        },
      },
      qcRecords: {
        orderBy: { attempt: 'desc' },
        select: { id: true, attempt: true, status: true, rejectionReason: true, notes: true, checkedAt: true },
      },
    },
  });
  if (!t) return null;

  return {
    id: t.id,
    code: t.code,
    titleEn: t.titleEn,
    titleAr: t.titleAr,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    feeBhd: t.feeBhd != null ? Number(t.feeBhd) : null,
    productName: t.orderItem?.productName ?? t.titleEn,
    variantLabel: t.orderItem?.variantLabel ?? null,
    sku: t.orderItem?.sku ?? null,
    imageUrl: t.orderItem?.imageUrl ?? null,
    measurementKind: t.orderItem?.measurementKind ?? null,
    sizeCode: t.orderItem?.sizeCode ?? null,
    orderNumber: t.order.orderNumber,
    acceptedAt: t.acceptedAt,
    startedAt: t.startedAt,
    submittedForQcAt: t.submittedForQcAt,
    lastQc: t.qcRecords[0] ? { status: t.qcRecords[0].status, rejectionReason: t.qcRecords[0].rejectionReason } : null,
    overdue: isOverdue(t.dueDate, t.status),
    notes: t.notes,
    measurement: t.orderItem ? measurementView(t.orderItem) : null,
    qcHistory: qcView(t.qcRecords),
    actions: availableTailorActions(t.status),
  };
}

/**
 * Applies a tailor-driven production action. The task must be assigned to the
 * tailor; the transition must be legal; and starting work re-checks the payment
 * gate so an unpaid order can never enter production even if a task predates
 * the rule.
 */
export async function applyTailorTaskAction(input: {
  tailorId: string;
  taskId: string;
  action: TailorTaskAction;
  actorLabel: string;
  ip?: string | null;
}): Promise<{ status: string }> {
  const target = ACTION_TARGETS[input.action];
  if (!target) throw new TailorWorkError('Unknown action', 'UNKNOWN_ACTION');

  return prisma.$transaction(async (tx) => {
    const task = await tx.productionTask.findFirst({
      where: { id: input.taskId, tailorId: input.tailorId },
      select: { id: true, status: true, orderId: true, acceptedAt: true, startedAt: true },
    });
    if (!task) throw new TailorWorkError('Task not found', 'NOT_FOUND', 404);

    if (!canTransition(PRODUCTION_TRANSITIONS, task.status, target)) {
      throw new TailorWorkError(`Cannot ${input.action} a task in ${task.status} state`, 'INVALID_TRANSITION', 409);
    }

    if (input.action === 'start') {
      try {
        await assertOrderSettledForProduction(task.orderId, tx);
      } catch (err) {
        if (err instanceof ProductionGateError) {
          throw new TailorWorkError('Payment must be confirmed before production can begin', 'PAYMENT_REQUIRED', 409);
        }
        throw err;
      }
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: target };
    if (input.action === 'accept') data.acceptedAt = task.acceptedAt ?? now;
    if (input.action === 'start') data.startedAt = task.startedAt ?? now;
    if (input.action === 'submit_for_qc') data.submittedForQcAt = now;

    const updated = await tx.productionTask.update({ where: { id: task.id }, data: data as never });

    await tx.auditLog.create({
      data: {
        action: `tailor.production.${input.action}`,
        entity: 'ProductionTask',
        entityId: task.id,
        metadata: { tailorId: input.tailorId, actor: input.actorLabel, from: task.status, to: target } as never,
        ip: input.ip ?? null,
      },
    });

    return { status: updated.status };
  });
}

export interface TailorDashboard {
  open: number;
  inProgress: number;
  awaitingAcceptance: number;
  submitted: number;
  rework: number;
  overdue: number;
  completedTotal: number;
}

export async function tailorDashboard(tailorId: string): Promise<TailorDashboard> {
  const [open, inProgress, awaitingAcceptance, submitted, rework, completedTotal] = await Promise.all([
    prisma.productionTask.count({ where: { tailorId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED_FOR_QC', 'REWORK'] } } }),
    prisma.productionTask.count({ where: { tailorId, status: 'IN_PROGRESS' } }),
    prisma.productionTask.count({ where: { tailorId, status: 'ASSIGNED' } }),
    prisma.productionTask.count({ where: { tailorId, status: 'SUBMITTED_FOR_QC' } }),
    prisma.productionTask.count({ where: { tailorId, status: 'REWORK' } }),
    prisma.productionTask.count({ where: { tailorId, status: 'COMPLETED' } }),
  ]);
  const overdueRows = await prisma.productionTask.count({
    where: { tailorId, dueDate: { lt: new Date() }, status: { in: [...OPEN_TASK_STATUSES] } },
  });
  return { open, inProgress, awaitingAcceptance, submitted, rework, overdue: overdueRows, completedTotal };
}
