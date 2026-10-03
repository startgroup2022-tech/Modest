import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDate, label } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Promotions', robots: { index: false, follow: false } };

export default async function PromotionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('promotions.view', locale);
  const dict = getAdminDict(locale);
  const p = dict.promotions;
  const titleLabel = locale === 'ar' ? 'العنوان' : 'Title';

  const promotions = await prisma.promotion.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });

  const fields = (): FieldDef[] => [
    { key: 'titleEn', label: `${titleLabel} (EN)` },
    { key: 'titleAr', label: `${titleLabel} (AR)` },
    { key: 'placement', label: p.placement, type: 'select', options: [
      { value: 'announcement', label: dict.content.announcement },
      { value: 'home_banner', label: dict.content.hero },
    ] },
    { key: 'sortOrder', label: dict.content.sortOrder, type: 'number' },
    { key: 'bodyEn', label: `${dict.content.body} (EN)`, type: 'textarea', full: true },
    { key: 'bodyAr', label: `${dict.content.body} (AR)`, type: 'textarea', full: true },
    { key: 'ctaLabelEn', label: `${dict.content.ctaLabel} (EN)` },
    { key: 'ctaLabelAr', label: `${dict.content.ctaLabel} (AR)` },
    { key: 'ctaHref', label: dict.content.ctaHref },
    { key: 'imageUrl', label: dict.content.image },
    { key: 'startsAt', label: p.startsAt, type: 'date' },
    { key: 'endsAt', label: p.expiresAt, type: 'date' },
    { key: 'isActive', label: dict.common.enabled, type: 'checkbox' },
  ];

  const blank = { titleEn: '', titleAr: '', placement: 'announcement', sortOrder: 0, bodyEn: '', bodyAr: '', ctaLabelEn: '', ctaLabelAr: '', ctaHref: '', imageUrl: '', startsAt: '', endsAt: '', isActive: true };

  return (
    <>
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        actions={
          <Drawer trigger={`+ ${p.newPromotion}`} title={p.newPromotion} wide>
            <ResourceForm endpoint="/api/admin/promotions" initial={blank} fields={fields()} dict={{ common: dict.common }} transformKey="promotions" />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {promotions.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{titleLabel}</th>
                  <th>{p.placement}</th>
                  <th>{p.startsAt}</th>
                  <th>{p.expiresAt}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((row) => {
                  const initial = {
                    id: row.id, titleEn: row.titleEn, titleAr: row.titleAr, placement: row.placement, sortOrder: row.sortOrder,
                    bodyEn: row.bodyEn ?? '', bodyAr: row.bodyAr ?? '', ctaLabelEn: row.ctaLabelEn ?? '', ctaLabelAr: row.ctaLabelAr ?? '',
                    ctaHref: row.ctaHref ?? '', imageUrl: row.imageUrl ?? '',
                    startsAt: row.startsAt ? row.startsAt.toISOString().slice(0, 10) : '',
                    endsAt: row.endsAt ? row.endsAt.toISOString().slice(0, 10) : '', isActive: row.isActive,
                  };
                  return (
                    <tr key={row.id}>
                      <td data-label={titleLabel} className="text-ink">{locale === 'ar' ? row.titleAr : row.titleEn}</td>
                      <td data-label={p.placement} className="text-ink-muted">{label(row.placement, locale)}</td>
                      <td data-label={p.startsAt} className="text-caption text-ink-muted">{row.startsAt ? formatDate(row.startsAt, locale) : '—'}</td>
                      <td data-label={p.expiresAt} className="text-caption text-ink-muted">{row.endsAt ? formatDate(row.endsAt, locale) : '—'}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={row.isActive ? 'ACTIVE' : 'ARCHIVED'} label={row.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <ResourceForm endpoint="/api/admin/promotions" initial={initial} fields={fields()} dict={{ common: dict.common }} transformKey="promotions" />
                          </Drawer>
                          <ActionButton endpoint={`/api/admin/promotions/${row.id}`} method="DELETE" variant="ghost" className="adm-btn-sm" confirm={`${dict.common.delete}? ${dict.common.irreversible}`}>
                            {dict.common.delete}
                          </ActionButton>
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
