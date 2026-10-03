import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDate, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Measurements', robots: { index: false, follow: false } };

export default async function MeasurementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('measurements.view', locale);
  const dict = getAdminDict(locale);

  const measurements = await prisma.measurement.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { customer: { include: { user: true } } },
  });

  const dims = [
    ['height', dict.measurements.height],
    ['shoulder', dict.measurements.shoulder],
    ['bust', dict.measurements.bust],
    ['waist', dict.measurements.waist],
    ['hip', dict.measurements.hip],
    ['sleeve', dict.measurements.sleeve],
    ['armhole', dict.measurements.armhole],
    ['length', dict.measurements.length],
  ] as const;

  return (
    <>
      <PageHeader title={dict.measurements.title} subtitle={dict.measurements.subtitle} />
      <Panel bodyClassName="p-0">
        {measurements.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.customer}</th>
                  <th>{dict.measurements.updatedBy}</th>
                  {dims.map(([, label]) => (
                    <th key={label} className="text-end">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => {
                  const name = [m.customer.user.firstName, m.customer.user.lastName].filter(Boolean).join(' ') || m.customer.user.email;
                  return (
                    <tr key={m.id}>
                      <td data-label={dict.common.customer} className="text-ink">
                        <Link href={adminHref(locale, `customers/${m.customerId}`)} className="hover:underline">{name}</Link>
                      </td>
                      <td data-label={dict.measurements.updatedBy} className="text-caption text-ink-faint">{formatDate(m.updatedAt, locale)}</td>
                      {dims.map(([key]) => {
                        const v = m[key];
                        return (
                          <td key={key} data-label={key} className="adm-num text-end text-ink-muted">
                            {v == null ? '—' : formatNumber(Number(v), locale)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
