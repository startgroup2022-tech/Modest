'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Price } from '@/components/ui/Price';
import { LockIcon, CheckIcon } from '@/components/ui/icons';
import type { QuickOrderProductView } from '@/lib/quick-order-db';
import type { Locale } from '@/i18n/config';
import type { Dict } from '@/i18n/dictionaries';
import {
  QuickOrderPieceConfig,
  emptyPiece,
  isPieceComplete,
  pieceToPayload,
  type CutView,
  type PieceState,
  type SavedProfileView,
} from '@/components/quick-order/QuickOrderPieceConfig';

type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'BENEFIT' | 'TAPP';

export interface QuickOrderShippingOption {
  code: string;
  name: string;
  priceBhd: number;
  etaMin: number;
  etaMax: number;
}

export interface QuickOrderMethodOption {
  method: PaymentMethod;
  label: string;
  description: string;
}

const COUNTRIES = ['Bahrain', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Oman'];
const MAX_QTY = 20;

/**
 * The customer-facing Quick Order landing form. It collects contact and
 * delivery details plus, for a cut product, one configuration per physical
 * piece. The product, its price and availability are resolved server-side from
 * the token, so nothing here can alter what the customer is charged.
 */
export function QuickOrderForm({
  locale,
  dict,
  product,
  shipping,
  methods,
  token,
  showMeasurementsNote,
  profiles,
}: {
  locale: Locale;
  dict: Dict;
  product: QuickOrderProductView;
  shipping: QuickOrderShippingOption[];
  methods: QuickOrderMethodOption[];
  token: string;
  showMeasurementsNote: boolean;
  profiles: SavedProfileView[];
}) {
  const router = useRouter();
  const t = dict.quickOrder;

  const cut = product.cut as CutView | null;
  const usesCut = Boolean(cut && cut.fields.length > 0 && cut.sizes.length > 0);

  const [quantity, setQuantity] = useState(1);
  const [pieces, setPieces] = useState<PieceState[]>([emptyPiece()]);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
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
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const idempotencyKey = useMemo(
    () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    [],
  );

  const requiresVariant = !usesCut && product.variants.length > 0;
  const selectedVariant = variantId ? product.variants.find((v) => v.id === variantId) ?? null : null;
  const variantUnitPrice = selectedVariant?.priceBhd ?? product.priceBhd;

  // Each READY piece prices at its own size-matched variant, so differently
  // sized pieces are summed correctly instead of multiplying one variant price.
  const piecePriceBhd = (piece: PieceState): number => {
    if (usesCut && piece.mode === 'READY' && piece.sizeCode) {
      const v = product.variants.find((x) => x.size === piece.sizeCode);
      return v?.priceBhd ?? product.priceBhd;
    }
    return product.priceBhd;
  };
  const subtotalBhd = usesCut
    ? pieces.reduce((sum, p) => sum + piecePriceBhd(p), 0)
    : variantUnitPrice * quantity;

  const method = shipping.find((s) => s.code === shippingCode) ?? shipping[0];
  const shippingBhd = method?.priceBhd ?? 0;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function changeQuantity(next: number) {
    const clamped = Math.max(1, Math.min(MAX_QTY, next));
    setQuantity(clamped);
    setPieces((prev) => {
      // Growing adds a fresh, unconfigured piece — never a silent copy.
      const copy = prev.slice(0, clamped);
      while (copy.length < clamped) copy.push(emptyPiece());
      return copy;
    });
    setCopiedIndex(null);
  }

  function setPiece(index: number, piece: PieceState) {
    setPieces((prev) => {
      const next = [...prev];
      next[index] = piece;
      return next;
    });
  }

  function copyPieceToOthers(index: number) {
    const source = pieces[index];
    setPieces((prev) => prev.map((p, i) => (i === index ? p : clonePiece(source))));
    setCopiedIndex(index);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (usesCut) {
      if (pieces.length !== quantity || pieces.some((p) => !isPieceComplete(p, cut as CutView))) {
        setError(t.pieceIncomplete);
        return;
      }
    } else if (requiresVariant && !variantId) {
      setError(dict.product.selectSize);
      return;
    }
    if (!acceptsTerms) {
      setError(dict.checkout.termsAgree);
      return;
    }
    // Final confirmation before an irreversible, one-per-link order.
    setConfirming(true);
  };

  const confirmOrder = async () => {
    setConfirming(false);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quick-order/${encodeURIComponent(token)}?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          ...form,
          variantId,
          quantity,
          pieces: usesCut ? pieces.map(pieceToPayload) : undefined,
          paymentMethod,
          shippingMethodCode: shippingCode,
          acceptsTerms: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        field?: string;
        orderNumber?: string;
        redirectUrl?: string | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error === 'USED' ? t.usedBody : data.error ?? dict.errors.generic);
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
        <label htmlFor={`qo-${key}`} className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {label}
          {opts.optional ? <span className="ms-1 text-ink-faint">({dict.common.optional})</span> : null}
        </label>
        {opts.textarea ? (
          <textarea id={`qo-${key}`} value={form[key]} onChange={set(key)} rows={3} className={clsx('field resize-none', hasError && 'border-danger')} />
        ) : (
          <input
            id={`qo-${key}`}
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
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16" noValidate>
      <div className="space-y-10">
        {/* Contact */}
        <section aria-labelledby="qo-contact">
          <h2 id="qo-contact" className="eyebrow mb-5">
            {dict.checkout.contact}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('fullName', dict.checkout.fullName, { required: true, autoComplete: 'name' })}</div>
            {field('phone', dict.checkout.phone, { required: true, type: 'tel', autoComplete: 'tel' })}
            {field('email', dict.checkout.email, { type: 'email', autoComplete: 'email', optional: true })}
          </div>
        </section>

        {/* Delivery */}
        <section aria-labelledby="qo-delivery">
          <h2 id="qo-delivery" className="eyebrow mb-5">
            {dict.checkout.delivery}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="qo-country" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.checkout.country}
              </label>
              <select id="qo-country" value={form.country} onChange={set('country')} className="field">
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
              <legend className="mb-3 text-caption uppercase tracking-[0.12em] text-ink-muted">{dict.cart.deliveryMethod}</legend>
              {fieldError === 'shippingMethodCode' ? (
                <p className="mb-3 text-small text-danger" role="alert">
                  {dict.checkout.invalidShipping}
                </p>
              ) : null}
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
                      <input type="radio" name="qo-shipping" value={s.code} checked={shippingCode === s.code} onChange={() => setShippingCode(s.code)} className="sr-only" />
                      <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full border', shippingCode === s.code ? 'border-ink' : 'border-line-strong')} aria-hidden="true">
                        {shippingCode === s.code ? <span className="h-2 w-2 rounded-full bg-ink" /> : null}
                      </span>
                      <span>
                        {s.name}
                        <span className="ms-2 text-caption text-ink-faint">
                          {s.etaMin}–{s.etaMax} {locale === 'ar' ? 'أيام' : 'days'}
                        </span>
                      </span>
                    </span>
                    <span className="tabular-nums">{s.priceBhd === 0 ? dict.cart.free : <Price amountBhd={s.priceBhd} locale={locale} />}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </section>

        {/* Payment */}
        <section aria-labelledby="qo-payment">
          <h2 id="qo-payment" className="eyebrow mb-5">
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
                <input type="radio" name="qo-payment" value={m.method} checked={paymentMethod === m.method} onChange={() => setPaymentMethod(m.method)} className="sr-only" />
                <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', paymentMethod === m.method ? 'border-ink' : 'border-line-strong')} aria-hidden="true">
                  {paymentMethod === m.method ? <span className="h-2 w-2 rounded-full bg-ink" /> : null}
                </span>
                <span>
                  <span className="block text-body">{m.label}</span>
                  <span className="mt-0.5 block text-caption text-ink-muted">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-6">{field('notes', dict.checkout.notes, { textarea: true, optional: true })}</div>
        </section>

        {error ? (
          <div role="alert" className="border border-danger/30 bg-danger/5 px-4 py-3 text-small text-danger">
            {error}
          </div>
        ) : null}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="border border-line">
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-sand-50">
            {product.images[0] ? (
              <Image src={product.images[0].url} alt={product.images[0].alt} fill sizes="(max-width: 1024px) 100vw, 380px" className="object-cover" />
            ) : null}
          </div>
          <div className="p-5">
            <p className="eyebrow text-ink-faint">{t.selectedFor}</p>
            <h2 className="mt-2 text-h4">{product.name}</h2>
            {product.subtitle ? <p className="mt-1 text-small text-ink-muted">{product.subtitle}</p> : null}
            <div className="mt-3 flex items-baseline gap-3">
              <Price amountBhd={usesCut ? product.priceBhd : variantUnitPrice} compareAtBhd={usesCut || selectedVariant ? null : product.compareAtBhd} locale={locale} className="text-body" />
            </div>
          </div>
        </div>

        {/* Quantity — one physical piece per unit */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{dict.product.quantity}</span>
            <div className="inline-flex items-center border border-line">
              <button type="button" aria-label={dict.common.decreaseQty} onClick={() => changeQuantity(quantity - 1)} className="px-3.5 py-2 text-ink-muted hover:text-ink">
                −
              </button>
              <span className="w-8 text-center text-small tabular-nums">{quantity}</span>
              <button type="button" aria-label={dict.common.increaseQty} onClick={() => changeQuantity(quantity + 1)} className="px-3.5 py-2 text-ink-muted hover:text-ink">
                +
              </button>
            </div>
          </div>
          {usesCut ? <p className="mt-2 text-caption text-ink-faint">{dict.product.perPieceMeasurements}</p> : null}
        </div>

        {usesCut && cut ? (
          <div className="mt-4 space-y-4">
            {pieces.map((piece, i) => (
              <QuickOrderPieceConfig
                key={i}
                index={i}
                total={quantity}
                piece={piece}
                cut={cut}
                locale={locale}
                profiles={profiles}
                sizeGuideHref={`/${locale}/size-guide`}
                onChange={(next) => setPiece(i, next)}
                onCopyToOthers={quantity > 1 ? () => copyPieceToOthers(i) : null}
                dict={{
                  piece: t.piece,
                  pieces: t.pieces,
                  size: dict.product.size,
                  sizeGuide: dict.nav.sizeGuide,
                  customMeasurements: dict.product.customMeasurements,
                  readySize: dict.product.readySize,
                  copyMeasurements: t.copyMeasurements,
                  savedProfile: t.savedProfile,
                  useSavedProfile: t.useSavedProfile,
                  chooseProfile: t.chooseProfile,
                }}
              />
            ))}
            {copiedIndex !== null ? (
              <p role="status" className="text-caption text-ink-muted">
                {t.copied}
              </p>
            ) : null}
          </div>
        ) : requiresVariant ? (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{dict.product.size}</span>
              <Link href={`/${locale}/size-guide`} className="link-underline text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.nav.sizeGuide}
              </Link>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const isActive = v.id === variantId;
                const disabled = v.stockStatus === 'OUT_OF_STOCK';
                const color = locale === 'ar' ? v.colorAr : v.colorEn;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setVariantId(v.id);
                        setError(null);
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

        {showMeasurementsNote ? <p className="mt-5 text-caption text-ink-muted">{t.measurementsNote}</p> : null}

        <dl className="mt-6 space-y-3 border-t border-line pt-5 text-small">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.cart.subtotal}</dt>
            <dd className="tabular-nums">
              <Price amountBhd={subtotalBhd} locale={locale} />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.cart.shipping}</dt>
            <dd className="tabular-nums">{shippingBhd === 0 ? dict.cart.free : <Price amountBhd={shippingBhd} locale={locale} />}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-h4">
            <dt>{dict.cart.total}</dt>
            <dd className="tabular-nums">
              <Price amountBhd={subtotalBhd + shippingBhd} locale={locale} />
            </dd>
          </div>
        </dl>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-small text-ink-muted">
          <input type="checkbox" checked={acceptsTerms} onChange={(e) => setAcceptsTerms(e.target.checked)} className="peer sr-only" />
          <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors', acceptsTerms ? 'border-ink bg-ink' : 'border-line-strong')} aria-hidden="true">
            {acceptsTerms ? <CheckIcon className="h-3 w-3 text-paper" /> : null}
          </span>
          <span>{dict.checkout.termsAgree}</span>
        </label>

        <button type="submit" disabled={submitting} className="btn-primary btn-block mt-6">
          {submitting ? dict.checkout.processing : t.placeOrder}
        </button>

        <p className="mt-4 flex items-center justify-center gap-2 text-caption text-ink-faint">
          <LockIcon className="h-3.5 w-3.5" />
          {t.secureNote}
        </p>
        <p className="mt-2 text-center text-caption text-ink-faint">{t.payNote}</p>
      </aside>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qo-confirm-title"
          onClick={() => setConfirming(false)}
        >
          <div className="w-full max-w-md border border-line bg-paper p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 id="qo-confirm-title" className="text-h4">
              {t.confirmTitle}
            </h2>
            <p className="mt-2 text-small text-ink-muted">{t.confirmBody}</p>
            <dl className="mt-5 space-y-2 border-y border-line py-4 text-small">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{product.name}</dt>
                <dd className="tabular-nums">{quantity}</dd>
              </div>
              <div className="flex items-center justify-between text-h4">
                <dt>{dict.cart.total}</dt>
                <dd className="tabular-nums">
                  <Price amountBhd={subtotalBhd + shippingBhd} locale={locale} />
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setConfirming(false)} className="btn-quiet flex-1">
                {dict.common.back}
              </button>
              <button type="button" onClick={confirmOrder} className="btn-primary flex-1">
                {t.confirmAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

/** Independent copy so an explicit copy never shares mutable state with its source. */
function clonePiece(piece: PieceState): PieceState {
  if (piece.mode === 'READY') return { mode: 'READY', sizeCode: piece.sizeCode };
  return { mode: 'CUSTOM', values: { ...piece.values }, profileId: piece.profileId };
}
