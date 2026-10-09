import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { PageHeader, Panel } from '@/components/admin/ui';
import { ProductForm, emptyProduct, type ProductFormData } from '@/components/admin/catalog/ProductForm';
import { ProductMediaManager } from '@/components/admin/catalog/ProductMediaManager';
import { VariantManager } from '@/components/admin/catalog/VariantManager';
import { ProductDangerZone } from '@/components/admin/catalog/ProductDangerZone';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Product', robots: { index: false, follow: false } };

function toForm(p: {
  id: string;
  slug: string;
  sku: string | null;
  nameEn: string;
  nameAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  materialsEn: string | null;
  materialsAr: string | null;
  careEn: string | null;
  careAr: string | null;
  priceBhd: unknown;
  compareAtBhd: unknown;
  status: string;
  kind: string;
  cutId: string | null;
  tailorFeeBhd: unknown;
  showAvailability: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  madeToOrder: boolean;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  lowStockThreshold: number;
  metaTitleEn: string | null;
  metaTitleAr: string | null;
  metaDescEn: string | null;
  metaDescAr: string | null;
  noIndex: boolean;
}): ProductFormData {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku ?? '',
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    subtitleEn: p.subtitleEn ?? '',
    subtitleAr: p.subtitleAr ?? '',
    descriptionEn: p.descriptionEn ?? '',
    descriptionAr: p.descriptionAr ?? '',
    materialsEn: p.materialsEn ?? '',
    materialsAr: p.materialsAr ?? '',
    careEn: p.careEn ?? '',
    careAr: p.careAr ?? '',
    priceBhd: p.priceBhd == null ? '' : String(p.priceBhd),
    compareAtBhd: p.compareAtBhd == null ? '' : String(p.compareAtBhd),
    status: p.status,
    kind: p.kind,
    cutId: p.cutId ?? '',
    tailorFeeBhd: p.tailorFeeBhd == null ? '' : String(p.tailorFeeBhd),
    showAvailability: p.showAvailability,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    madeToOrder: p.madeToOrder,
    leadTimeMinDays: String(p.leadTimeMinDays),
    leadTimeMaxDays: String(p.leadTimeMaxDays),
    lowStockThreshold: String(p.lowStockThreshold),
    metaTitleEn: p.metaTitleEn ?? '',
    metaTitleAr: p.metaTitleAr ?? '',
    metaDescEn: p.metaDescEn ?? '',
    metaDescAr: p.metaDescAr ?? '',
    noIndex: p.noIndex,
    categoryIds: [],
    collectionIds: [],
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('products.view', locale);
  const dict = getAdminDict(locale);
  const href = (p: string) => adminHref(locale, p);

  const [product, categories, collections, cuts] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: { orderBy: { sortOrder: 'asc' } },
        categories: true,
        collections: true,
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.collection.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.productCut.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }] }),
  ]);
  if (!product) notFound();

  const formData = toForm(product);
  formData.categoryIds = product.categories.map((c) => c.categoryId);
  formData.collectionIds = product.collections.map((c) => c.collectionId);

  return (
    <>
      <PageHeader
        title={locale === 'ar' ? product.nameAr : product.nameEn}
        subtitle={`${product.sku ?? dict.common.sku} · ${product.slug}`}
        actions={
          <Link href={href('products')} className="adm-btn-ghost">
            ← {dict.common.back}
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel>
            <ProductForm
              initial={formData}
              locale={locale}
              canApprove={admin.permissions.has('products.approve')}
              dict={{ products: dict.products, common: dict.common }}
              categories={categories.map((c) => ({ id: c.id, name: locale === 'ar' ? c.nameAr : c.nameEn }))}
              collections={collections.map((c) => ({ id: c.id, name: locale === 'ar' ? c.nameAr : c.nameEn }))}
              cuts={cuts.map((c) => ({ id: c.id, code: c.code, name: locale === 'ar' ? c.nameAr : c.nameEn }))}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={dict.products.variants} bodyClassName="p-0">
            <VariantManager
              productId={product.id}
              locale={locale}
              dict={dict}
              variants={product.variants.map((v) => ({
                id: v.id,
                size: v.size,
                colorEn: v.colorEn ?? '',
                sku: v.sku ?? '',
                priceBhd: v.priceBhd == null ? '' : String(v.priceBhd),
                stock: v.stock,
                stockStatus: v.stockStatus,
                isActive: v.isActive,
              }))}
            />
          </Panel>

          <Panel title={dict.products.media} bodyClassName="p-0">
            <ProductMediaManager
              productId={product.id}
              locale={locale}
              dict={dict}
              media={product.media.map((m) => ({
                id: m.id,
                url: m.url,
                altEn: m.altEn ?? '',
                altAr: m.altAr ?? '',
                isPrimary: m.isPrimary,
              }))}
            />
          </Panel>

          <Panel title={dict.products.advanced}>
            <ProductDangerZone
              productId={product.id}
              locale={locale}
              dict={dict}
              canDelete
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
