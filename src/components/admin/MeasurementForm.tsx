'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DIMS = ['height', 'shoulder', 'bust', 'waist', 'hip', 'sleeve', 'armhole', 'length'] as const;

/** Adds a measurement set to a customer profile. */
export function MeasurementForm({
  customerId,
  labels,
  dict,
}: {
  customerId: string;
  labels: Record<string, string>;
  dict: { common: Record<string, string> };
}) {
  const router = useRouter();
  const c = dict.common;
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('cm');
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name || 'My measurements',
        unit,
        notes,
        isDefault,
      };
      for (const key of DIMS) payload[key] = values[key] === '' || values[key] == null ? null : Number(values[key]);
      const res = await fetch(`/api/admin/customers/${customerId}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        return;
      }
      setName('');
      setValues({});
      setNotes('');
      setIsDefault(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
      <label className="sm:col-span-2">
        <span className="adm-kpi-label">{c.reference}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My measurements" className="adm-input mt-1" />
      </label>
      <label>
        <span className="adm-kpi-label">{c.unit ?? 'Unit'}</span>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="adm-select mt-1">
          <option value="cm">cm</option>
          <option value="in">in</option>
        </select>
      </label>
      {DIMS.map((key) => (
        <label key={key}>
          <span className="adm-kpi-label">{labels[key]}</span>
          <input
            type="number"
            step="0.01"
            value={values[key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            className="adm-input mt-1"
          />
        </label>
      ))}
      <label className="sm:col-span-3">
        <span className="adm-kpi-label">{c.notes}</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="adm-input mt-1 resize-y" />
      </label>
      <label className="sm:col-span-3">
        <span className="flex items-center gap-2 text-small text-ink">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 accent-ink" />
          {c.currency === 'Currency' ? 'Set as default' : 'تعيين كافتراضي'}
        </span>
      </label>
      {error && <p className="text-caption text-danger sm:col-span-3">{error}</p>}
      <div className="sm:col-span-3">
        <button type="submit" disabled={busy} className="adm-btn-primary">
          {busy ? c.saving : c.save}
        </button>
      </div>
    </form>
  );
}
