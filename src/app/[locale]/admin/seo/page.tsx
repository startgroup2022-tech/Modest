import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SEO', robots: { index: false, follow: false } };

export default async function SeoDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('seo.view', locale);
  const dict = getAdminDict(locale);
  const href = (p: string) => adminHref(locale, p);

  const [products, categories, collections, pages, redirects] = await Promise.all([
    prisma.product.findMany({ select: { nameEn: true, nameAr: true, metaTitleEn: true, metaTitleAr: true, metaDescEn: true, metaDescAr: true, status: true } }),
    prisma.category.findMany({ select: { nameEn: true, nameAr: true, metaTitleEn: true, metaTitleAr: true, metaDescEn: true, metaDescAr: true } }),
    prisma.collection.findMany({ select: { nameEn: true, nameAr: true, metaTitleEn: true, metaTitleAr: true, metaDescEn: true, metaDescAr: true } }),
    prisma.page.findMany({ select: { slug: true, titleEn: true, titleAr: true, metaTitleEn: true, metaTitleAr: true, metaDescEn: true, metaDescAr: true, noIndex: true } }),
    prisma.redirect.findMany({ select: { id: true, fromPath: true, toPath: true, isEnabled: true, hits: true } }),
  ]);

  type SeoRow = { name: string; hasTitle: boolean; hasDesc: boolean; noIndex?: boolean };
  const toRows = (
    items: { nameEn: string; nameAr: string; metaTitleEn: string | null; metaTitleAr: string | null; metaDescEn: string | null; metaDescAr: string | null }[],
  ): SeoRow[] =>
    items.map((i) => ({
      name: i.nameEn || i.nameAr,
      hasTitle: Boolean(i.metaTitleEn && i.metaTitleAr),
      hasDesc: Boolean(i.metaDescEn && i.metaDescAr),
    }));

  const productRows = toRows(products.filter((p) => p.status !== 'ARCHIVED'));
  const categoryRows = toRows(categories);
  const collectionRows = toRows(collections);
  const pageRows: SeoRow[] = pages.map((p) => ({
    name: p.slug,
    hasTitle: Boolean(p.metaTitleEn && p.metaTitleAr),
    hasDesc: Boolean(p.metaDescEn && p.metaDescAr),
    noIndex: p.noIndex,
  }));

  const all = [...productRows, ...categoryRows, ...collectionRows, ...pageRows];
  const missingTitle = all.filter((r) => !r.hasTitle).length;
  const missingDesc = all.filter((r) => !r.hasDesc).length;
  const health = all.length === 0 ? 100 : Math.round(((all.length * 2 - missingTitle - missingDesc) / (all.length * 2)) * 100);

  const groups: { key: string; label: string; rows: SeoRow[]; path: string }[] = [
    { key: 'products', label: dict.seo.products, rows: productRows, path: 'products' },
    { key: 'categories', label: dict.seo.categories, rows: categoryRows, path: 'categories' },
    { key: 'collections', label: dict.seo.collections, rows: collectionRows, path: 'collections' },
    { key: 'pages', label: dict.seo.pages, rows: pageRows, path: 'content/pages' },
  ];

  return (
    <>
      <PageHeader title={dict.seo.title} subtitle={dict.seo.subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={dict.seo.health} value={`${health}%`} tone={health >= 90 ? 'success' : health >= 70 ? 'warn' : 'danger'} />
        <Kpi label={dict.seo.missingTitle} value={formatNumber(missingTitle, locale)} tone={missingTitle ? 'warn' : 'success'} />
        <Kpi label={dict.seo.missingDescription} value={formatNumber(missingDesc, locale)} tone={missingDesc ? 'warn' : 'success'} />
        <Kpi label={dict.seo.redirects} value={formatNumber(redirects.length, locale)} href={href('seo/redirects')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => {
          const issues = g.rows.filter((r) => !r.hasTitle || !r.hasDesc || r.noIndex);
          return (
            <Panel key={g.key} title={g.label} action={<Link href={href(g.path)} className="adm-btn-ghost adm-btn-sm">{dict.common.open}</Link>}>
              {g.rows.length === 0 ? (
                <AdminEmpty title={dict.common.empty} />
              ) : issues.length === 0 ? (
                <p className="text-small text-success">{dict.seo.healthy} — {formatNumber(g.rows.length, locale)}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {issues.slice(0, 8).map((r) => (
                    <li key={r.name} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-small text-ink">{r.name}</span>
                      <span className="flex shrink-0 gap-1.5">
                        {!r.hasTitle && <span className="adm-badge-warn">{dict.seo.missingTitle}</span>}
                        {!r.hasDesc && <span className="adm-badge-warn">{dict.seo.missingDescription}</span>}
                        {r.noIndex && <span className="adm-badge-neutral">{dict.seo.noindexed}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="mt-6">
        <Panel title={dict.seo.ai}>
          <p className="text-small text-ink-muted">
            {locale === 'ar'
              ? 'الهيكل الدلالي، البيانات المنظمة، العناوين الوصفية والروابط الداخلية تعرّف محركات البحث الذكية بعلامة أتنشن ومنتجاتها ومجموعاتها وسياساتها.'
              : 'Semantic structure, structured data, descriptive headings and internal linking expose the Attention brand, products, collections and policies to AI-powered search.'}
          </p>
        </Panel>
      </div>
    </>
  );
}
