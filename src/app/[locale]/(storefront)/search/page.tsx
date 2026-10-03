import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProducts, searchCatalog } from '@/lib/catalog';
import { toProductCardData } from '@/lib/serialize';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const dict = getDictionary(locale);
  return {
    title: q ? `${dict.search.resultsFor} “${q}”` : dict.search.title,
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const q = (typeof sp.q === 'string' ? sp.q : '').trim();

  if (q.length < 2) {
    return (
      <div className="shell pt-12">
        <header className="mb-8 border-b border-line pb-6">
          <h1 className="text-h1">{dict.search.title}</h1>
        </header>
        <EmptyState
          title={dict.search.startTyping}
          actionLabel={dict.nav.shop}
          actionHref={`/${locale}/shop`}
        />
      </div>
    );
  }

  const [result, suggestions] = await Promise.all([
    getProducts({ locale, search: q, sort: 'featured', perPage: 24 }),
    searchCatalog(q, 4),
  ]);

  const cards = result.items.map(toProductCardData);

  return (
    <div className="shell pt-12">
      <header className="mb-8 border-b border-line pb-6">
        <p className="eyebrow mb-2">{dict.search.resultsFor}</p>
        <h1 className="text-h1">“{q}”</h1>
        <p className="mt-2 text-small text-ink-muted">
          {result.total} {dict.collections.pieces}
        </p>
      </header>

      {suggestions.categories.length || suggestions.collections.length ? (
        <div className="mb-10 flex flex-wrap items-center gap-2">
          <span className="text-caption uppercase tracking-[0.12em] text-ink-faint">{dict.search.tryThese}</span>
          {suggestions.categories.map((c) => (
            <Link
              key={`cat-${c.slug}`}
              href={`/${locale}/shop?category=${c.slug}`}
              className="border border-line px-3 py-1.5 text-caption transition-colors hover:border-ink"
            >
              {locale === 'ar' ? c.nameAr : c.nameEn}
            </Link>
          ))}
          {suggestions.collections.map((c) => (
            <Link
              key={`col-${c.slug}`}
              href={`/${locale}/collections/${c.slug}`}
              className="border border-line px-3 py-1.5 text-caption transition-colors hover:border-ink"
            >
              {locale === 'ar' ? c.nameAr : c.nameEn}
            </Link>
          ))}
        </div>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title={dict.search.noResults}
          body={dict.search.noResultsBody}
          actionLabel={dict.nav.shop}
          actionHref={`/${locale}/shop`}
        />
      ) : (
        <ProductGrid cards={cards} locale={locale} dict={dict} priorityCount={4} />
      )}
    </div>
  );
}
