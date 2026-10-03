import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDateTime } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Refunds', robots: { index: false, follow: false } };

export default async function RefundsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('orders.refund', locale);
  const dict = getAdminDict(locale);

  const refunds = await prisma.refund.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { order: { select: { orderNumber: true, id: true } }, createdBy: { select: { firstName: true, lastName: true, email: true } } },
  });

  return (
    <>
      <PageHeader title={dict.finance.refunds} subtitle={dict.finance.subtitle} />
      <Panel bodyClassName="p-0">
        {refunds.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.order}</th>
                  <th className="text-end">{dict.common.amount}</th>
                  <th>{dict.common.method}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.finance.reason}</th>
                  <th>{dict.common.by}</th>
                  <th>{dict.common.date}</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td data-label={dict.common.order} className="adm-num text-ink">
                      <Link href={adminHref(locale, `orders/${r.order.id}`)} className="hover:underline">{r.order.orderNumber}</Link>
                    </td>
                    <td data-label={dict.common.amount} className="adm-num text-end">{formatBhd(r.amountBhd, locale)}</td>
                    <td data-label={dict.common.method} className="text-ink-muted">{r.method.replace(/_/g, ' ')}</td>
                    <td data-label={dict.common.status}><StatusBadge status={r.status} /></td>
                    <td data-label={dict.finance.reason} className="text-ink-muted">{r.reason ?? '\u2014'}</td>
                    <td data-label={dict.common.by} className="text-caption text-ink-faint">
                      {r.createdBy ? [r.createdBy.firstName, r.createdBy.lastName].filter(Boolean).join(' ') || r.createdBy.email : '\u2014'}
                    </td>
                    <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDateTime(r.createdAt, locale)}</td>
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
