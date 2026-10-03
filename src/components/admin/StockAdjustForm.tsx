'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StockAdjustForm({
  variants,
  locale,
  dict,
  fixedVariantId,
}: {
  variants: { id: string; label: string; stock: number }[];
  locale: 'en' | 'ar';
  dict: { inventory: Record<string, string>; common: Record<string, string> };
  fixedVariantId?: string;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(fixedVariantId ?? variants[0]?.id ?? '');
  const [delta, setDelta] = useState('');
  const [type, setType] = useState('MANUAL_ADJUSTMENT');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selected = variants.find((v) => v.id === variantId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, delta: Number(delta), type, reason: reason || undefined }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; stock?: number };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Failed');
        return;
      }
      setDone(true);
      setDelta('');
      setReason('');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedVariantId && (
        <label className="block">
          <span className="adm-kpi-label">{dict.common.variant}</span>
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="adm-select mt-1">
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} — {v.stock}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <p className="text-caption text-ink-faint">
          {dict.inventory.onHand}: <span className="adm-num text-ink">{selected.stock}</span>
        </p>
      )}
      <label className="block">
        <span className="adm-kpi-label">{dict.inventory.delta}</span>
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+10 / -3"
          className="adm-input mt-1"
          required
        />
      </label>
      <label className="block">
        <span className="adm-kpi-label">{dict.common.reason}</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className="adm-select mt-1">
          <option value="MANUAL_ADJUSTMENT">{locale === 'ar' ? 'تعديل يدوي' : 'Manual adjustment'}</option>
          <option value="RESTOCK">{locale === 'ar' ? 'إعادة تخزين' : 'Restock'}</option>
          <option value="DAMAGE">{locale === 'ar' ? 'تلف' : 'Damage'}</option>
          <option value="RETURN">{locale === 'ar' ? 'إرجاع' : 'Return'}</option>
          <option value="QC_REJECTED">{locale === 'ar' ? 'رفض فحص الجودة' : 'QC rejected'}</option>
        </select>
      </label>
      <label className="block">
        <span className="adm-kpi-label">{dict.inventory.reason}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="adm-input mt-1" />
      </label>
      {error && <p className="text-caption text-danger">{error}</p>}
      {done && <p className="text-caption text-success">{dict.common.saved}</p>}
      <button type="submit" disabled={busy} className="adm-btn-primary w-full">
        {busy ? '…' : dict.inventory.adjust}
      </button>
    </form>
  );
}
