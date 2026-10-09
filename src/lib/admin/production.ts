import 'server-only';
import { prisma } from '../prisma';
import type { Prisma, TaskStatus, TaskPriority } from '@prisma/client';

/**
 * Admin production-queue queries: the filtered list plus the KPI counts that
 * drive the page. Kept out of the page module so both are testable and the page
 * stays a thin renderer.
 */

export interface ProductionQuery {
  q?: string;
  status?: string;
  priority?: string;
  tailorId?: string;
  /** 'unassigned' | 'assigned' | 'overdue' | 'paid_unassigned' | 'all' */
  scope?: string;
}

const OPEN_STATUSES: TaskStatus[] = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED_FOR_QC', 'REWORK'];

export async function listProductionTasks(query: ProductionQuery) {
  const where: Prisma.ProductionTaskWhereInput = {};

  if (query.status && query.status !== 'all') where.status = query.status as TaskStatus;
  if (query.priority && query.priority !== 'all') where.priority = query.priority as TaskPriority;
  if (query.tailorId === 'unassigned') where.tailorId = null;
  else if (query.tailorId) where.tailorId = query.tailorId;

  if (query.scope === 'unassigned') where.tailorId = null;
  else if (query.scope === 'assigned') where.tailorId = { not: null };
  else if (query.scope === 'overdue') {
    where.dueDate = { lt: new Date() };
    where.status = { in: OPEN_STATUSES };
  }

  if (query.q) {
    const q = query.q.trim();
    where.OR = [
      { code: { contains: q } },
      { titleEn: { contains: q } },
      { titleAr: { contains: q } },
      { order: { orderNumber: { contains: q } } },
    ];
  }

  return prisma.productionTask.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: 200,
    include: {
      order: {
        select: {
          orderNumber: true,
          payments: { select: { status: true } },
        },
      },
      tailor: { select: { id: true, nameEn: true, nameAr: true } },
      qcRecords: { orderBy: { attempt: 'desc' }, take: 1, select: { status: true, attempt: true } },
    },
  });
}

export interface ProductionCounts {
  paidUnassigned: number;
  unassigned: number;
  inProgress: number;
  awaitingQc: number;
  rework: number;
  overdue: number;
  completed: number;
}

export async function productionCounts(): Promise<ProductionCounts> {
  const now = new Date();
  const [byStatus, overdue, paidUnassigned] = await Promise.all([
    prisma.productionTask.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.productionTask.count({ where: { dueDate: { lt: now }, status: { in: OPEN_STATUSES } } }),
    // Paid orders with a piece that has no tailor yet — the "assign now" queue.
    prisma.productionTask.count({
      where: {
        tailorId: null,
        status: { in: ['PENDING'] },
        order: { payments: { some: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } } },
      },
    }),
  ]);

  const count = (statuses: TaskStatus[]) =>
    byStatus.filter((b) => statuses.includes(b.status)).reduce((s, b) => s + b._count._all, 0);

  return {
    paidUnassigned,
    unassigned: count(['PENDING']),
    inProgress: count(['ACCEPTED', 'IN_PROGRESS']),
    awaitingQc: count(['SUBMITTED_FOR_QC']),
    rework: count(['REWORK']),
    overdue,
    completed: count(['COMPLETED']),
  };
}

/** Active tailors with their current open-piece load, for workload display. */
export async function tailorWorkload() {
  const tailors = await prisma.tailor.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { nameEn: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      capacity: true,
      _count: { select: { tasks: true } },
    },
  });

  const loads = await prisma.productionTask.groupBy({
    by: ['tailorId'],
    where: { tailorId: { not: null }, status: { in: OPEN_STATUSES } },
    _count: { _all: true },
  });
  const loadByTailor = new Map(loads.map((l) => [l.tailorId as string, l._count._all]));

  return tailors.map((t) => ({
    id: t.id,
    nameEn: t.nameEn,
    nameAr: t.nameAr,
    capacity: t.capacity,
    openPieces: loadByTailor.get(t.id) ?? 0,
  }));
}