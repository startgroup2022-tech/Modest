'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CurrencyRow {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  symbolEn: string;
  symbolAr: string;
  decimals: number;
  symbolPosition: string;
  rateToBhd: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

/** Inline currency table with rate editing. The base currency (BHD) is locked. */
export function CurrencyManager({
  currencies,
  locale,
  dict,
  canEdit,
}: {
  currencies: CurrencyRow[];
  locale: 'en' | 'ar';
  dict: { common: Record<string, string>; system: Record<string, string> };
  canEdit: boolean;
}) {
  const router = useRouter();
  const c = dict.common;
  const [editing, setEditing] = useState<string | null>(null);
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(id: string, row: CurrencyRow) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/currencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: row.code, nameEn: row.nameEn, nameAr: row.nameAr,
          symbolEn: row.symbolEn, symbolAr: row.symbolAr,
          decimals: row.decimals, symbolPosition: row.symbolPosition,
          rateToBhd: Number(rate) || Number(row.rateToBhd), isActive: row.isActive, sortOrder: row.sortOrder,
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const baseLabel = locale === 'ar' ? 'الأساسية' : 'Base';

  return (
    <div className="overflow-x-auto">
      {error && <p className="px-5 pt-3 text-caption text-danger">{error}</p>}
      <table className="adm-table adm-table-responsive">
        <thead>
          <tr>
            <th>{c.currency}</th>
            <th>{dict.system.exchangeRates}</th>
            <th className="text-end">{c.status}</th>
            <th>{c.actions}</th>
          </tr>
        </thead>
        <tbody>
          {currencies.map((row) => (
            <tr key={row.id}>
              <td data-label={c.currency} className="text-ink">
                <span className="adm-num block">{row.code}</span>
                <span className="block text-caption text-ink-faint">
                  {locale === 'ar' ? row.nameAr : row.nameEn} · {locale === 'ar' ? row.symbolAr : row.symbolEn}
                </span>
              </td>
              <td data-label={dict.system.exchangeRates} className="adm-num text-ink-muted">
                {editing === row.id ? (
                  <input
                    type="number"
                    step="0.00000001"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="adm-input w-32"
                    aria-label={dict.system.exchangeRates}
                  />
                ) : (
                  <>1 {row.code} = {row.rateToBhd} BHD</>
                )}
              </td>
              <td data-label={c.status} className="text-end">
                {row.isDefault ? (
                  <span className="adm-badge-accent">{baseLabel}</span>
                ) : row.isActive ? (
                  <span className="adm-badge-success">{c.enabled}</span>
                ) : (
                  <span className="adm-badge-neutral">{c.disabled}</span>
                )}
              </td>
              <td data-label={c.actions}>
                {canEdit && !row.isDefault ? (
                  editing === row.id ? (
                    <span className="flex items-center gap-2">
                      <button type="button" disabled={busy} onClick={() => save(row.id, row)} className="adm-btn-primary adm-btn-sm">
                        {c.save}
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="adm-btn-ghost adm-btn-sm">
                        {c.cancel}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(row.id);
                        setRate(row.rateToBhd);
                      }}
                      className="adm-btn-outline adm-btn-sm"
                    >
                      {c.edit}
                    </button>
                  )
                ) : (
                  <span className="text-caption text-ink-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
