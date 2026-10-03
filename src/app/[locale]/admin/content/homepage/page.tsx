import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

import { Drawer } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Homepage', robots: { index: false, follow: false } };

export default async function HomepageContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('content.view', locale);
  const dict = getAdminDict(locale);
  const titleLabel = locale === 'ar' ? 'العنوان' : 'Title';

  const sections = await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } });

  const fields = (): FieldDef[] => [
    { key: 'titleEn', label: `${titleLabel} (EN)` },
    { key: 'titleAr', label: `${titleLabel} (AR)` },
    { key: 'sortOrder', label: dict.content.sortOrder, type: 'number' },
    { key: 'bodyEn', label: `${dict.content.body} (EN)`, type: 'textarea', full: true },
    { key: 'bodyAr', label: `${dict.content.body} (AR)`, type: 'textarea', full: true },
    { key: 'ctaLabelEn', label: `${dict.content.ctaLabel} (EN)` },
    { key: 'ctaLabelAr', label: `${dict.content.ctaLabel} (AR)` },
    { key: 'ctaHref', label: dict.content.ctaHref },
    { key: 'imageUrl', label: dict.content.image, type: 'image' },
    { key: 'mobileImageUrl', label: dict.content.mobileImage, type: 'image' },
    { key: 'isActive', label: dict.common.enabled, type: 'checkbox' },
  ];

  return (
    <>
      <PageHeader title={dict.content.homepage} subtitle={dict.content.subtitle} />
      <Panel bodyClassName="p-0">
        {sections.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.content.section}</th>
                  <th>{titleLabel}</th>
                  <th className="text-end">{dict.content.sortOrder}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => {
                  const initial = {
                    id: s.id, titleEn: s.titleEn ?? '', titleAr: s.titleAr ?? '', sortOrder: s.sortOrder,
                    bodyEn: s.bodyEn ?? '', bodyAr: s.bodyAr ?? '', ctaLabelEn: s.ctaLabelEn ?? '', ctaLabelAr: s.ctaLabelAr ?? '',
                    ctaHref: s.ctaHref ?? '', imageUrl: s.imageUrl ?? '', mobileImageUrl: s.mobileImageUrl ?? '', isActive: s.isActive,
                  };
                  return (
                    <tr key={s.id}>
                      <td data-label={dict.content.section} className="text-ink">{label(s.kind, locale)}</td>
                      <td data-label={titleLabel} className="text-ink-muted">{locale === 'ar' ? s.titleAr ?? '\u2014' : s.titleEn ?? '\u2014'}</td>
                      <td data-label={dict.content.sortOrder} className="adm-num text-end">{s.sortOrder}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={s.isActive ? 'ACTIVE' : 'ARCHIVED'} label={s.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <Drawer trigger={dict.common.edit} title={dict.content.section} wide>
                          <ResourceForm endpoint="/api/admin/content/homepage" initial={initial} fields={fields()} dict={{ common: dict.common }} transformKey="homepage" locale={locale} />
                        </Drawer>
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
