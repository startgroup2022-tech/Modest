'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import { Price } from '@/components/ui/Price';
import { EmptyState } from '@/components/ui/EmptyState';
import { BagIcon, CloseIcon, TrashIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function CartDrawer({ locale, dict }: { locale: Locale; dict: Dict }) {
  const { cart, cartOpen, setCartOpen, updateItem, removeItem, busy } = useStore();
  const p = (path: string) => `/${locale}${path ? `/${path.replace(/^\//, '')}` : ''}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCartOpen]);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [cartOpen]);

  return (
    <div
      className={clsx('fixed inset-0 z-[70]', cartOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden={!cartOpen}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-ink/40 transition-opacity duration-300',
          cartOpen ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => setCartOpen(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={dict.cart.title}
        className={clsx(
          'absolute inset-y-0 end-0 flex w-full max-w-[26rem] flex-col bg-paper transition-transform duration-400 ease-luxe',
          cartOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-h4 uppercase tracking-[0.12em]">
            {dict.cart.title} {cart.count > 0 ? <span className="text-ink-muted">({cart.count})</span> : null}
          </h2>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label={dict.util.close}
            className="flex h-9 w-9 items-center justify-center"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        {cart.items.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={<BagIcon className="h-8 w-8" />}
            title={dict.cart.empty}
            body={dict.cart.emptyBody}
            actionLabel={dict.cart.startShopping}
            actionHref={p('shop')}
          />
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-5">
              {cart.items.map((line) => (
                <li key={line.id} className="flex gap-4 border-b border-line py-5 last:border-0">
                  <Link
                    href={p(`product/${line.slug}`)}
                    onClick={() => setCartOpen(false)}
                    className="relative h-28 w-21 shrink-0 overflow-hidden bg-sand-50"
                    style={{ width: '5.25rem' }}
                  >
                    {line.image ? (
                      <Image
                        src={line.image}
                        alt={locale === 'ar' ? line.nameAr : line.nameEn}
                        fill
                        sizes="84px"
                        className="object-cover"
                      />
                    ) : null}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={p(`product/${line.slug}`)}
                        onClick={() => setCartOpen(false)}
                        className="text-small text-ink"
                      >
                        {locale === 'ar' ? line.nameAr : line.nameEn}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void removeItem(line.id)}
                        aria-label={dict.cart.remove}
                        className="text-ink-faint transition-colors hover:text-ink"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {line.size ? (
                      <p className="mt-1 text-caption text-ink-muted">
                        {dict.product.size}: {line.size}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center border border-line">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void updateItem(line.id, line.quantity - 1)}
                          aria-label={dict.cart.updateQty}
                          className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-small tabular-nums">{line.quantity}</span>
                        <button
                          type="button"
                          disabled={busy || line.quantity >= 20}
                          onClick={() => void updateItem(line.id, line.quantity + 1)}
                          aria-label={dict.cart.updateQty}
                          className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <Price amountBhd={line.lineTotalBhd} locale={locale} className="text-price" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-line px-5 py-5 safe-bottom">
              <div className="flex items-center justify-between text-body">
                <span className="uppercase tracking-[0.1em] text-ink-muted">{dict.cart.subtotal}</span>
                <Price amountBhd={cart.subtotalBhd} locale={locale} className="text-h4" />
              </div>
              <p className="mt-1.5 text-caption text-ink-faint">{dict.cart.shipping} — {dict.cart.estimatedDelivery}</p>
              <Link
                href={p('checkout')}
                onClick={() => setCartOpen(false)}
                className="btn-primary btn-block mt-4"
              >
                {busy ? <Spinner /> : null}
                {dict.cart.checkout}
              </Link>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="mt-3 w-full text-center text-caption uppercase tracking-[0.14em] text-ink-muted underline underline-offset-4"
              >
                {dict.cart.continueShopping}
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
