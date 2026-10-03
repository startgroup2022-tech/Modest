'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/components/providers/StoreProvider';
import type { ProductCardData } from '@/components/product/ProductCard';
import { ProductGrid } from '@/components/product/ProductGrid';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { HeartIcon } from '@/components/ui/icons';

export interface WishlistEntry {
  card: ProductCardData;
  defaultVariantId: string | null;
}

export function WishlistGrid({ entries, locale, dict }: { entries: WishlistEntry[]; locale: Locale; dict: Dict }) {
  const { wishlist, addItem, setCartOpen } = useStore();
  const [pending, setPending] = useState<string | null>(null);

  // Read live store state so a removal from a card's heart also drops the row.
  const visible = entries.filter((e) => wishlist.includes(e.card.id));

  async function moveToBag(entry: WishlistEntry) {
    if (!entry.defaultVariantId) return;
    setPending(entry.card.id);
    try {
      await addItem(entry.card.id, entry.defaultVariantId, 1);
      setCartOpen(true);
    } finally {
      setPending(null);
    }
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <HeartIcon className="mb-5 h-6 w-6 text-ink-faint" />
        <h2 className="text-h3">{dict.wishlist.empty}</h2>
        <p className="mt-3 max-w-sm text-small text-ink-muted">{dict.wishlist.emptyBody}</p>
        <Link href={`/${locale}/shop`} className="btn-primary mt-8">
          {dict.wishlist.browse}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ProductGrid cards={visible.map((e) => e.card)} locale={locale} dict={dict} priorityCount={4} />

      <div className="mt-12 border-t border-line pt-8">
        <p className="eyebrow mb-5">{dict.account.moveToCart}</p>
        <ul className="divide-y divide-line">
          {visible.map((entry) => {
            const name = locale === 'ar' ? entry.card.nameAr : entry.card.nameEn;
            return (
              <li key={entry.card.id} className="flex items-center justify-between gap-4 py-4">
                <span className="text-small text-ink">{name}</span>
                {entry.defaultVariantId ? (
                  <button
                    type="button"
                    onClick={() => void moveToBag(entry)}
                    disabled={pending === entry.card.id}
                    className="link-underline text-label uppercase tracking-luxe text-ink disabled:opacity-40"
                  >
                    {dict.account.moveToCart}
                  </button>
                ) : (
                  <Link
                    href={`/${locale}/product/${entry.card.slug}`}
                    className="link-underline text-label uppercase tracking-luxe text-ink"
                  >
                    {dict.product.selectSize}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
