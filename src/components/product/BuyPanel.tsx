'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import { HeartIcon, RulerIcon, TruckIcon, ArrowRight } from '@/components/ui/icons';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export interface BuyVariant {
  id: string;
  size: string;
  colorEn: string | null;
  colorAr: string | null;
  stock: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';
}

export function BuyPanel({
  productId,
  productSlug,
  variants,
  madeToOrder,
  leadTimeMin,
  leadTimeMax,
  dict,
  locale,
  sizeGuideHref,
}: {
  productId: string;
  productSlug: string;
  variants: BuyVariant[];
  madeToOrder: boolean;
  leadTimeMin: number;
  leadTimeMax: number;
  dict: Dict;
  locale: Locale;
  sizeGuideHref: string;
}) {
  const { addItem, toggleWishlist, wishlist, busy, setCartOpen, setFlash } = useStore();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'add' | 'buy' | null>(null);

  const inWishlist = wishlist.includes(productId);
  const requiresSize = variants.length > 0;
  const active = useMemo(() => variants.find((v) => v.id === selected) ?? null, [variants, selected]);
  const soldOut = active ? active.stockStatus === 'OUT_OF_STOCK' : false;
  const lowStock = active ? active.stockStatus === 'LOW_STOCK' || (active.stock > 0 && active.stock <= 3) : false;

  const resolveVariantId = () => {
    if (!requiresSize) return null;
    return selected;
  };

  const submit = async (mode: 'add' | 'buy') => {
    setLocalError(null);
    const variantId = resolveVariantId();
    if (requiresSize && !variantId) {
      setLocalError(dict.product.selectSize);
      return;
    }
    if (soldOut) {
      setLocalError(dict.product.outOfStock);
      return;
    }
    setSubmitting(mode);
    try {
      await addItem(productId, variantId, 1);
      if (mode === 'buy') {
        router.push(`/${locale}/checkout`);
      } else {
        setCartOpen(true);
        setFlash(dict.cart.added);
      }
    } catch {
      setLocalError(dict.errors.generic);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mt-7">
      {requiresSize ? (
        <div>
          <div className="flex items-center justify-between">
            <span className="eyebrow">{dict.product.size}</span>
            <Link href={sizeGuideHref} className="link-underline inline-flex items-center gap-1.5 text-caption uppercase tracking-[0.12em] text-ink-muted">
              <RulerIcon className="h-3.5 w-3.5" />
              {dict.nav.sizeGuide}
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {variants.map((v) => {
              const isActive = v.id === selected;
              const disabled = v.stockStatus === 'OUT_OF_STOCK';
              const color = locale === 'ar' ? v.colorAr : v.colorEn;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(v.id);
                      setLocalError(null);
                    }}
                    disabled={disabled}
                    aria-pressed={isActive}
                    className={clsx(
                      'min-w-[3.25rem] border px-4 py-2.5 text-small transition-colors',
                      isActive ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink',
                      disabled && 'cursor-not-allowed border-line text-ink-faint line-through hover:border-line',
                    )}
                  >
                    {v.size}
                    {color ? <span className="ms-1 text-caption opacity-70">{color}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {lowStock ? (
        <p className="mt-3 text-caption uppercase tracking-[0.1em] text-accent-deep">{dict.product.lowStock}</p>
      ) : null}

      {localError ? (
        <p role="alert" className="mt-4 border border-danger/30 bg-danger/5 px-4 py-3 text-small text-danger">
          {localError}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => submit('add')}
          disabled={busy || submitting !== null || soldOut}
          className="btn-primary btn-block"
        >
          {submitting === 'add' ? dict.common.loading : soldOut ? dict.product.outOfStock : dict.product.addToBag}
        </button>
        <button
          type="button"
          onClick={() => submit('buy')}
          disabled={busy || submitting !== null || soldOut}
          className="btn-outline btn-block"
        >
          {submitting === 'buy' ? dict.common.loading : dict.product.buyNow}
          {!soldOut ? <ArrowRight className="h-4 w-4 rtl:rotate-180" /> : null}
        </button>
        <button
          type="button"
          onClick={() => toggleWishlist(productId)}
          className={clsx(
            'btn-quiet btn-block gap-2',
            inWishlist ? 'border-ink text-ink' : 'text-ink-muted',
          )}
          aria-pressed={inWishlist}
        >
          <HeartIcon className="h-4 w-4" filled={inWishlist} />
          {inWishlist ? dict.wishlist.inWishlist : dict.product.addToWishlist}
        </button>
      </div>

      <div className="mt-6 space-y-3 border-t border-line pt-6">
        {madeToOrder ? (
          <p className="flex items-start gap-3 text-small text-ink-muted">
            <span className="mt-2 h-px w-5 shrink-0 bg-ink" />
            {dict.product.madeToOrderLead
              .replace('{min}', String(leadTimeMin))
              .replace('{max}', String(leadTimeMax))}
          </p>
        ) : (
          <p className="flex items-start gap-3 text-small text-ink-muted">
            <TruckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {dict.product.deliveryEstimate}
          </p>
        )}
        <p className="flex items-start gap-3 text-small text-ink-muted">
          <Link href={`/${locale}/pages/return-policy`} className="link-underline">
            {dict.footer.returnPolicy}
          </Link>
        </p>
      </div>
    </div>
  );
}
