'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Creates a tailor settlement for a period, computing gross from completed tasks. */
export function SettlementForm({
  tailors,
  dict,
}: {
  tailors: { id: string; name: string }[];
  dict: { common: Record<string, string> }
}) {
  const router = useRouter();
  const c = dict.common;
  const [tailorId, setTailorId] = useState(tailors[0]?.id ?? '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [adjustmentsBhd, setAdjustments] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tailorId, periodStart, periodEnd, adjustmentsBhd: Number(adjustmentsBhd) || 0, notes }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
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

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="adm-kpi-label">{c.customer === 'Customer' ? 'Tailor' : 'الخياط'}</span>
        <select value={tailorId} onChange={(e) => setTailorId(e.target.value)} className="adm-select mt-1">
          {tailors.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="adm-kpi-label">{c.from}</span>
        <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="adm-input mt-1" />
      </label>
      <label>
        <span className="adm-kpi-label">{c.to}</span>
        <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="adm-input mt-1" />
      </label>
      <label>
        <span className="adm-kpi-label">{c.amount === 'Amount' ? 'Adjustments (BHD)' : 'التسويات (د.ب)'}</span>
        <input type="number" step="0.001" value={adjustmentsBhd} onChange={(e) => setAdjustments(e.target.value)} className="adm-input mt-1" />
      </label>
      <label className="sm:col-span-2">
        <span className="adm-kpi-label">{c.notes}</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="adm-input mt-1 resize-y" />
      </label>
      {error && <p className="text-caption text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy || !tailorId} className="adm-btn-primary">
          {busy ? c.saving : c.create}
        </button>
      </div>
    </form>
  );
}
