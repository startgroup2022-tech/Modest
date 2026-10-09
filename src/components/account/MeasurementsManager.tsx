'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { MeasurementForm } from './MeasurementForm';

export interface MeasurementProfile {
  id: string;
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
  updatedAt: string;
}

const SUMMARY_FIELDS: { key: keyof MeasurementProfile; labelKey: 'measureHeight' | 'measureBust' | 'measureWaist' | 'measureHip' }[] = [
  { key: 'height', labelKey: 'measureHeight' },
  { key: 'bust', labelKey: 'measureBust' },
  { key: 'waist', labelKey: 'measureWaist' },
  { key: 'hip', labelKey: 'measureHip' },
];

export function MeasurementsManager({
  locale,
  dict,
  profiles,
}: {
  locale: Locale;
  dict: Dict;
  profiles: MeasurementProfile[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MeasurementProfile | null | 'new'>(profiles.length ? null : 'new');
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/account?kind=measurements&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (p: MeasurementProfile) => {
    setBusyId(p.id);
    try {
      const res = await fetch('/api/account?kind=measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, isDefault: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (editing) {
    const initial =
      editing === 'new'
        ? null
        : {
            id: editing.id,
            name: editing.name,
            isDefault: editing.isDefault,
            unit: editing.unit,
            height: editing.height,
            shoulder: editing.shoulder,
            bust: editing.bust,
            waist: editing.waist,
            hip: editing.hip,
            sleeve: editing.sleeve,
            armhole: editing.armhole,
            length: editing.length,
            notes: editing.notes,
          };
    return (
      <div className="border border-line p-6">
        <MeasurementForm
          locale={locale}
          dict={dict}
          initial={initial}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
        <button type="button" onClick={() => setEditing(null)} className="link-underline mt-4 text-caption uppercase tracking-[0.14em] text-ink-muted">
          {dict.account.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {profiles.length === 0 ? (
        <p className="text-small text-ink-muted">{dict.account.noMeasurementsBody}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-h4">{p.name}</p>
                  {p.isDefault ? (
                    <span className="border border-ink px-2 py-0.5 text-caption uppercase tracking-[0.12em]">{dict.account.default}</span>
                  ) : null}
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-caption text-ink-muted">
                  {SUMMARY_FIELDS.map((f) => {
                    const value = p[f.key];
                    if (!value) return null;
                    return (
                      <div key={f.key} className="flex gap-2">
                        <dt>{dict.sizeGuide[f.labelKey].split('—')[0].trim()}</dt>
                        <dd className="tabular-nums">
                          {value} {p.unit}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-2 text-caption text-ink-faint">{p.updatedAt}</p>
              </div>
              <div className="flex items-center gap-4">
                {!p.isDefault ? (
                  <button
                    type="button"
                    onClick={() => makeDefault(p)}
                    disabled={busyId === p.id}
                    className="link-underline text-caption uppercase tracking-[0.14em] text-ink-muted disabled:opacity-50"
                  >
                    {dict.account.setDefault}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="link-underline text-caption uppercase tracking-[0.14em] text-ink-muted"
                >
                  {dict.account.edit}
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={busyId === p.id}
                  className={clsx('link-underline text-caption uppercase tracking-[0.14em] text-danger', busyId === p.id && 'opacity-50')}
                >
                  {dict.account.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setEditing('new')} className="btn-outline">
        {dict.account.addMeasurement}
      </button>
    </div>
  );
}
