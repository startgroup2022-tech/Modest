import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer, ActionButton } from '@/components/admin/Filters';
import { TaxonomyForm, type TaxonomyData } from '@/components/admin/catalog/TaxonomyForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Collections', robots: { index: false, follow: false } };

function empty(): TaxonomyData {
  return {
    slug: '',
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    imageUrl: '',
    taglineEn: '',
    taglineAr: '',
    metaTitleEn: '',
    metaTitleAr: '',
    metaDescEn: '',
    metaDescAr: '',
    noIndex: false,
    isActive: true,
    isFeatured: false,
    sortOrder: '0',
  };
}

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('products.view', locale);
  const dict = getAdminDict(locale);

  const collections = await prisma.collection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader
        title={dict.nav.collections}
        subtitle={dict.products.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.nav.collections} wide>
            <TaxonomyForm kind="collections" initial={empty()} dict={{ common: dict.common, products: dict.products }} locale={locale} />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {collections.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.collection}</th>
                  <th>Slug</th>
                  <th className="text-end">{dict.common.product}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((col) => {
                  const data: TaxonomyData = {
                    id: col.id,
                    slug: col.slug,
                    nameEn: col.nameEn,
                    nameAr: col.nameAr,
                    descriptionEn: col.descriptionEn ?? '',
                    descriptionAr: col.descriptionAr ?? '',
                    imageUrl: col.heroImage ?? '',
                    taglineEn: col.taglineEn ?? '',
                    taglineAr: col.taglineAr ?? '',
                    metaTitleEn: col.metaTitleEn ?? '',
                    metaTitleAr: col.metaTitleAr ?? '',
                    metaDescEn: col.metaDescEn ?? '',
                    metaDescAr: col.metaDescAr ?? '',
                    noIndex: col.noIndex,
                    isActive: col.isActive,
                    isFeatured: col.isFeatured,
                    sortOrder: String(col.sortOrder),
                  };
                  return (
                    <tr key={col.id}>
                      <td data-label={dict.common.collection} className="text-ink">
                        {locale === 'ar' ? col.nameAr : col.nameEn}
                      </td>
                      <td data-label="Slug" className="text-caption text-ink-muted">{col.slug}</td>
                      <td data-label={dict.common.product} className="adm-num text-end">{formatNumber(col._count.products, locale)}</td>
                      <td data-label={dict.common.status}>
                        <span className="flex gap-1.5">
                          <StatusBadge status={col.isActive ? 'ACTIVE' : 'ARCHIVED'} label={col.isActive ? dict.common.enabled : dict.common.disabled} />
                          {col.isFeatured && <span className="adm-badge-accent">{dict.products.featured}</span>}
                        </span>
                      </td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <TaxonomyForm kind="collections" initial={data} dict={{ common: dict.common, products: dict.products }} locale={locale} />
                          </Drawer>
                          <ActionButton
                            endpoint={`/api/admin/collections/${col.id}`}
                            method="DELETE"
                            variant="ghost"
                            className="adm-btn-sm"
                            confirm={`${dict.common.delete}? ${dict.common.irreversible}`}
                          >
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
