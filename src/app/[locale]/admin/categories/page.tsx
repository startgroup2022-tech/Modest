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
export const metadata: Metadata = { title: 'Categories', robots: { index: false, follow: false } };

function emptyTaxonomy(): TaxonomyData {
  return {
    slug: '',
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    imageUrl: '',
    metaTitleEn: '',
    metaTitleAr: '',
    metaDescEn: '',
    metaDescAr: '',
    noIndex: false,
    isActive: true,
    sortOrder: '0',
  };
}

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('products.view', locale);
  const dict = getAdminDict(locale);

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader
        title={dict.nav.categories}
        subtitle={dict.products.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.nav.categories} wide>
            <TaxonomyForm kind="categories" initial={emptyTaxonomy()} dict={{ common: dict.common, products: dict.products }} locale={locale} />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {categories.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.category}</th>
                  <th>Slug</th>
                  <th className="text-end">{dict.common.product}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const data: TaxonomyData = {
                    id: cat.id,
                    slug: cat.slug,
                    nameEn: cat.nameEn,
                    nameAr: cat.nameAr,
                    descriptionEn: cat.descriptionEn ?? '',
                    descriptionAr: cat.descriptionAr ?? '',
                    imageUrl: cat.imageUrl ?? '',
                    metaTitleEn: cat.metaTitleEn ?? '',
                    metaTitleAr: cat.metaTitleAr ?? '',
                    metaDescEn: cat.metaDescEn ?? '',
                    metaDescAr: cat.metaDescAr ?? '',
                    noIndex: cat.noIndex,
                    isActive: cat.isActive,
                    sortOrder: String(cat.sortOrder),
                  };
                  return (
                    <tr key={cat.id}>
                      <td data-label={dict.common.category} className="text-ink">
                        {locale === 'ar' ? cat.nameAr : cat.nameEn}
                      </td>
                      <td data-label="Slug" className="text-caption text-ink-muted">{cat.slug}</td>
                      <td data-label={dict.common.product} className="adm-num text-end">{formatNumber(cat._count.products, locale)}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={cat.isActive ? 'ACTIVE' : 'ARCHIVED'} label={cat.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <TaxonomyForm kind="categories" initial={data} dict={{ common: dict.common, products: dict.products }} locale={locale} />
                          </Drawer>
                          <ActionButton
                            endpoint={`/api/admin/categories/${cat.id}`}
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
