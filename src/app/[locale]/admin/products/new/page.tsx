import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { PageHeader, Panel } from '@/components/admin/ui';
import { ProductForm, emptyProduct } from '@/components/admin/catalog/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New product', robots: { index: false, follow: false } };

export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('products.create', locale);
  const dict = getAdminDict(locale);
  const href = (p: string) => adminHref(locale, p);

  const [categories, collections, cuts] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.collection.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.productCut.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }] }),
  ]);

  return (
    <>
      <PageHeader
        title={dict.products.newProduct}
        subtitle={dict.products.subtitle}
        actions={
          <Link href={href('products')} className="adm-btn-ghost">
            ← {dict.common.back}
          </Link>
        }
      />
      <Panel>
        <ProductForm
          initial={emptyProduct}
          locale={locale}
          canApprove={admin.permissions.has('products.approve')}
          dict={{ products: dict.products, common: dict.common }}
          categories={categories.map((c) => ({ id: c.id, name: locale === 'ar' ? c.nameAr : c.nameEn }))}
          collections={collections.map((c) => ({ id: c.id, name: locale === 'ar' ? c.nameAr : c.nameEn }))}
          cuts={cuts.map((c) => ({ id: c.id, code: c.code, name: locale === 'ar' ? c.nameAr : c.nameEn }))}
        />
      </Panel>
    </>
  );
}
