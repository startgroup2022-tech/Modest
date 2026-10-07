'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  priceBhd: number;
  variants: { id: string; label: string; priceBhd: number | null; stock: number; stockStatus: string }[];
}

interface Line {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  priceBhd: number;
  quantity: number;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export function QuickOrderForm({
  locale,
  dict,
  products,
  customers,
  shippingOptions,
  methods,
  currency,
}: {
  locale: 'en' | 'ar';
  dict: {
    quickOrders: Record<string, string>;
    common: Record<string, string>;
    orders: Record<string, string>;
  };
  products: ProductOption[];
  customers: CustomerOption[];
  shippingOptions: { code: string; label: string; priceBhd: number }[];
  methods: { value: string; label: string }[];
  currency: string;
}) {
  const router = useRouter();
  const q = dict.quickOrders;

  const [customerId, setCustomerId] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [guest, setGuest] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [lines, setLines] = useState<Line[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [shippingCode, setShippingCode] = useState(shippingOptions[0]?.code ?? '');
  const [method, setMethod] = useState(methods[0]?.value ?? 'CASH_ON_DELIVERY');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per form session: a double submit replays the first order instead
  // of creating a duplicate. It is regenerated only after a successful create.
  const idempotencyKey = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  );

  const filteredCustomers = useMemo(() => {
    const s = customerQuery.trim().toLowerCase();
    if (!s) return customers.slice(0, 8);
    return customers
      .filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(s))
      .slice(0, 8);
  }, [customerQuery, customers]);

  const filteredProducts = useMemo(() => {
    const s = productQuery.trim().toLowerCase();
    if (!s) return products.slice(0, 10);
    return products.filter((p) => `${p.name} ${p.sku ?? ''}`.toLowerCase().includes(s)).slice(0, 10);
  }, [productQuery, products]);

  function addLine(product: ProductOption, variantId: string | null) {
    const variant = product.variants.find((v) => v.id === variantId) ?? null;
    // A variant may override the product price; quote the price the server will
    // actually charge rather than the base price.
    const priceBhd = variant?.priceBhd ?? product.priceBhd;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id && l.variantId === variantId);
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key: `${product.id}:${variantId ?? 'base'}:${Date.now()}`,
          productId: product.id,
          variantId,
          name: product.name,
          variantLabel: variant?.label ?? null,
          priceBhd,
          quantity: 1,
        },
      ];
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.priceBhd * l.quantity, 0);
  const discountValue = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const shipping = shippingOptions.find((s) => s.code === shippingCode)?.priceBhd ?? 0;
  const total = Math.max(0, subtotal - discountValue + shipping);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError(locale === 'ar' ? 'أضف عنصراً واحداً على الأقل' : 'Add at least one item');
      return;
    }
    if (!customerId && (!guest.firstName || !guest.phone)) {
      setError(locale === 'ar' ? 'اختر عميلاً أو أدخل الاسم والهاتف' : 'Select a customer or enter name and phone');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/orders/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || null,
          guest: customerId ? null : guest,
          items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
          shippingMethodCode: shippingCode,
          paymentMethod: method,
          manualDiscountBhd: discountValue || 0,
          notes: notes || undefined,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed');
        setBusy(false);
        return;
      }
      router.push(`/${locale}/admin/orders/${data.id}`);
    } catch {
      setError('Network error');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Customer */}
        <section className="adm-card p-5">
          <h2 className="adm-title mb-4">{q.selectCustomer}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="adm-kpi-label">{q.searchCustomer}</span>
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className="adm-input mt-1"
                placeholder={q.searchCustomer}
              />
            </label>
            <div className="sm:col-span-2">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="adm-select"
                aria-label={q.selectCustomer}
              >
                <option value="">{q.newCustomer}</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.email || c.phone}
                  </option>
                ))}
              </select>
            </div>
            {!customerId && (
              <>
                <input
                  value={guest.firstName}
                  onChange={(e) => setGuest({ ...guest, firstName: e.target.value })}
                  placeholder={locale === 'ar' ? 'الاسم الأول' : 'First name'}
                  className="adm-input"
                />
                <input
                  value={guest.lastName}
                  onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
                  placeholder={locale === 'ar' ? 'اسم العائلة' : 'Last name'}
                  className="adm-input"
                />
                <input
                  value={guest.phone}
                  onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                  placeholder={locale === 'ar' ? 'الهاتف' : 'Phone'}
                  className="adm-input"
                />
                <input
                  type="email"
                  value={guest.email}
                  onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                  placeholder={locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  className="adm-input"
                />
              </>
            )}
          </div>
        </section>

        {/* Items */}
        <section className="adm-card p-5">
          <h2 className="adm-title mb-4">{q.addItems}</h2>
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder={q.selectProduct}
            className="adm-input mb-3"
          />
          <div className="adm-scroll max-h-56 overflow-y-auto border border-line">
            {filteredProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-0">
                <span className="min-w-0">
                  <span className="block truncate text-small text-ink">{p.name}</span>
                  <span className="block text-caption text-ink-faint">{p.sku ?? '—'} · {p.priceBhd.toFixed(3)} {currency}</span>
                </span>
                {p.variants.length > 0 ? (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addLine(p, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="adm-select w-auto text-caption"
                    defaultValue=""
                    aria-label={q.selectVariant}
                  >
                    <option value="">{q.selectVariant}</option>
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.stockStatus === 'OUT_OF_STOCK'}>
                        {v.label} ({v.stock})
                      </option>
                    ))}
                  </select>
                ) : (
                  <button type="button" onClick={() => addLine(p, null)} className="adm-btn-outline adm-btn-sm">
                    + {q.addItem}
                  </button>
                )}
              </div>
            ))}
          </div>

          {lines.length > 0 && (
            <table className="adm-table mt-4">
              <thead>
                <tr>
                  <th>{dict.common.product}</th>
                  <th className="text-end">{dict.common.quantity}</th>
                  <th className="text-end">{dict.common.amount}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <span className="block text-ink">{l.name}</span>
                      {l.variantLabel && <span className="block text-caption text-ink-faint">{l.variantLabel}</span>}
                    </td>
                    <td className="text-end">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={l.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === l.key ? { ...x, quantity: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } : x,
                            ),
                          )
                        }
                        className="adm-input w-16 text-end"
                      />
                    </td>
                    <td className="adm-num text-end">{(l.priceBhd * l.quantity).toFixed(3)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                        className="text-caption text-danger"
                      >
                        {dict.common.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="adm-card p-5">
          <h2 className="adm-title mb-4">{q.delivery}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="adm-kpi-label">{q.shipping}</span>
              <select value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} className="adm-select mt-1">
                {shippingOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label} — {s.priceBhd.toFixed(3)} {currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="adm-kpi-label">{q.payment}</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="adm-select mt-1">
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="adm-kpi-label">{dict.common.notes}</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="adm-input mt-1" />
            </label>
          </div>
        </section>
      </div>

      {/* Summary */}
      <div>
        <section className="adm-card sticky top-24 p-5">
          <h2 className="adm-title mb-4">{q.summary}</h2>
          <dl className="space-y-2 text-small">
            <div className="flex justify-between">
              <dt className="text-ink-muted">{q.subtotal}</dt>
              <dd className="adm-num">{subtotal.toFixed(3)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">{q.discount}</dt>
              <dd>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="adm-input w-24 text-end"
                  placeholder="0.000"
                />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{q.shipping}</dt>
              <dd className="adm-num">{shipping.toFixed(3)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-body font-medium text-ink">
              <dt>{q.total}</dt>
              <dd className="adm-num">{total.toFixed(3)} {currency}</dd>
            </div>
          </dl>
          {error && <p className="mt-3 text-caption text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="adm-btn-primary mt-5 w-full">
            {busy ? '…' : q.createOrder}
          </button>
        </section>
      </div>
    </form>
  );
}
