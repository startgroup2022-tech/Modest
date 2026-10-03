import { getFeaturedProducts, getNewArrivals, getCollections } from '@/lib/catalog';
import { toProductCardData } from '@/lib/serialize';
import { ProductCard } from '@/components/product/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export async function FeaturedProducts({
  locale,
  limit = 8,
}: {
  locale: Locale;
  limit?: number;
}) {
  const dict = getDictionary(locale);
  const rows = await getFeaturedProducts(limit);
  const cards = rows.map(toProductCardData);

  return (
    <section aria-labelledby="featured-heading" className="shell py-16 md:py-24">
      <header className="mb-8 flex items-end justify-between gap-6 md:mb-12">
        <h2 id="featured-heading" className="text-h2">
          {dict.home.featuredProducts}
        </h2>
        <a
          href={`/${locale}/shop`}
          className="link-underline shrink-0 text-caption uppercase tracking-[0.14em] text-ink-muted"
        >
          {dict.home.viewAll}
        </a>
      </header>
      {cards.length === 0 ? (
        <EmptyState title={dict.shop.noResults} actionLabel={dict.shop.allCategories} actionHref={`/${locale}/shop`} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {cards.map((card, i) => (
            <ProductCard key={card.id} card={card} locale={locale} dict={dict} priority={i < 2} />
          ))}
        </div>
      )}
    </section>
  );
}

export async function NewArrivalsRail({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const rows = await getNewArrivals(4);
  if (!rows.length) return null;
  const cards = rows.map(toProductCardData);
  return (
    <section aria-labelledby="new-arrivals-heading" className="border-t border-line bg-paper-warm py-16 md:py-24">
      <div className="shell">
        <header className="mb-8 flex items-end justify-between gap-6 md:mb-12">
          <h2 id="new-arrivals-heading" className="text-h2">
            {dict.nav.newArrivals}
          </h2>
          <a
            href={`/${locale}/shop?sort=newest`}
            className="link-underline shrink-0 text-caption uppercase tracking-[0.14em] text-ink-muted"
          >
            {dict.home.viewAll}
          </a>
        </header>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
          {cards.map((card) => (
            <ProductCard key={card.id} card={card} locale={locale} dict={dict} />
          ))}
        </div>
      </div>
    </section>
  );
}
