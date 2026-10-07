import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatNumber, label } from '@/lib/admin-format';
import { resolveRange } from '@/lib/admin/queries';
import { PageHeader, Panel, Kpi, AdminEmpty } from '@/components/admin/ui';
import { RangeFilter } from '@/components/admin/Filters';
import { BarSeries, StatusBars } from '@/components/admin/charts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reports', robots: { index: false, follow: false } };

const REVENUE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY', 'SHIPPED', 'DELIVERED'];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('reports.view', locale);
  // Net revenue is derived from costs and refunds; it is gated behind a
  // dedicated profit permission rather than the general report permission.
  const canSeeProfits = admin.permissions.has('reports.profits');
  const dict = getAdminDict(locale);
  const sp = await searchParams;
  const range = resolveRange({ range: sp.range, from: sp.from, to: sp.to });

  const [orders, orderItems, expenseAgg, refundAgg, topProducts, customerAgg] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { status: true, totalBhd: true, discountBhd: true, channel: true, createdAt: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { in: REVENUE_STATUSES } } },
      select: { productName: true, quantity: true, lineTotalBhd: true },
    }),
    prisma.expense.aggregate({
      where: { status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: range.from, lte: range.to } },
      _sum: { amountBhd: true },
    }),
    prisma.refund.aggregate({ where: { createdAt: { gte: range.from, lte: range.to }, status: 'COMPLETED' }, _sum: { amountBhd: true } }),
    prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { in: REVENUE_STATUSES } } },
      _sum: { quantity: true, lineTotalBhd: true },
      orderBy: { _sum: { lineTotalBhd: 'desc' } },
      take: 8,
    }),
    prisma.customer.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
  ]);

  const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const grossBhd = revenueOrders.reduce((s, o) => s + Number(o.totalBhd), 0);
  const discountBhd = orders.reduce((s, o) => s + Number(o.discountBhd), 0);
  const refundsBhd = Number(refundAgg._sum.amountBhd ?? 0);
  const expensesBhd = Number(expenseAgg._sum.amountBhd ?? 0);
  const netBhd = grossBhd - refundsBhd - expensesBhd;
  const units = orderItems.reduce((s, i) => s + i.quantity, 0);

  const statusCounts = new Map<string, number>();
  for (const o of orders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);

  const channelCounts = new Map<string, number>();
  for (const o of orders) channelCounts.set(o.channel, (channelCounts.get(o.channel) ?? 0) + 1);

  return (
    <>
      <PageHeader title={dict.reports.title} subtitle={dict.reports.subtitle} actions={<RangeFilter />} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={dict.dashboard.revenue} value={formatBhd(grossBhd, locale)} hint={`${formatNumber(revenueOrders.length, locale)} ${dict.nav.orders}`} />
        {canSeeProfits && <Kpi label={dict.finance.netRevenue} value={formatBhd(netBhd, locale)} tone={netBhd >= 0 ? 'success' : 'danger'} />}
        <Kpi label={dict.dashboard.unitsSold} value={formatNumber(units, locale)} />
        <Kpi label={dict.dashboard.customers} value={formatNumber(customerAgg, locale)} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={dict.dashboard.discounts} value={formatBhd(discountBhd, locale)} tone="warn" />
        <Kpi label={dict.finance.refunds} value={formatBhd(refundsBhd, locale)} tone="danger" />
        {canSeeProfits && <Kpi label={dict.dashboard.expenses} value={formatBhd(expensesBhd, locale)} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={dict.reports.sales}>
          {topProducts.length === 0 ? (
            <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
          ) : (
            <BarSeries
              data={topProducts.map((p) => ({ label: p.productName, value: Number(p._sum.lineTotalBhd ?? 0) }))}
              locale={locale}
              ariaLabel={dict.reports.topProducts}
            />
          )}
        </Panel>
        <Panel title={dict.reports.orders}>
          {statusCounts.size === 0 ? (
            <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
          ) : (
            <StatusBars
              data={[...statusCounts.entries()].map(([status, count]) => ({ status, label: label(status, locale), count }))}
              total={orders.length}
            />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={dict.common.channel}>
          {channelCounts.size === 0 ? (
            <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
          ) : (
            <BarSeries
              data={[...channelCounts.entries()].map(([channel, count]) => ({ label: label(channel, locale), value: count }))}
              locale={locale}
              ariaLabel={dict.reports.byChannel}
            />
          )}
        </Panel>
        <Panel title={dict.reports.products}>
          {topProducts.length === 0 ? (
            <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
          ) : (
            <ul className="divide-y divide-line">
              {topProducts.map((p) => (
                <li key={p.productName} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-small text-ink">{p.productName}</span>
                  <span className="adm-num shrink-0 text-caption text-ink-muted">
                    {formatNumber(p._sum.quantity ?? 0, locale)} × · {formatBhd(p._sum.lineTotalBhd ?? 0, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
