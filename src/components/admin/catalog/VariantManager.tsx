'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Variant {
  id: string;
  size: string;
  colorEn: string;
  sku: string;
  priceBhd: string;
  stock: number;
  stockStatus: string;
  isActive: boolean;
}

const STOCK_LABEL: Record<string, { en: string; ar: string }> = {
  IN_STOCK: { en: 'In stock', ar: 'متوفر' },
  LOW_STOCK: { en: 'Low stock', ar: 'مخزون منخفض' },
  OUT_OF_STOCK: { en: 'Out of stock', ar: 'غير متوفر' },
  PRE_ORDER: { en: 'Pre-order', ar: 'طلب مسبق' },
};

export function VariantManager({
  productId,
  variants,
  locale,
  dict,
}: {
  productId: string;
  variants: Variant[];
  locale: 'en' | 'ar';
  dict: { products: Record<string, string>; common: Record<string, string> };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ size: '', colorEn: '', sku: '', priceBhd: '', stock: '0' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, id?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants${id ? `/${id}` : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(out.error ?? 'Failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.size.trim()) return;
    await call('POST', {
      size: draft.size,
      colorEn: draft.colorEn,
      sku: draft.sku || null,
      priceBhd: draft.priceBhd ? Number(draft.priceBhd) : null,
      stock: Number(draft.stock) || 0,
    });
    setDraft({ size: '', colorEn: '', sku: '', priceBhd: '', stock: '0' });
  }

  return (
    <div>
      {variants.length > 0 && (
        <div className="overflow-x-auto border-b border-line">
          <table className="adm-table">
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'المقاس' : 'Size'}</th>
                <th>{locale === 'ar' ? 'اللون' : 'Colour'}</th>
                <th className="text-end">{locale === 'ar' ? 'السعر' : 'Price'}</th>
                <th className="text-end">{locale === 'ar' ? 'المخزون' : 'Stock'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td>{v.size}</td>
                  <td className="text-ink-muted">{v.colorEn || '—'}</td>
                  <td className="adm-num text-end">{v.priceBhd || '—'}</td>
                  <td className="text-end">
                    <input
                      type="number"
                      defaultValue={v.stock}
                      onBlur={(e) => {
                        const stock = Number(e.target.value);
                        if (stock !== v.stock) call('PATCH', { stock }, v.id);
                      }}
                      className="adm-input w-20 text-end"
                    />
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call('DELETE', undefined, v.id)}
                      className="text-caption text-danger"
                    >
                      {dict.common.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={add} className="grid gap-2 p-4 sm:grid-cols-2">
        <input
          value={draft.size}
          onChange={(e) => setDraft({ ...draft, size: e.target.value })}
          placeholder={locale === 'ar' ? 'المقاس' : 'Size'}
          className="adm-input"
          required
        />
        <input
          value={draft.colorEn}
          onChange={(e) => setDraft({ ...draft, colorEn: e.target.value })}
          placeholder={locale === 'ar' ? 'اللون' : 'Colour'}
          className="adm-input"
        />
        <input
          value={draft.sku}
          onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
          placeholder={dict.common.sku}
          className="adm-input"
        />
        <input
          type="number"
          step="0.001"
          value={draft.priceBhd}
          onChange={(e) => setDraft({ ...draft, priceBhd: e.target.value })}
          placeholder={locale === 'ar' ? 'السعر' : 'Price'}
          className="adm-input"
        />
        <input
          type="number"
          value={draft.stock}
          onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
          placeholder={locale === 'ar' ? 'المخزون' : 'Stock'}
          className="adm-input"
        />
        <button type="submit" disabled={busy} className="adm-btn-outline">
          + {dict.products.addVariant}
        </button>
        {error && <p className="text-caption text-danger sm:col-span-2">{error}</p>}
      </form>
    </div>
  );
}
