import { ProductCard, type ProductCardData } from './ProductCard';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function ProductGrid({
  cards,
  locale,
  dict,
  priorityCount = 0,
  columns = 4,
}: {
  cards: ProductCardData[];
  locale: Locale;
  dict: Dict;
  priorityCount?: number;
  columns?: 3 | 4;
}) {
  return (
    <div
      className={
        columns === 3
          ? 'grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6'
          : 'grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4'
      }
    >
      {cards.map((card, i) => (
        <ProductCard key={card.id} card={card} locale={locale} dict={dict} priority={i < priorityCount} />
      ))}
    </div>
  );
}
