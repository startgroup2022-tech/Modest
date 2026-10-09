'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

interface MeasurementRow {
  id?: string;
  name: string;
  isDefault: boolean;
  unit: string;
  height: string;
  shoulder: string;
  bust: string;
  waist: string;
  hip: string;
  sleeve: string;
  armhole: string;
  length: string;
  notes: string;
}

export function MeasurementForm({
  locale,
  dict,
  initial,
  onSaved,
}: {
  locale: Locale;
  dict: Dict;
  initial: MeasurementRow | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<MeasurementRow>(
    initial ?? {
      name: '',
      isDefault: false,
      unit: 'cm',
      height: '',
      shoulder: '',
      bust: '',
      waist: '',
      hip: '',
      sleeve: '',
      armhole: '',
      length: '',
      notes: '',
    },
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const fields: { key: 'height' | 'shoulder' | 'bust' | 'waist' | 'hip' | 'sleeve' | 'armhole' | 'length'; label: string }[] = [
    { key: 'height', label: dict.sizeGuide.measureHeight.split('—')[0].trim() },
    { key: 'shoulder', label: dict.sizeGuide.measureShoulder.split('—')[0].trim() },
    { key: 'bust', label: dict.sizeGuide.measureBust.split('—')[0].trim() },
    { key: 'waist', label: dict.sizeGuide.measureWaist.split('—')[0].trim() },
    { key: 'hip', label: dict.sizeGuide.measureHip.split('—')[0].trim() },
    { key: 'sleeve', label: dict.sizeGuide.measureSleeve.split('—')[0].trim() },
    { key: 'armhole', label: locale === 'ar' ? 'فتحة الكم' : 'Armhole' },
    { key: 'length', label: dict.sizeGuide.measureLength.split('—')[0].trim() },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch('/api/account?kind=measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, create: !form.id }),
      });
      setStatus(res.ok ? 'saved' : 'error');
      if (res.ok) {
        onSaved?.();
        router.refresh();
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <label htmlFor="m-name" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.account.measurementName}
        </label>
        <input
          id="m-name"
          type="text"
          maxLength={60}
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          className="field"
          placeholder={dict.account.measurementNamePlaceholder}
        />
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-4">
          <span className="text-caption uppercase tracking-[0.12em] text-ink-muted">{locale === 'ar' ? 'الوحدة' : 'Unit'}</span>
          <div className="inline-flex border border-line">
            {(['cm', 'in'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setForm((f) => ({ ...f, unit: u }))}
                className={clsx('px-4 py-2 text-caption uppercase', form.unit === u ? 'bg-ink text-paper' : 'text-ink-muted')}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-small text-ink-muted">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((s) => ({ ...s, isDefault: e.target.checked }))}
            className="h-4 w-4 accent-ink"
          />
          {dict.account.setDefault}
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`m-${f.key}`} className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
              {f.label}
            </label>
            <input
              id={`m-${f.key}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="field tabular-nums"
            />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="m-notes" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.checkout.notes}
        </label>
        <textarea
          id="m-notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
          className="field resize-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === 'saving'} className="btn-primary">
          {status === 'saving' ? dict.account.saving : dict.account.saveMeasurements}
        </button>
        <p
          aria-live="polite"
          className={clsx('text-small', status === 'saved' ? 'text-success' : status === 'error' ? 'text-danger' : 'text-transparent')}
        >
          {status === 'saved' ? dict.account.saved : status === 'error' ? dict.errors.generic : '·'}
        </p>
      </div>
    </form>
  );
}
