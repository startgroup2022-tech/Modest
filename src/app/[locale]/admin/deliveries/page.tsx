import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Deliveries', robots: { index: false, follow: false } };

export default async function DeliveriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('shipping.view', locale);
  const dict = getAdminDict(locale);

  const orders = await prisma.order.findMany({
    where: { status: { in: ['READY', 'SHIPPED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, orderNumber: true, shippingName: true, shippingCity: true, status: true, carrier: true, trackingNumber: true, shippedAt: true },
  });

  return (
    <>
      <PageHeader title={dict.nav.deliveries} subtitle={dict.orders.shipping} />
      <Panel bodyClassName="p-0">
        {orders.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.order}</th>
                  <th>{dict.common.customer}</th>
                  <th>{dict.orders.carrier}</th>
                  <th>{dict.orders.trackingNumber}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.orders.markShipped}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td data-label={dict.common.order} className="adm-num text-ink">{o.orderNumber}</td>
                    <td data-label={dict.common.customer} className="text-ink-muted">
                      <span className="block">{o.shippingName}</span>
                      <span className="block text-caption text-ink-faint">{o.shippingCity}</span>
                    </td>
                    <td data-label={dict.orders.carrier} className="text-ink-muted">{o.carrier ?? '\u2014'}</td>
                    <td data-label={dict.orders.trackingNumber} className="adm-num text-ink-muted">{o.trackingNumber ?? '\u2014'}</td>
                    <td data-label={dict.common.status}><StatusBadge status={o.status} /></td>
                    <td data-label={dict.orders.markShipped} className="text-caption text-ink-faint">{o.shippedAt ? formatDate(o.shippedAt, locale) : '\u2014'}</td>
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
