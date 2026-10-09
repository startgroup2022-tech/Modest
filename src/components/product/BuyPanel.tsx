'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import type { CartPieceInput } from '@/components/providers/StoreProvider';
import { HeartIcon, RulerIcon, TruckIcon, ArrowRight } from '@/components/ui/icons';
import { MeasurementSelector, type CutView } from '@/components/product/MeasurementSelector';
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
  cut,
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
  cut?: CutView | null;
  dict: Dict;
  locale: Locale;
  sizeGuideHref: string;
}) {
  const { addItem, toggleWishlist, wishlist, busy, setCartOpen, setFlash } = useStore();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'add' | 'buy' | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pieces, setPieces] = useState<(CartPieceInput | null)[]>([null]);

  const inWishlist = wishlist.includes(productId);
  const usesCut = Boolean(cut && cut.fields.length > 0 && cut.sizes.length > 0);
  const requiresSize = !usesCut && variants.length > 0;
  const active = useMemo(() => variants.find((v) => v.id === selected) ?? null, [variants, selected]);
  const soldOut = active ? active.stockStatus === 'OUT_OF_STOCK' : false;
  const lowStock = active ? active.stockStatus === 'LOW_STOCK' || (active.stock > 0 && active.stock <= 3) : false;

  const resolveVariantId = () => {
    if (!requiresSize) return null;
    return selected;
  };

  function changeQuantity(next: number) {
    const clamped = Math.max(1, Math.min(5, next));
    setQuantity(clamped);
    setPieces((prev) => {
      const copy = prev.slice(0, clamped);
      while (copy.length < clamped) copy.push(prev[prev.length - 1] ?? null);
      return copy;
    });
  }

  function setPiece(index: number, piece: CartPieceInput | null) {
    setPieces((prev) => {
      const next = [...prev];
      next[index] = piece;
      return next;
    });
  }

  const submit = async (mode: 'add' | 'buy') => {
    setLocalError(null);
    if (usesCut) {
      if (pieces.length !== quantity || pieces.some((p) => p === null)) {
        setLocalError(dict.product.measurementsRequired);
        return;
      }
      setSubmitting(mode);
      try {
        await addItem(productId, null, quantity, pieces as CartPieceInput[]);
        if (mode === 'buy') router.push(`/${locale}/checkout`);
        else setFlash(dict.cart.added);
      } catch {
        setLocalError(dict.errors.generic);
      } finally {
        setSubmitting(null);
      }
      return;
    }

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
      {usesCut && cut ? (
        <>
          <div className="flex items-center justify-between">
            <span className="eyebrow">{dict.product.quantity}</span>
            <div className="inline-flex items-center border border-line">
              <button
                type="button"
                aria-label={dict.common.decreaseQty}
                onClick={() => changeQuantity(quantity - 1)}
                className="px-3.5 py-2 text-ink-muted hover:text-ink"
              >
                −
              </button>
              <span className="w-8 text-center text-small tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label={dict.common.increaseQty}
                onClick={() => changeQuantity(quantity + 1)}
                className="px-3.5 py-2 text-ink-muted hover:text-ink"
              >
                +
              </button>
            </div>
          </div>
          <p className="mt-2 text-caption text-ink-faint">{dict.product.perPieceMeasurements}</p>
          <div className="mt-4 space-y-6">
            {Array.from({ length: quantity }).map((_, i) => (
              <div key={i} className="border border-line p-4">
                <p className="eyebrow mb-1">
                  {dict.product.perPieceMeasurements} {i + 1} / {quantity}
                </p>
                <MeasurementSelector
                  cut={cut}
                  locale={locale}
                  sizeGuideHref={sizeGuideHref}
                  onChange={(piece) => setPiece(i, piece)}
                  dict={{
                    size: dict.product.size,
                    sizeGuide: dict.nav.sizeGuide,
                    customMeasurements: dict.product.customMeasurements,
                    readySize: dict.product.readySize,
                    required: dict.product.measurementsRequired,
                  }}
                />
              </div>
            ))}
          </div>
        </>
      ) : requiresSize ? (
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
