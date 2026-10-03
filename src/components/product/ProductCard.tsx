'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import { Price } from '@/components/ui/Price';
import { HeartIcon } from '@/components/ui/icons';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export interface ProductCardData {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  priceBhd: number;
  compareAtBhd: number | null;
  images: string[];
  stock: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';
  isNewArrival: boolean;
  isFeatured: boolean;
  madeToOrder: boolean;
}

function badgeLabel(card: ProductCardData, dict: Dict): { text: string; tone: string } | null {
  if (card.stock === 'OUT_OF_STOCK') return { text: dict.product.outOfStock, tone: 'bg-ink-faint text-paper' };
  if (card.madeToOrder || card.stock === 'PRE_ORDER') return { text: dict.product.madeToOrderInfo, tone: 'bg-sand-300 text-ink' };
  if (card.isNewArrival) return { text: dict.nav.newArrivals, tone: 'bg-ink text-paper' };
  if (card.compareAtBhd && card.compareAtBhd > card.priceBhd) return { text: 'SALE', tone: 'bg-accent text-paper' };
  if (card.isFeatured) return { text: dict.shop.featured, tone: 'bg-sand-200 text-ink' };
  return null;
}

export function ProductCard({
  card,
  locale,
  dict,
  priority = false,
}: {
  card: ProductCardData;
  locale: Locale;
  dict: Dict;
  priority?: boolean;
}) {
  const { wishlist, toggleWishlist } = useStore();
  const [hovered, setHovered] = useState(false);
  const saved = wishlist.includes(card.id);
  const name = locale === 'ar' ? card.nameAr : card.nameEn;
  const subtitle = locale === 'ar' ? card.subtitleAr : card.subtitleEn;
  const badge = badgeLabel(card, dict);
  const secondary = card.images[1] ?? card.images[0];
  const href = `/${locale}/product/${card.slug}`;

  return (
    <article
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={href} className="block">
        <div className="relative aspect-product overflow-hidden bg-sand-50">
          {card.images[0] ? (
            <Image
              src={card.images[0]}
              alt={name}
              fill
              priority={priority}
              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
              className={clsx(
                'object-cover transition-all duration-[900ms] ease-luxe',
                hovered && secondary !== card.images[0] ? 'opacity-0' : 'opacity-100',
                hovered ? 'scale-[1.03]' : 'scale-100',
              )}
            />
          ) : (
            <div className="h-full w-full bg-sand-100" />
          )}
          {secondary && secondary !== card.images[0] ? (
            <Image
              src={secondary}
              alt={`${name} — alternate view`}
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
              className={clsx(
                'object-cover transition-opacity duration-[900ms] ease-luxe',
                hovered ? 'opacity-100' : 'opacity-0',
              )}
            />
          ) : null}

          {badge ? (
            <span
              className={clsx(
                'absolute start-3 top-3 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]',
                badge.tone,
              )}
            >
              {badge.text}
            </span>
          ) : null}

          {card.stock === 'OUT_OF_STOCK' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/50">
              <span className="text-caption uppercase tracking-[0.16em] text-ink">{dict.product.outOfStock}</span>
            </div>
          ) : null}
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          void toggleWishlist(card.id);
        }}
        aria-label={saved ? dict.product.wishlisted : dict.product.wishlist}
        aria-pressed={saved}
        className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center bg-paper/85 text-ink backdrop-blur-sm transition-all duration-300 hover:bg-paper"
      >
        <HeartIcon className="h-4 w-4" filled={saved} />
      </button>

      <div className="pt-3.5">
        <h3 className="text-small leading-snug text-ink">
          <Link href={href} className="link-underline">
            {name}
          </Link>
        </h3>
        {subtitle ? <p className="mt-1 text-caption text-ink-muted">{subtitle}</p> : null}
        <Price amountBhd={card.priceBhd} compareAtBhd={card.compareAtBhd} locale={locale} className="mt-1.5 text-price" />
      </div>
    </article>
  );
}
