import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDate } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pages', robots: { index: false, follow: false } };

export default async function PagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('content.view', locale);
  const dict = getAdminDict(locale);
  const titleLabel = locale === 'ar' ? 'العنوان' : 'Title';

  const pages = await prisma.page.findMany({ orderBy: { slug: 'asc' } });

  const fields = (): FieldDef[] => [
    { key: 'slug', label: 'Slug' },
    { key: 'titleEn', label: `${titleLabel} (EN)` },
    { key: 'titleAr', label: `${titleLabel} (AR)` },
    { key: 'bodyEn', label: `${dict.content.body} (EN)`, type: 'textarea', full: true },
    { key: 'bodyAr', label: `${dict.content.body} (AR)`, type: 'textarea', full: true },
    { key: 'metaTitleEn', label: dict.seo.metaTitleEn },
    { key: 'metaTitleAr', label: dict.seo.metaTitleAr },
    { key: 'metaDescEn', label: dict.seo.metaDescEn, type: 'textarea', full: true },
    { key: 'metaDescAr', label: dict.seo.metaDescAr, type: 'textarea', full: true },
    { key: 'noIndex', label: dict.seo.noIndex, type: 'checkbox' },
    { key: 'isActive', label: dict.common.enabled, type: 'checkbox' },
  ];
  const blank = { slug: '', titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', metaTitleEn: '', metaTitleAr: '', metaDescEn: '', metaDescAr: '', noIndex: false, isActive: true };

  return (
    <>
      <PageHeader
        title={dict.nav.pages}
        subtitle={dict.content.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.nav.pages} wide>
            <ResourceForm endpoint="/api/admin/pages" initial={blank} fields={fields()} dict={{ common: dict.common }} />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {pages.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{titleLabel}</th>
                  <th>Slug</th>
                  <th>{dict.common.updatedAt}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((pg) => {
                  const initial = {
                    id: pg.id, slug: pg.slug, titleEn: pg.titleEn, titleAr: pg.titleAr, bodyEn: pg.bodyEn, bodyAr: pg.bodyAr,
                    metaTitleEn: pg.metaTitleEn ?? '', metaTitleAr: pg.metaTitleAr ?? '', metaDescEn: pg.metaDescEn ?? '', metaDescAr: pg.metaDescAr ?? '',
                    noIndex: pg.noIndex, isActive: pg.isActive,
                  };
                  return (
                    <tr key={pg.id}>
                      <td data-label={titleLabel} className="text-ink">{locale === 'ar' ? pg.titleAr : pg.titleEn}</td>
                      <td data-label="Slug" className="text-caption text-ink-muted">/{locale}/{pg.slug}</td>
                      <td data-label={dict.common.updatedAt} className="text-caption text-ink-faint">{formatDate(pg.updatedAt, locale)}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={pg.isActive ? 'ACTIVE' : 'ARCHIVED'} label={pg.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <Drawer trigger={dict.common.edit} title={dict.common.edit} wide>
                          <ResourceForm endpoint="/api/admin/pages" initial={initial} fields={fields()} dict={{ common: dict.common }} />
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
