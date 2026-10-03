import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getProducts, getCategories, getCollections, getPriceBounds } from '@/lib/catalog';
import { toProductCardData } from '@/lib/serialize';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShopFilters, SortSelect } from '@/components/shop/ShopFilters';
import { Pagination } from '@/components/shop/Pagination';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const category = typeof sp.category === 'string' ? sp.category : Array.isArray(sp.category) ? sp.category[0] : undefined;
  const categories = category ? await getCategories() : [];
  const active = categories.find((c) => c.slug === category);
  const title = active ? (locale === 'ar' ? active.nameAr : active.nameEn) : dict.shop.title;
  const query = sp.page ? `?page=${sp.page}` : '';
  return {
    title,
    description: dict.brand.description,
    alternates: {
      canonical: `/${locale}/shop${query}`,
      languages: { en: `/en/shop${query}`, ar: `/ar/shop${query}`, 'x-default': `/en/shop${query}` },
    },
  };
}

function parseArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function num(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const sp = await searchParams;

  const categorySlugs = parseArray(sp.category);
  const collectionSlug = typeof sp.collection === 'string' ? sp.collection : undefined;
  const sortRaw = typeof sp.sort === 'string' ? sp.sort : 'newest';
  const sort = (['newest', 'oldest', 'price_asc', 'price_desc', 'featured'] as const).includes(
    sortRaw as never,
  )
    ? (sortRaw as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'featured')
    : 'newest';
  const page = Math.max(1, num(sp.page) ?? 1);
  const kind = typeof sp.kind === 'string' ? sp.kind : undefined;
  const stock = typeof sp.stock === 'string' ? sp.stock : undefined;
  const search = typeof sp.q === 'string' ? sp.q.trim() : undefined;

  const [result, categories, collections, bounds] = await Promise.all([
    getProducts({
      locale,
      categorySlugs,
      collectionSlug,
      search,
      sort,
      page,
      perPage: 12,
      madeToOrder: kind === 'mto' ? true : undefined,
      inStockOnly: stock === 'in' ? true : undefined,
      minPriceBhd: num(sp.min),
      maxPriceBhd: num(sp.max),
    }),
    getCategories(),
    getCollections(),
    getPriceBounds(),
  ]);

  const cards = result.items.map(toProductCardData);
  const localizedCategories = categories.map((c) => ({
    slug: c.slug,
    name: locale === 'ar' ? c.nameAr : c.nameEn,
    count: c._count.products,
  }));
  const localizedCollections = collections.map((c) => ({
    slug: c.slug,
    name: locale === 'ar' ? c.nameAr : c.nameEn,
    count: c._count.products,
  }));

  const activeCategory = categories.find((c) => categorySlugs.includes(c.slug));

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: cards.slice(0, 12).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `/${locale}/product/${c.slug}`,
      name: locale === 'ar' ? c.nameAr : c.nameEn,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <div className="shell pt-10 md:pt-14">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-caption uppercase tracking-[0.12em] text-ink-muted">
            <li>
              <Link href={`/${locale}`} className="link-underline">
                {dict.nav.home}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink">{activeCategory ? (locale === 'ar' ? activeCategory.nameAr : activeCategory.nameEn) : dict.shop.title}</li>
          </ol>
        </nav>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6 md:mb-10">
          <div>
            <h1 className="text-h1">
              {activeCategory ? (locale === 'ar' ? activeCategory.nameAr : activeCategory.nameEn) : dict.shop.title}
            </h1>
            <p className="mt-2 text-small text-ink-muted">
              {result.total} {dict.shop.products}
            </p>
          </div>
          <Suspense fallback={null}>
            <SortSelect dict={dict} />
          </Suspense>
        </header>

        <div className="grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-14">
          <Suspense fallback={<div className="h-40" />}>
            <ShopFilters
              dict={dict}
              categories={localizedCategories}
              collections={localizedCollections}
              bounds={bounds}
              resultCount={result.total}
            />
          </Suspense>

          <div>
            {cards.length === 0 ? (
              <EmptyState
                title={dict.shop.noResults}
                body={dict.shop.noResultsBody}
                actionLabel={dict.shop.clear}
                actionHref={`/${locale}/shop`}
              />
            ) : (
              <Suspense fallback={<ProductGridSkeleton count={12} />}>
                <ProductGrid cards={cards} locale={locale} dict={dict} priorityCount={4} />
              </Suspense>
            )}
            <Suspense fallback={null}>
              <Pagination page={result.page} totalPages={result.totalPages} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
