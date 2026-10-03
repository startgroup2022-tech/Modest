import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer } from '@/components/admin/Filters';
import { MeasurementForm } from '@/components/admin/MeasurementForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customer', robots: { index: false, follow: false } };

export default async function CustomerDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('customers.view', locale);
  const dict = getAdminDict(locale);

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: true,
      addresses: { orderBy: { isDefault: 'desc' } },
      measurements: { orderBy: { updatedAt: 'desc' } },
      orders: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!customer) notFound();

  const name = [customer.user.firstName, customer.user.lastName].filter(Boolean).join(' ') || customer.user.email;
  const totalSpent = customer.orders.reduce((s, o) => s + Number(o.totalBhd), 0);
  const canEditMeasurements = true;

  const dimLabels: Record<string, string> = {
    height: dict.measurements.height, shoulder: dict.measurements.shoulder, bust: dict.measurements.bust,
    waist: dict.measurements.waist, hip: dict.measurements.hip, sleeve: dict.measurements.sleeve,
    armhole: dict.measurements.armhole, length: dict.measurements.length,
  };

  return (
    <>
      <PageHeader
        title={name}
        subtitle={customer.user.email}
        actions={
          <Link href={adminHref(locale, 'customers')} className="adm-btn-outline">
            {dict.common.back}
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={dict.customers.orderCount} value={formatNumber(customer.orders.length, locale)} />
        <Kpi label={dict.customers.totalSpent} value={formatBhd(totalSpent, locale)} />
        <Kpi label={dict.customers.lastOrder} value={customer.orders[0] ? formatDate(customer.orders[0].createdAt, locale) : '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={dict.customers.profile}>
          <dl className="grid grid-cols-2 gap-y-3 text-small">
            <dt className="text-ink-faint">{dict.settings.email}</dt>
            <dd className="text-ink">{customer.user.email}</dd>
            <dt className="text-ink-faint">{dict.settings.phone}</dt>
            <dd className="text-ink">{customer.phone ?? '—'}</dd>
            <dt className="text-ink-faint">{dict.common.language}</dt>
            <dd className="text-ink">{customer.defaultLocale === 'ar' ? dict.common.arabic : dict.common.english}</dd>
            <dt className="text-ink-faint">{dict.customers.tags}</dt>
            <dd className="text-ink">{customer.acceptsMarketing ? (locale === 'ar' ? 'مشترك تسويقيًا' : 'Marketing opt-in') : '—'}</dd>
            <dt className="text-ink-faint">{dict.common.createdAt}</dt>
            <dd className="text-ink">{formatDate(customer.createdAt, locale)}</dd>
          </dl>
        </Panel>

        <Panel
          title={dict.measurements.title}
          action={
            canEditMeasurements ? (
              <Drawer trigger={`+ ${dict.common.create}`} title={dict.measurements.title} wide>
                <MeasurementForm customerId={customer.id} labels={dimLabels} dict={{ common: dict.common }} />
              </Drawer>
            ) : undefined
          }
        >
          {customer.measurements.length === 0 ? (
            <AdminEmpty title={dict.customers.noOrders} hint={dict.measurements.subtitle} />
          ) : (
            <div className="space-y-4">
              {customer.measurements.map((m) => (
                <div key={m.id} className="border border-line p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-small text-ink">{m.name}</span>
                    {m.isDefault && <span className="adm-badge-accent">{locale === 'ar' ? 'افتراضي' : 'Default'}</span>}
                  </div>
                  <dl className="grid grid-cols-4 gap-y-1.5 text-caption">
                    {Object.entries(dimLabels).map(([key, lbl]) => {
                      const v = (m as unknown as Record<string, unknown>)[key];
                      return (
                        <div key={key} className="contents">
                          <dt className="text-ink-faint">{lbl}</dt>
                          <dd className="adm-num text-ink">{v == null ? '—' : formatNumber(Number(v), locale)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6">
        <Panel title={dict.nav.orders} bodyClassName="p-0">
          {customer.orders.length === 0 ? (
            <AdminEmpty title={dict.customers.noOrders} />
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table adm-table-responsive">
                <thead>
                  <tr>
                    <th>{dict.common.order}</th>
                    <th className="text-end">{dict.common.total}</th>
                    <th>{dict.common.status}</th>
                    <th>{dict.common.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((o) => (
                    <tr key={o.id}>
                      <td data-label={dict.common.order} className="adm-num text-ink">
                        <Link href={adminHref(locale, `orders/${o.id}`)} className="hover:underline">{o.orderNumber}</Link>
                      </td>
                      <td data-label={dict.common.total} className="adm-num text-end">{formatBhd(o.totalBhd, locale)}</td>
                      <td data-label={dict.common.status}><StatusBadge status={o.status} /></td>
                      <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDate(o.createdAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={dict.customers.addresses} bodyClassName="p-0">
          {customer.addresses.length === 0 ? (
            <AdminEmpty title={dict.common.empty} />
          ) : (
            <ul className="divide-y divide-line">
              {customer.addresses.map((a) => (
                <li key={a.id} className="px-5 py-3.5 text-small">
                  <div className="flex items-center gap-2">
                    <span className="text-ink">{a.fullName}</span>
                    {a.isDefault && <span className="adm-badge-accent">{locale === 'ar' ? 'افتراضي' : 'Default'}</span>}
                  </div>
                  <p className="mt-0.5 text-caption text-ink-muted">
                    {[a.address, a.building, a.unit, a.area, a.city, a.country].filter(Boolean).join(', ')}
                  </p>
                  <p className="adm-num text-caption text-ink-faint">{a.phone}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
