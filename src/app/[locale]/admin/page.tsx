import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { getDashboardData } from '@/lib/admin/queries';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatNumber, label, formatRelative } from '@/lib/admin-format';
import { PageHeader, Kpi, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { BarSeries, StatusBars } from '@/components/admin/charts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ denied?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage(undefined, locale);
  const { denied } = await searchParams;
  const dict = getAdminDict(locale);
  const data = await getDashboardData(locale, admin.permissions);
  const can = (p: Parameters<typeof admin.permissions.has>[0]) => admin.permissions.has(p);
  const href = (p: string) => adminHref(locale, p);

  const statusTotal = data.statusBreakdown.reduce((s, x) => s + x.count, 0);

  const actionLabels: Record<string, string> = {
    pendingOrders: locale === 'ar' ? 'طلبات جديدة' : 'New orders',
    pendingPayments: locale === 'ar' ? 'مدفوعات معلّقة' : 'Payments awaiting confirmation',
    qcPending: locale === 'ar' ? 'فحوصات جودة معلّقة' : 'QC inspections pending',
    lowStock: locale === 'ar' ? 'متغيرات منخفضة المخزون' : 'Variants low on stock',
    pendingExpenses: locale === 'ar' ? 'مصروفات بانتظار الاعتماد' : 'Expenses awaiting approval',
    refundRequested: locale === 'ar' ? 'طلبات استرداد' : 'Refund requests',
  };

  return (
    <>
      <PageHeader
        title={dict.dashboard.title}
        subtitle={dict.dashboard.subtitle}
        actions={
          <>
            <span className="text-caption text-ink-faint">
              {locale === 'ar' ? 'مرحباً،' : 'Welcome,'} {admin.firstName ?? admin.email}
            </span>
          </>
        }
      />

      {denied && (
        <div className="mb-5 border border-[#DBC9A8] bg-[#FAF4E8] px-4 py-3 text-small text-[#8A6B2B]">
          {dict.app.denied}
        </div>
      )}

      {/* KPIs — each card is only rendered when the viewer holds the
          permission that governs the underlying data. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {can('reports.view') && (
          <>
            <Kpi label={dict.dashboard.todaysSales} value={formatBhd(data.todaySalesBhd, locale)} href={href('reports/sales')} />
            <Kpi label={dict.dashboard.monthSales} value={formatBhd(data.monthSalesBhd, locale)} href={href('reports/sales')} />
          </>
        )}
        {can('orders.view') && (
          <Kpi label={dict.dashboard.orders} value={formatNumber(data.ordersCount, locale)} hint={formatBhd(data.avgOrderBhd, locale) + ' ' + (locale === 'ar' ? 'متوسط' : 'avg')} href={href('orders')} />
        )}
        {can('payments.view') && (
          <Kpi
            label={dict.dashboard.pendingPayments}
            value={formatNumber(data.pendingPayments, locale)}
            tone={data.pendingPayments > 0 ? 'warn' : 'default'}
            href={href('payments?status=PENDING')}
          />
        )}
        {can('production.view') && (
          <Kpi label={dict.dashboard.inProduction} value={formatNumber(data.inProduction, locale)} href={href('production')} />
        )}
        {can('qc.view') && (
          <Kpi
            label={dict.dashboard.qcPending}
            value={formatNumber(data.qcPending, locale)}
            tone={data.qcPending > 0 ? 'warn' : 'default'}
            href={href('production/qc')}
          />
        )}
        {can('inventory.view') && (
          <Kpi
            label={dict.dashboard.lowStock}
            value={formatNumber(data.lowStock, locale)}
            tone={data.lowStock > 0 ? 'danger' : 'default'}
            href={href('inventory?filter=low')}
          />
        )}
        {can('customers.view') && (
          <Kpi label={dict.dashboard.customers} value={formatNumber(data.customersCount, locale)} href={href('customers')} />
        )}
      </div>

      {/* Secondary financials */}
      {(can('reports.profits') || can('orders.view') || can('finance.view')) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {can('reports.profits') && <Kpi label={dict.dashboard.netSales} value={formatBhd(data.netSalesBhd, locale)} />}
          {can('orders.view') && <Kpi label={dict.dashboard.unitsSold} value={formatNumber(data.unitsSold, locale)} />}
          {can('reports.view') && <Kpi label={dict.dashboard.discounts} value={formatBhd(data.discountsBhd, locale)} />}
          {can('finance.view') && <Kpi label={dict.dashboard.expenses} value={formatBhd(data.expensesBhd, locale)} href={href('expenses')} />}
        </div>
      )}

      {(can('reports.view') || can('orders.view')) && (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Sales intelligence */}
        {can('reports.view') && (
          <Panel title={dict.dashboard.salesIntelligence} className="lg:col-span-2">
            <BarSeries
              data={data.salesSeries.map((p) => ({
                label: new Date(p.label).toLocaleDateString(locale === 'ar' ? 'ar-BH' : 'en-GB', {
                  day: '2-digit',
                  month: 'short',
                  numberingSystem: 'latn',
                }),
                value: p.value,
              }))}
              locale={locale}
              ariaLabel={dict.dashboard.salesIntelligence}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              <div>
                <p className="adm-kpi-label">{dict.dashboard.revenue}</p>
                <p className="adm-num mt-1 text-small text-ink">{formatBhd(data.monthSalesBhd, locale)}</p>
              </div>
              <div>
                <p className="adm-kpi-label">{dict.dashboard.avgOrderValue}</p>
                <p className="adm-num mt-1 text-small text-ink">{formatBhd(data.avgOrderBhd, locale)}</p>
              </div>
              {can('orders.refund') && (
                <div>
                  <p className="adm-kpi-label">{dict.dashboard.refunds}</p>
                  <p className="adm-num mt-1 text-small text-ink">{formatBhd(data.refundsBhd, locale)}</p>
                </div>
              )}
              <div>
                <p className="adm-kpi-label">{dict.dashboard.unitsSold}</p>
                <p className="adm-num mt-1 text-small text-ink">{formatNumber(data.unitsSold, locale)}</p>
              </div>
            </div>
          </Panel>
        )}

        {/* Action center */}
        <Panel title={dict.dashboard.actionCenter} className={can('reports.view') ? '' : 'lg:col-span-3'}>
          {data.actionCenter.length === 0 ? (
            <p className="py-6 text-center text-small text-ink-muted">{dict.dashboard.noAlerts}</p>
          ) : (
            <ul className="adm-divide -mx-5 -mb-5">
              {data.actionCenter.map((a) => (
                <li key={a.key}>
                  <Link href={href(a.href)} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-sand-50">
                    <span className="flex items-center gap-2.5 text-small text-ink">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 ${
                          a.severity === 'danger' ? 'bg-danger' : a.severity === 'warn' ? 'bg-[#B8860B]' : 'bg-ink-faint'
                        }`}
                        aria-hidden
                      />
                      {actionLabels[a.key] ?? a.key}
                    </span>
                    <span className="adm-num text-small font-medium text-ink">{a.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      )}

      {can('orders.view') && (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title={dict.dashboard.recentOrders} className="lg:col-span-2" bodyClassName="p-0">
          {data.recentOrders.length === 0 ? (
            <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table adm-table-responsive">
                <thead>
                  <tr>
                    <th>{dict.orders.orderNumber}</th>
                    <th>{dict.common.customer}</th>
                    <th>{dict.common.channel}</th>
                    <th className="text-end">{dict.common.total}</th>
                    <th>{dict.common.status}</th>
                    <th>{dict.common.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td data-label={dict.orders.orderNumber}>
                        <Link href={href(`orders/${o.id}`)} className="link-underline font-medium text-ink">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td data-label={dict.common.customer} className="text-ink-muted">{o.customer}</td>
                      <td data-label={dict.common.channel} className="text-ink-muted">{label(o.channel, locale)}</td>
                      <td data-label={dict.common.total} className="adm-num text-end">{formatBhd(o.totalBhd, locale)}</td>
                      <td data-label={dict.common.status}><StatusBadge status={o.status} label={label(o.status, locale)} /></td>
                      <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatRelative(o.createdAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={dict.orders.title}>
          {statusTotal === 0 ? (
            <p className="py-6 text-center text-small text-ink-muted">{dict.common.empty}</p>
          ) : (
            <StatusBars
              data={[...data.statusBreakdown]
                .sort((a, b) => b.count - a.count)
                .map((s) => ({ status: s.status, label: label(s.status, locale), count: s.count }))}
              total={statusTotal}
            />
          )}
        </Panel>
      </div>
      )}
    </>
  );
}
