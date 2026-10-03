import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payments', robots: { index: false, follow: false } };

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('payments.view', locale);
  const dict = getAdminDict(locale);

  const [payments, pendingAgg, paidAgg] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { order: { select: { orderNumber: true, shippingName: true, email: true } } },
    }),
    prisma.payment.aggregate({ where: { status: { in: ['PENDING', 'INITIATED'] } }, _sum: { amountBhd: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amountBhd: true } }),
  ]);

  return (
    <>
      <PageHeader title={dict.finance.payments} subtitle={dict.finance.subtitle} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Kpi label={dict.finance.outstanding} value={formatBhd(pendingAgg._sum.amountBhd ?? 0, locale)} hint={`${pendingAgg._count} ${dict.common.results}`} tone="warn" />
        <Kpi label={dict.finance.netRevenue} value={formatBhd(paidAgg._sum.amountBhd ?? 0, locale)} tone="success" />
      </div>

      <Panel bodyClassName="p-0">
        {payments.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.order}</th>
                  <th>{dict.common.customer}</th>
                  <th>{dict.common.method}</th>
                  <th className="text-end">{dict.common.amount}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.date}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td data-label={dict.common.order} className="adm-num text-ink">{pay.order.orderNumber}</td>
                    <td data-label={dict.common.customer} className="text-ink-muted">
                      <span className="block">{pay.order.shippingName}</span>
                      <span className="block text-caption text-ink-faint">{pay.order.email}</span>
                    </td>
                    <td data-label={dict.common.method} className="text-ink-muted">{pay.method.replace(/_/g, ' ')}</td>
                    <td data-label={dict.common.amount} className="adm-num text-end">{formatBhd(pay.amountBhd, locale)}</td>
                    <td data-label={dict.common.status}>
                      <StatusBadge status={pay.status} label={dict.common.status === 'Status' ? pay.status : pay.status} />
                    </td>
                    <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDate(pay.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
