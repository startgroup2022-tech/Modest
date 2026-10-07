'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import { Price } from '@/components/ui/Price';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrashIcon } from '@/components/ui/icons';
import { LineMeasurements } from '@/components/cart/LineMeasurements';
import { formatMoney, roundBhd } from '@/lib/utils';
import type { CartLineView } from '@/lib/cart';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

interface ShippingOption {
  code: string;
  name: string;
  priceBhd: number;
  etaMin: number;
  etaMax: number;
}

export function CartView({
  locale,
  dict,
  initialCart,
  shipping,
}: {
  locale: Locale;
  dict: Dict;
  initialCart: { id: string | null; items: CartLineView[]; count: number; subtotalBhd: number };
  shipping: ShippingOption[];
}) {
  const { cart, updateItem, removeItem, busy, refreshCart, currencyMeta } = useStore();
  const [shippingCode, setShippingCode] = useState(shipping[0]?.code ?? '');
  const [coupon, setCoupon] = useState('');
  const [couponState, setCouponState] = useState<{ status: 'idle' | 'applied' | 'invalid' | 'min'; discountBhd: number; freeShipping: boolean; reason?: 'couponMinOrder' | 'couponUsed' | 'couponMembership' | 'couponInvalid' }>(
    { status: 'idle', discountBhd: 0, freeShipping: false },
  );
  const [applying, setApplying] = useState(false);

  // Keep server-rendered cart in sync on first paint.
  useEffect(() => {
    if (!cart.items.length && initialCart.items.length) void refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = cart.items.length || initialCart.items.length ? (cart.items.length ? cart.items : initialCart.items) : [];
  const subtotalBhd = cart.items.length ? cart.subtotalBhd : initialCart.subtotalBhd;

  const method = shipping.find((s) => s.code === shippingCode) ?? shipping[0];
  const freeShip = couponState.status === 'applied' && couponState.freeShipping;
  const discountBhd = couponState.status === 'applied' ? couponState.discountBhd : 0;
  const shippingBhd = freeShip ? 0 : (method?.priceBhd ?? 0);
  const totalBhd = roundBhd(Math.max(0, subtotalBhd - discountBhd + shippingBhd));

  const money = (bhd: number) =>
    formatMoney(bhd * currencyMeta.rateToBhd, {
      code: currencyMeta.code,
      symbol: currencyMeta.symbol,
      decimals: currencyMeta.decimals,
      symbolPosition: currencyMeta.symbolPosition,
      locale,
    });

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setApplying(true);
    try {
      const res = await fetch('/api/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        discountBhd?: number;
        freeShipping?: boolean;
      };
      if (data.ok) {
        setCouponState({ status: 'applied', discountBhd: data.discountBhd ?? 0, freeShipping: Boolean(data.freeShipping) });
      } else {
        const reason =
          data.error === 'couponMinOrder'
            ? 'couponMinOrder'
            : data.error === 'couponUsed'
              ? 'couponUsed'
              : data.error === 'couponMembership'
                ? 'couponMembership'
                : 'couponInvalid';
        setCouponState({
          status: reason === 'couponMinOrder' ? 'min' : 'invalid',
          discountBhd: 0,
          freeShipping: false,
          reason,
        });
      }
    } catch {
      setCouponState({ status: 'invalid', discountBhd: 0, freeShipping: false });
    } finally {
      setApplying(false);
    }
  };

  if (!items.length) {
    return (
      <EmptyState
        title={dict.cart.empty}
        body={dict.cart.emptyBody}
        actionLabel={dict.cart.startShopping}
        actionHref={`/${locale}/shop`}
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16">
      {/* Items */}
      <ul className="divide-y divide-line border-t border-line">
        {items.map((item) => {
          const name = locale === 'ar' ? item.nameAr : item.nameEn;
          const href = `/${locale}/product/${item.slug}`;
          return (
            <li key={item.id} className="flex gap-5 py-6">
              <Link href={href} className="relative h-32 w-24 shrink-0 overflow-hidden bg-sand-50">
                {item.image ? (
                  <Image src={item.image} alt={name} fill sizes="96px" className="object-cover" />
                ) : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={href} className="link-underline block truncate text-body">
                      {name}
                    </Link>
                    {item.size ? (
                      <p className="mt-1 text-caption uppercase tracking-[0.1em] text-ink-muted">
                        {dict.product.size}: {item.size}
                      </p>
                    ) : null}
                    <LineMeasurements
                      pieces={item.pieces}
                      needsMeasurements={item.needsMeasurements}
                      locale={locale}
                      labels={{ measurements: dict.product.perPieceMeasurements, required: dict.product.measurementsRequired }}
                    />
                    {!item.available ? (
                      <p className="mt-1 text-caption text-danger">{dict.common.unavailable}</p>
                    ) : null}
                  </div>
                  <Price amountBhd={item.lineTotalBhd} locale={locale} />
                </div>

                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="flex items-center border border-line">
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                      disabled={busy || item.quantity <= 1}
                      aria-label={dict.cart.updateQty}
                      className="flex h-10 w-10 items-center justify-center text-lg disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-small tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, item.quantity + 1)}
                      disabled={busy || item.quantity >= 20}
                      aria-label={dict.cart.updateQty}
                      className="flex h-10 w-10 items-center justify-center text-lg disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 text-caption uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                    {dict.cart.remove}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="eyebrow mb-5">{dict.cart.orderSummary}</h2>

        {/* Delivery method */}
        {shipping.length ? (
          <fieldset className="mb-6">
            <legend className="mb-3 text-caption uppercase tracking-[0.12em] text-ink-muted">
              {dict.cart.deliveryMethod}
            </legend>
            <div className="space-y-2">
              {shipping.map((s) => (
                <label
                  key={s.code}
                  className={clsx(
                    'flex cursor-pointer items-center justify-between border px-4 py-3 text-small transition-colors',
                    shippingCode === s.code ? 'border-ink' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      value={s.code}
                      checked={shippingCode === s.code}
                      onChange={() => setShippingCode(s.code)}
                      className="sr-only"
                    />
                    <span
                      className={clsx(
                        'flex h-4 w-4 items-center justify-center rounded-full border',
                        shippingCode === s.code ? 'border-ink' : 'border-line-strong',
                      )}
                      aria-hidden="true"
                    >
                      {shippingCode === s.code ? <span className="h-2 w-2 rounded-full bg-ink" /> : null}
                    </span>
                    <span>
                      {s.name}
                      <span className="ms-2 text-caption text-ink-faint">
                        {s.etaMin}–{s.etaMax} {locale === 'ar' ? 'أيام' : 'days'}
                      </span>
                    </span>
                  </span>
                  <span className="tabular-nums">{s.priceBhd === 0 ? dict.cart.free : money(s.priceBhd)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {/* Coupon */}
        <div className="mb-6">
          <label htmlFor="cart-coupon" className="mb-3 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.cart.coupon}
          </label>
          <div className="flex gap-2">
            <input
              id="cart-coupon"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder={dict.cart.couponPlaceholder}
              className="field"
              autoComplete="off"
            />
            <button type="button" onClick={applyCoupon} disabled={applying} className="btn-quiet shrink-0 px-5">
              {applying ? dict.common.loading : dict.cart.apply}
            </button>
          </div>
          <p
            aria-live="polite"
            className={clsx(
              'mt-2 text-caption',
              couponState.status === 'applied' ? 'text-success' : couponState.status === 'idle' ? 'text-transparent' : 'text-danger',
            )}
          >
            {couponState.status === 'applied'
              ? dict.cart.couponApplied
              : couponState.status === 'min'
                ? dict.cart.couponMinOrder
                : couponState.status === 'invalid'
                  ? couponState.reason === 'couponUsed'
                    ? dict.cart.couponUsed
                    : couponState.reason === 'couponMembership'
                      ? dict.cart.couponMembership
                      : dict.cart.couponInvalid
                  : '·'}
          </p>
        </div>

        {/* Totals */}
        <dl className="space-y-3 border-t border-line pt-5 text-small">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.cart.subtotal}</dt>
            <dd className="tabular-nums">{money(subtotalBhd)}</dd>
          </div>
          {discountBhd > 0 ? (
            <div className="flex items-center justify-between text-success">
              <dt>{dict.cart.discount}</dt>
              <dd className="tabular-nums">− {money(discountBhd)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.cart.shipping}</dt>
            <dd className="tabular-nums">{shippingBhd === 0 ? dict.cart.free : money(shippingBhd)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-h4">
            <dt>{dict.cart.total}</dt>
            <dd className="tabular-nums">{money(totalBhd)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-caption text-ink-faint">{dict.cart.taxIncluded} · {dict.cart.checkoutNote}</p>

        <Link href={`/${locale}/checkout`} className="btn-primary btn-block mt-6">
          {dict.cart.checkout}
        </Link>
        <Link href={`/${locale}/shop`} className="btn-quiet btn-block mt-3">
          {dict.cart.continueShopping}
        </Link>
      </aside>
    </div>
  );
}
