import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tailors', robots: { index: false, follow: false } };

export default async function TailorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('tailors.view', locale);
  const dict = getAdminDict(locale);
  const nameLabel = locale === 'ar' ? 'الاسم' : 'Name';

  const tailors = await prisma.tailor.findMany({
    orderBy: { nameEn: 'asc' },
    include: { _count: { select: { tasks: true } } },
  });

  const fields = (): FieldDef[] => [
    { key: 'code', label: 'Code' },
    { key: 'nameEn', label: `${nameLabel} (EN)` },
    { key: 'nameAr', label: `${nameLabel} (AR)` },
    { key: 'phone', label: dict.common.method },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'specialization', label: dict.production.specialization },
    { key: 'capacity', label: dict.production.capacity, type: 'number' },
    { key: 'settlementType', label: locale === 'ar' ? 'نوع التسوية' : 'Settlement type', type: 'select', options: [
      { value: 'per_task', label: locale === 'ar' ? 'لكل مهمة' : 'Per task' },
      { value: 'monthly', label: locale === 'ar' ? 'شهري' : 'Monthly' },
      { value: 'hourly', label: locale === 'ar' ? 'بالساعة' : 'Hourly' },
    ] },
    { key: 'rateBhd', label: `${locale === 'ar' ? 'الأجر' : 'Rate'} (BHD)`, type: 'number', step: '0.001' },
    { key: 'status', label: dict.common.status, type: 'select', options: [
      { value: 'ACTIVE', label: locale === 'ar' ? 'نشط' : 'Active' },
      { value: 'INACTIVE', label: locale === 'ar' ? 'غير نشط' : 'Inactive' },
      { value: 'ON_LEAVE', label: locale === 'ar' ? 'في إجازة' : 'On leave' },
    ] },
    { key: 'notes', label: dict.common.notes, type: 'textarea', full: true },
  ];
  const blank = { code: '', nameEn: '', nameAr: '', phone: '', email: '', specialization: '', capacity: 4, settlementType: 'per_task', rateBhd: 0, status: 'ACTIVE', notes: '' };

  return (
    <>
      <PageHeader
        title={dict.nav.tailors}
        subtitle={dict.production.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.nav.tailors} wide>
            <ResourceForm endpoint="/api/admin/tailors" initial={blank} fields={fields()} dict={{ common: dict.common }} transformKey="tailors" />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {tailors.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.production.tailor}</th>
                  <th>{dict.production.specialization}</th>
                  <th className="text-end">{dict.production.capacity}</th>
                  <th className="text-end">{dict.production.activeTasks}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {tailors.map((t) => {
                  const initial = { id: t.id, code: t.code ?? '', nameEn: t.nameEn, nameAr: t.nameAr, phone: t.phone ?? '', email: t.email ?? '', specialization: t.specialization ?? '', capacity: t.capacity, settlementType: t.settlementType, rateBhd: String(t.rateBhd), status: t.status, notes: t.notes ?? '' };
                  return (
                    <tr key={t.id}>
                      <td data-label={dict.production.tailor} className="text-ink">
                        <span className="block">{locale === 'ar' ? t.nameAr : t.nameEn}</span>
                        <span className="block text-caption text-ink-faint">{t.phone ?? t.code ?? '\u2014'}</span>
                      </td>
                      <td data-label={dict.production.specialization} className="text-ink-muted">{t.specialization ?? '\u2014'}</td>
                      <td data-label={dict.production.capacity} className="adm-num text-end">{t.capacity}</td>
                      <td data-label={dict.production.activeTasks} className="adm-num text-end">{t._count.tasks}</td>
                      <td data-label={dict.common.status}><StatusBadge status={t.status} /></td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <ResourceForm endpoint="/api/admin/tailors" initial={initial} fields={fields()} dict={{ common: dict.common }} transformKey="tailors" />
                          </Drawer>
                        </span>
                      </td>
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
