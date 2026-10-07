'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import { Price } from '@/components/ui/Price';
import { LockIcon, CheckIcon } from '@/components/ui/icons';
import { LineMeasurements } from '@/components/cart/LineMeasurements';
import { formatMoney, roundBhd } from '@/lib/utils';
import type { CartLineView } from '@/lib/cart';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'BENEFIT' | 'TAPP';

interface ShippingOption {
  code: string;
  name: string;
  priceBhd: number;
  etaMin: number;
  etaMax: number;
}

interface MethodOption {
  method: PaymentMethod;
  label: string;
  description: string;
}

const COUNTRIES = ['Bahrain', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Oman'];

export function CheckoutForm({
  locale,
  dict,
  signedIn,
  profile,
  cart,
  shipping,
  methods,
  store,
  settings,
}: {
  locale: Locale;
  dict: Dict;
  signedIn: boolean;
  profile: { firstName: string; lastName: string; phone: string | null } | null;
  cart: { id: string | null; items: CartLineView[]; count: number; subtotalBhd: number };
  shipping: ShippingOption[];
  methods: MethodOption[];
  store: { name: string; email: string; phone: string; city: string; country: string };
  settings: { enableCoupons: boolean; enableOrderNotes: boolean; allowGuestCheckout: boolean };
}) {
  const router = useRouter();
  const { currencyMeta } = useStore();

  const [form, setForm] = useState({
    fullName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '',
    email: '',
    phone: profile?.phone ?? '',
    country: 'Bahrain',
    city: '',
    area: '',
    address: '',
    building: '',
    unit: '',
    notes: '',
  });
  const [shippingCode, setShippingCode] = useState(shipping[0]?.code ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(methods[0]?.method ?? 'COD');
  const [coupon, setCoupon] = useState('');
  const [couponState, setCouponState] = useState<{ status: 'idle' | 'applied' | 'invalid' | 'min'; discountBhd: number; freeShipping: boolean }>(
    { status: 'idle', discountBhd: 0, freeShipping: false },
  );
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const idempotencyKey = useMemo(
    () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    [],
  );

  const method = shipping.find((s) => s.code === shippingCode) ?? shipping[0];
  const freeShip = couponState.status === 'applied' && couponState.freeShipping;
  const discountBhd = couponState.status === 'applied' ? couponState.discountBhd : 0;
  const shippingBhd = freeShip ? 0 : (method?.priceBhd ?? 0);
  const totalBhd = roundBhd(Math.max(0, cart.subtotalBhd - discountBhd + shippingBhd));

  const money = (bhd: number) =>
    formatMoney(bhd * currencyMeta.rateToBhd, {
      code: currencyMeta.code,
      symbol: currencyMeta.symbol,
      decimals: currencyMeta.decimals,
      symbolPosition: currencyMeta.symbolPosition,
      locale,
    });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const res = await fetch('/api/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; discountBhd?: number; freeShipping?: boolean };
      if (data.ok) {
        setCouponState({ status: 'applied', discountBhd: data.discountBhd ?? 0, freeShipping: Boolean(data.freeShipping) });
      } else {
        setCouponState({ status: data.error === 'couponMinOrder' ? 'min' : 'invalid', discountBhd: 0, freeShipping: false });
      }
    } catch {
      setCouponState({ status: 'invalid', discountBhd: 0, freeShipping: false });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (!acceptsTerms) {
      setError(dict.checkout.termsAgree);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/checkout?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          ...form,
          paymentMethod,
          shippingMethodCode: shippingCode,
          couponCode: couponState.status === 'applied' ? coupon : '',
          acceptsTerms: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        field?: string;
        orderId?: string;
        orderNumber?: string;
        redirectUrl?: string | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? dict.errors.generic);
        setFieldError(data.field ?? null);
        setSubmitting(false);
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(`/${locale}/checkout/success?order=${encodeURIComponent(data.orderNumber ?? '')}`);
    } catch {
      setError(dict.errors.network);
      setSubmitting(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    opts: { required?: boolean; type?: string; autoComplete?: string; textarea?: boolean; optional?: boolean } = {},
  ) => {
    const hasError = fieldError === key;
    return (
      <div>
        <label htmlFor={`co-${key}`} className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {label}
          {opts.optional ? <span className="ms-1 text-ink-faint">({dict.common.optional})</span> : null}
        </label>
        {opts.textarea ? (
          <textarea
            id={`co-${key}`}
            value={form[key]}
            onChange={set(key)}
            rows={3}
            className={clsx('field resize-none', hasError && 'border-danger')}
          />
        ) : (
          <input
            id={`co-${key}`}
            type={opts.type ?? 'text'}
            value={form[key]}
            onChange={set(key)}
            required={opts.required}
            autoComplete={opts.autoComplete}
            aria-invalid={hasError}
            className={clsx('field', hasError && 'border-danger')}
          />
        )}
      </div>
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16" noValidate>
      <div className="space-y-10">
        {!signedIn && settings.allowGuestCheckout ? (
          <p className="border border-line bg-paper-warm px-5 py-4 text-small text-ink-muted">
            {dict.checkout.guestCheckout} ·{' '}
            <Link href={`/${locale}/account/sign-in`} className="link-underline text-ink">
              {dict.account.signIn}
            </Link>
          </p>
        ) : null}

        {/* Contact */}
        <section aria-labelledby="co-contact">
          <h2 id="co-contact" className="eyebrow mb-5">
            {dict.checkout.contact}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('fullName', dict.checkout.fullName, { required: true, autoComplete: 'name' })}</div>
            {field('email', dict.checkout.email, { required: true, type: 'email', autoComplete: 'email' })}
            {field('phone', dict.checkout.phone, { required: true, type: 'tel', autoComplete: 'tel' })}
          </div>
        </section>

        {/* Delivery */}
        <section aria-labelledby="co-delivery">
          <h2 id="co-delivery" className="eyebrow mb-5">
            {dict.checkout.delivery}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="co-country" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.checkout.country}
              </label>
              <select id="co-country" value={form.country} onChange={set('country')} className="field">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {field('city', dict.checkout.city, { required: true, autoComplete: 'address-level2' })}
            {field('area', dict.checkout.area, { optional: true, autoComplete: 'address-level3' })}
            <div className="sm:col-span-2">{field('address', dict.checkout.address, { required: true, autoComplete: 'street-address' })}</div>
            {field('building', dict.checkout.building, { optional: true })}
            {field('unit', dict.checkout.unit, { optional: true })}
          </div>

          {shipping.length ? (
            <fieldset className="mt-6">
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
        </section>

        {/* Payment */}
        <section aria-labelledby="co-payment">
          <h2 id="co-payment" className="eyebrow mb-5">
            {dict.checkout.payment}
          </h2>
          <div className="space-y-2">
            {methods.map((m) => (
              <label
                key={m.method}
                className={clsx(
                  'flex cursor-pointer items-start gap-3 border px-4 py-4 transition-colors',
                  paymentMethod === m.method ? 'border-ink' : 'border-line hover:border-line-strong',
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.method}
                  checked={paymentMethod === m.method}
                  onChange={() => setPaymentMethod(m.method)}
                  className="sr-only"
                />
                <span
                  className={clsx(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    paymentMethod === m.method ? 'border-ink' : 'border-line-strong',
                  )}
                  aria-hidden="true"
                >
                  {paymentMethod === m.method ? <span className="h-2 w-2 rounded-full bg-ink" /> : null}
                </span>
                <span>
                  <span className="block text-body">{m.label}</span>
                  <span className="mt-0.5 block text-caption text-ink-muted">{m.description}</span>
                </span>
              </label>
            ))}
          </div>

          {settings.enableOrderNotes ? (
            <div className="mt-6">{field('notes', dict.checkout.notes, { textarea: true, optional: true })}</div>
          ) : null}
        </section>

        {error ? (
          <div role="alert" className="border border-danger/30 bg-danger/5 px-4 py-3 text-small text-danger">
            <p>{error}</p>
            {fieldError === 'cart' ? (
              <Link href={`/${locale}/cart`} className="mt-2 inline-block underline underline-offset-4">
                {dict.util.cart}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="eyebrow mb-5">{dict.checkout.orderSummary}</h2>

        <ul className="mb-6 space-y-4 border-b border-line pb-6">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-sand-50">
                {item.image ? <Image src={item.image} alt="" fill sizes="64px" className="object-cover" /> : null}
                <span className="absolute end-0 top-0 bg-ink px-1.5 text-caption text-paper">{item.quantity}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small">{locale === 'ar' ? item.nameAr : item.nameEn}</p>
                {item.size ? <p className="text-caption text-ink-faint">{item.size}</p> : null}
                <LineMeasurements
                  pieces={item.pieces}
                  needsMeasurements={item.needsMeasurements}
                  locale={locale}
                  labels={{ measurements: dict.product.perPieceMeasurements, required: dict.product.measurementsRequired }}
                />
              </div>
              <Price amountBhd={item.lineTotalBhd} locale={locale} className="text-small" />
            </li>
          ))}
        </ul>

        {settings.enableCoupons ? (
          <div className="mb-6">
            <label htmlFor="co-coupon" className="mb-3 block text-caption uppercase tracking-[0.12em] text-ink-muted">
              {dict.cart.coupon}
            </label>
            <div className="flex gap-2">
              <input
                id="co-coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder={dict.cart.couponPlaceholder}
                className="field"
                autoComplete="off"
              />
              <button type="button" onClick={applyCoupon} className="btn-quiet shrink-0 px-5">
                {dict.cart.apply}
              </button>
            </div>
            {couponState.status !== 'idle' ? (
              <p aria-live="polite" className={clsx('mt-2 text-caption', couponState.status === 'applied' ? 'text-success' : 'text-danger')}>
                {couponState.status === 'applied'
                  ? dict.cart.couponApplied
                  : couponState.status === 'min'
                    ? dict.cart.couponMinOrder
                    : dict.cart.couponInvalid}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="space-y-3 border-t border-line pt-5 text-small">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.cart.subtotal}</dt>
            <dd className="tabular-nums">{money(cart.subtotalBhd)}</dd>
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

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-small text-ink-muted">
          <input
            type="checkbox"
            checked={acceptsTerms}
            onChange={(e) => setAcceptsTerms(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={clsx(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
              acceptsTerms ? 'border-ink bg-ink' : 'border-line-strong',
            )}
            aria-hidden="true"
          >
            {acceptsTerms ? <CheckIcon className="h-3 w-3 text-paper" /> : null}
          </span>
          <span>{dict.checkout.termsAgree}</span>
        </label>

        <button type="submit" disabled={submitting} className="btn-primary btn-block mt-6">
          {submitting ? dict.checkout.processing : paymentMethod === 'TAPP' ? dict.checkout.payNow : dict.checkout.placeOrder}
        </button>

        <p className="mt-4 flex items-center justify-center gap-2 text-caption text-ink-faint">
          <LockIcon className="h-3.5 w-3.5" />
          {locale === 'ar' ? 'دفع آمن ومشفّر' : 'Secure, encrypted checkout'}
        </p>
        <p className="mt-2 text-center text-caption text-ink-faint">
          {store.name} · {store.city}, {store.country}
        </p>
      </aside>
    </form>
  );
}
