'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { QuickOrderLinkView } from '@/lib/quick-order-db';
import type { Locale } from '@/i18n/config';

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

const STATE_TONE: Record<string, string> = {
  GENERATED: 'adm-badge-neutral',
  SEND_INITIATED: 'adm-badge-info',
  OPENED: 'adm-badge-accent',
  ORDER_CREATED: 'adm-badge-success',
  REVOKED: 'adm-badge-danger',
  EXPIRED: 'adm-badge-warn',
};

const STATE_LABEL: Record<string, { en: string; ar: string }> = {
  GENERATED: { en: 'Generated', ar: 'تم الإنشاء' },
  SEND_INITIATED: { en: 'Send initiated', ar: 'بدأ الإرسال' },
  OPENED: { en: 'Opened', ar: 'تم الفتح' },
  ORDER_CREATED: { en: 'Order created', ar: 'تم إنشاء الطلب' },
  REVOKED: { en: 'Revoked', ar: 'ملغى' },
  EXPIRED: { en: 'Expired', ar: 'منتهي' },
};

interface CreatedResult {
  code: string;
  urls: { en: string; ar: string };
  whatsappUrl: string | null;
}

export function QuickOrderLinks({
  locale,
  dict,
  products,
  links,
  currency,
}: {
  locale: Locale;
  dict: { quickOrders: Record<string, string>; common: Record<string, string>; orders: Record<string, string> };
  products: ProductOption[];
  links: QuickOrderLinkView[];
  currency: string;
}) {
  const router = useRouter();
  const q = dict.quickOrders;

  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [source, setSource] = useState<'WHATSAPP' | 'INSTAGRAM'>('WHATSAPP');
  const [phone, setPhone] = useState('');
  const [ttlDays, setTtlDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    if (!productId) {
      setError(locale === 'ar' ? 'اختر منتجاً' : 'Choose a product');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/orders/quick-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          source,
          customerPhone: phone || undefined,
          ttlDays: Number(ttlDays) || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        link?: { code: string };
        urls?: { en: string; ar: string };
        whatsappUrl?: string | null;
      };
      if (!res.ok || !data.ok || !data.urls || !data.link) {
        setError(data.error ?? 'Failed');
        setBusy(false);
        return;
      }
      setCreated({ code: data.link.code, urls: data.urls, whatsappUrl: data.whatsappUrl ?? null });
      setPhone('');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: 'mark_sent' | 'revoke') {
    if (action === 'revoke' && !window.confirm(q.linkRevokeConfirm)) return;
    setRowBusy(id);
    try {
      const res = await fetch(`/api/admin/orders/quick-links?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setRowBusy(null);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable — the URL is still visible to copy manually */
    }
  }

  return (
    <div className="space-y-8">
      {/* Create */}
      <section className="adm-card p-5">
        <h2 className="adm-title mb-1">{q.linksTitle}</h2>
        <p className="mb-4 text-small text-ink-muted">{q.linksSubtitle}</p>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="adm-kpi-label">{q.linkProduct}</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="adm-select mt-1">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` — ${p.sku}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="adm-kpi-label">{q.linkSource}</span>
            <select value={source} onChange={(e) => setSource(e.target.value as 'WHATSAPP' | 'INSTAGRAM')} className="adm-select mt-1">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </label>
          <label className="block">
            <span className="adm-kpi-label">{q.linkTtl}</span>
            <input
              type="number"
              min={1}
              max={365}
              value={ttlDays}
              onChange={(e) => setTtlDays(e.target.value)}
              className="adm-input mt-1"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="adm-kpi-label">{q.linkPhone}</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+973…"
              className="adm-input mt-1"
            />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" disabled={busy} className="adm-btn-primary w-full sm:w-auto">
              {busy ? '…' : q.linkCreate}
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-caption text-danger">{error}</p>}

        {created && (
          <div className="mt-5 border border-ink bg-paper-warm p-4">
            <p className="text-small font-medium text-ink">{q.linkCreated}</p>
            <p className="mt-1 text-caption text-ink-muted">{q.linkUrlOnce}</p>
            <div className="mt-3 space-y-2">
              {(['en', 'ar'] as const).map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-caption uppercase text-ink-faint">{l}</span>
                  <code className="min-w-0 flex-1 truncate border border-line bg-paper px-2 py-1 text-caption" dir="ltr">
                    {created.urls[l]}
                  </code>
                  <button type="button" onClick={() => copy(created.urls[l], l)} className="adm-btn-outline adm-btn-sm shrink-0">
                    {copied === l ? q.linkCopied : q.linkCopy}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {created.whatsappUrl ? (
                <a href={created.whatsappUrl} target="_blank" rel="noopener noreferrer" className="adm-btn-primary adm-btn-sm">
                  {q.linkOpenWhatsApp}
                </a>
              ) : (
                <span className="text-caption text-ink-faint">{q.linkNoPhone}</span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* List */}
      <section className="adm-card p-5">
        <h2 className="adm-title mb-4">{q.linksTitle}</h2>
        {links.length === 0 ? (
          <p className="py-8 text-center text-small text-ink-muted">{q.linkNone}</p>
        ) : (
          <div className="adm-scroll overflow-x-auto">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{q.linkProduct}</th>
                  <th>{q.linkSource}</th>
                  <th>{q.linkState}</th>
                  <th className="text-end">{q.linkOpened}</th>
                  <th>{q.linkOrder}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const stateLabel = STATE_LABEL[l.state]?.[locale] ?? l.state;
                  const productName = locale === 'ar' ? l.product.nameAr : l.product.nameEn;
                  return (
                    <tr key={l.id}>
                      <td>
                        <span className="block text-ink">{productName}</span>
                        <span className="block text-caption text-ink-faint">
                          {l.code} · ••{l.tokenLast4} · {currency}
                        </span>
                      </td>
                      <td className="text-small">{l.source === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'}</td>
                      <td>
                        <span className={clsx('adm-badge', STATE_TONE[l.state] ?? 'adm-badge-neutral')}>{stateLabel}</span>
                      </td>
                      <td className="adm-num text-end">{l.openCount}</td>
                      <td className="text-small">
                        {l.order ? (
                          <span className="text-ink">{l.order.orderNumber}</span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        {l.usable && (
                          <div className="flex justify-end gap-2">
                            {!l.sentAt && (
                              <button
                                type="button"
                                disabled={rowBusy === l.id}
                                onClick={() => act(l.id, 'mark_sent')}
                                className="adm-btn-outline adm-btn-sm"
                              >
                                {q.linkMarkSent}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={rowBusy === l.id}
                              onClick={() => act(l.id, 'revoke')}
                              className="adm-btn-outline adm-btn-sm text-danger"
                            >
                              {q.linkRevoke}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
