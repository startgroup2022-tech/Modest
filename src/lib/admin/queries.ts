import 'server-only';
import { prisma } from '../prisma';
import type { OrderStatus, Prisma } from '@prisma/client';
import type { Permission } from '../permission-defs';

/* ── Date ranges ─────────────────────────────────────────── */

export interface Range {
  from: Date;
  to: Date;
  key: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom' | 'all';
}

export function resolveRange(params: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
}): Range {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const key = (params.range ?? 'last30') as Range['key'];

  switch (key) {
    case 'today':
      return { from: startOfToday, to: endOfToday, key };
    case 'yesterday':
      return { from: new Date(startOfToday.getTime() - 86400000), to: startOfToday, key };
    case 'last7':
      return { from: new Date(startOfToday.getTime() - 6 * 86400000), to: endOfToday, key };
    case 'last30':
      return { from: new Date(startOfToday.getTime() - 29 * 86400000), to: endOfToday, key };
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday, key };
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to, key };
    }
    case 'custom': {
      const from = params.from ? new Date(params.from) : new Date(startOfToday.getTime() - 29 * 86400000);
      const to = params.to ? new Date(new Date(params.to).getTime() + 86400000) : endOfToday;
      return { from, to, key };
    }
    case 'all':
    default:
      return { from: new Date(2000, 0, 1), to: endOfToday, key: 'all' };
  }
}

const PAID_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY', 'SHIPPED', 'DELIVERED'];
const EXCLUDED_FROM_REVENUE: OrderStatus[] = ['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED'];

/* ── Dashboard ───────────────────────────────────────────── */

export interface DashboardData {
  todaySalesBhd: number;
  monthSalesBhd: number;
  netSalesBhd: number;
  ordersCount: number;
  avgOrderBhd: number;
  unitsSold: number;
  discountsBhd: number;
  pendingPayments: number;
  inProduction: number;
  qcPending: number;
  lowStock: number;
  customersCount: number;
  refundsBhd: number;
  expensesBhd: number;
  salesSeries: { label: string; value: number }[];
  statusBreakdown: { status: string; count: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customer: string;
    totalBhd: number;
    status: OrderStatus;
    channel: string;
    createdAt: Date;
  }[];
  actionCenter: {
    key: string;
    count: number;
    severity: 'info' | 'warn' | 'danger';
    href: string;
  }[];
}

export async function getDashboardData(
  locale: 'en' | 'ar',
  permissions: Set<Permission>,
): Promise<DashboardData> {
  const can = (p: Permission) => permissions.has(p);
  // Each block is computed only when the viewer holds the permission that
  // governs the underlying records. A support employee with `orders.view` but
  // no `customers.view` must not learn customer counts, sales totals, refund
  // or expense figures through the dashboard — the sidebar hides the sections,
  // but the data behind them has to be withheld here too.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(startOfToday.getTime() - 29 * 86400000);

  const [
    todayAgg,
    monthAgg,
    netAgg,
    ordersCount,
    unitsAgg,
    discountsAgg,
    pendingPayments,
    inProduction,
    qcPending,
    lowStockRows,
    customersCount,
    refundsAgg,
    expensesAgg,
    recentOrders,
    statusGroups,
    trendOrders,
  ] = await Promise.all([
    can('reports.view')
      ? prisma.order.aggregate({
          where: { createdAt: { gte: startOfToday }, status: { notIn: EXCLUDED_FROM_REVENUE } },
          _sum: { totalBhd: true },
        })
      : null,
    can('reports.view')
      ? prisma.order.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: { notIn: EXCLUDED_FROM_REVENUE } },
          _sum: { totalBhd: true },
        })
      : null,
    can('reports.profits')
      ? prisma.order.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: { in: PAID_STATUSES } },
          _sum: { totalBhd: true, discountBhd: true },
        })
      : null,
    can('orders.view')
      ? prisma.order.count({ where: { createdAt: { gte: startOfMonth }, status: { notIn: EXCLUDED_FROM_REVENUE } } })
      : 0,
    can('orders.view')
      ? prisma.orderItem.aggregate({
          where: { order: { createdAt: { gte: startOfMonth }, status: { notIn: EXCLUDED_FROM_REVENUE } } },
          _sum: { quantity: true },
        })
      : null,
    can('reports.view')
      ? prisma.order.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: { notIn: EXCLUDED_FROM_REVENUE } },
          _sum: { discountBhd: true },
        })
      : null,
    can('payments.view') ? prisma.payment.count({ where: { status: { in: ['PENDING', 'INITIATED'] } } }) : 0,
    can('production.view')
      ? prisma.productionTask.count({ where: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } } })
      : 0,
    can('qc.view') ? prisma.qcRecord.count({ where: { status: 'PENDING' } }) : 0,
    can('inventory.view')
      ? prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count FROM ProductVariant v
          JOIN Product p ON p.id = v.productId
          WHERE v.isActive = 1 AND v.stock > 0 AND v.stock <= p.lowStockThreshold
        `
      : [],
    can('customers.view') ? prisma.customer.count() : 0,
    can('orders.refund') ? prisma.refund.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { amountBhd: true } }) : null,
    can('finance.view')
      ? prisma.expense.aggregate({
          where: { expenseDate: { gte: startOfMonth }, status: { in: ['APPROVED', 'PAID'] } },
          _sum: { amountBhd: true },
        })
      : null,
    can('orders.view')
      ? prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            orderNumber: true,
            shippingName: true,
            totalBhd: true,
            status: true,
            channel: true,
            createdAt: true,
          },
        })
      : [],
    can('orders.view')
      ? prisma.order.groupBy({
          by: ['status'],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: { _all: true },
        })
      : [],
    can('reports.view')
      ? prisma.order.findMany({
          where: { createdAt: { gte: thirtyDaysAgo }, status: { notIn: EXCLUDED_FROM_REVENUE } },
          select: { createdAt: true, totalBhd: true },
        })
      : [],
  ]);

  const monthSales = Number(monthAgg?._sum.totalBhd ?? 0);
  const unitsSold = unitsAgg?._sum.quantity ?? 0;
  const avgOrder = ordersCount ? monthSales / ordersCount : 0;

  // Daily sales series over the last 30 days.
  const buckets = new Map<string, number>();
  if (can('reports.view')) {
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo.getTime() + i * 86400000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of trendOrders) {
      const k = o.createdAt.toISOString().slice(0, 10);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + Number(o.totalBhd));
    }
  }
  const salesSeries = [...buckets.entries()].map(([label, value]) => ({ label, value }));

  const refundsBhd = Number(refundsAgg?._sum.amountBhd ?? 0);
  const expensesBhd = Number(expensesAgg?._sum.amountBhd ?? 0);

  const lowStock = Number(lowStockRows[0]?.count ?? 0);

  const [refundRequested, pendingExpenses, pendingOrders] = await Promise.all([
    can('orders.refund') ? prisma.order.count({ where: { status: 'REFUND_REQUESTED' } }) : 0,
    can('expenses.approve') ? prisma.expense.count({ where: { status: 'SUBMITTED' } }) : 0,
    can('orders.view') ? prisma.order.count({ where: { status: 'PENDING' } }) : 0,
  ]);

  const actionCenter = [
    { key: 'pendingOrders', count: pendingOrders, severity: 'info' as const, href: 'orders?status=PENDING' },
    { key: 'pendingPayments', count: pendingPayments, severity: 'warn' as const, href: 'payments?status=PENDING' },
    { key: 'qcPending', count: qcPending, severity: 'info' as const, href: 'production/qc' },
    { key: 'lowStock', count: lowStock, severity: 'danger' as const, href: 'inventory?filter=low' },
    { key: 'pendingExpenses', count: pendingExpenses, severity: 'warn' as const, href: 'expenses' },
    { key: 'refundRequested', count: refundRequested, severity: 'danger' as const, href: 'orders?status=REFUND_REQUESTED' },
  ].filter((a) => a.count > 0);

  return {
    todaySalesBhd: Number(todayAgg?._sum.totalBhd ?? 0),
    monthSalesBhd: monthSales,
    netSalesBhd: Number(netAgg?._sum.totalBhd ?? 0),
    ordersCount,
    avgOrderBhd: avgOrder,
    unitsSold,
    discountsBhd: Number(discountsAgg?._sum.discountBhd ?? 0),
    pendingPayments,
    inProduction,
    qcPending,
    lowStock,
    customersCount,
    refundsBhd,
    expensesBhd,
    salesSeries,
    statusBreakdown: statusGroups.map((s) => ({ status: s.status, count: s._count._all })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.shippingName,
      totalBhd: Number(o.totalBhd),
      status: o.status,
      channel: o.channel,
      createdAt: o.createdAt,
    })),
    actionCenter,
  };
}

/* ── Generic pagination helper ───────────────────────────── */

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export function paginate<T>(rows: T[], total: number, page: number, perPage: number): Paged<T> {
  return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export function parsePage(value: string | null | undefined, perPage = 20): { page: number; perPage: number; skip: number } {
  const page = Math.max(1, Number(value ?? '1') || 1);
  return { page, perPage, skip: (page - 1) * perPage };
}

/* ── Orders ──────────────────────────────────────────────── */

export interface OrderListQuery {
  q?: string;
  status?: string;
  channel?: string;
  paymentStatus?: string;
  range?: Range;
  sort?: 'newest' | 'oldest' | 'total_desc' | 'total_asc';
  page?: number;
  perPage?: number;
}

export type OrderListRow = Prisma.OrderGetPayload<{
  include: { items: true; payments: { orderBy: { createdAt: 'desc' }; take: 1 } };
}>;

export async function listOrders(query: OrderListQuery): Promise<Paged<OrderListRow>> {
  const perPage = query.perPage ?? 20;
  const page = Math.max(1, query.page ?? 1);

  const where: Prisma.OrderWhereInput = {};
  if (query.q) {
    where.OR = [
      { orderNumber: { contains: query.q } },
      { email: { contains: query.q } },
      { shippingName: { contains: query.q } },
      { phone: { contains: query.q } },
    ];
  }
  if (query.status && query.status !== 'ALL') where.status = query.status as OrderStatus;
  if (query.channel && query.channel !== 'ALL') where.channel = query.channel as never;
  if (query.paymentStatus && query.paymentStatus !== 'ALL') {
    where.payments = { some: { status: query.paymentStatus as never } };
  }
  if (query.range) where.createdAt = { gte: query.range.from, lt: query.range.to };

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    query.sort === 'oldest'
      ? { createdAt: 'asc' }
      : query.sort === 'total_desc'
        ? { totalBhd: 'desc' }
        : query.sort === 'total_asc'
          ? { totalBhd: 'asc' }
          : { createdAt: 'desc' };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.order.count({ where }),
  ]);

  return paginate(rows, total, page, perPage);
}

export async function getOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'desc' } },
      refunds: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' } },
      customer: { include: { user: true, measurements: true } },
      productionTasks: { include: { tailor: true, qcRecords: true }, orderBy: { createdAt: 'asc' } },
      createdBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
