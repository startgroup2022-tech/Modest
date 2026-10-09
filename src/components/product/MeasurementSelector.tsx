'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { RulerIcon } from '@/components/ui/icons';
import type { CartPieceInput } from '@/components/providers/StoreProvider';
import type { Locale } from '@/i18n/config';

export interface CutFieldView {
  key: string;
  labelEn: string;
  labelAr: string;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  helperEn: string | null;
  helperAr: string | null;
}

export interface CutView {
  code: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  sizes: string[];
  fields: CutFieldView[];
  matrix: Record<string, Record<string, number>>;
}

/**
 * Per-piece measurement chooser for cut products. The buyer may take a ready
 * size straight from the cut's size chart, or enter custom measurements. The
 * component only reports intent; the server re-derives and validates every
 * value against the stored cut before it reaches the cart.
 */
export function MeasurementSelector({
  cut,
  locale,
  sizeGuideHref,
  onChange,
  dict,
}: {
  cut: CutView;
  locale: Locale;
  sizeGuideHref: string;
  onChange: (piece: CartPieceInput | null) => void;
  dict: { size: string; sizeGuide: string; customMeasurements: string; readySize: string; required: string };
}) {
  const ar = locale === 'ar';
  const [mode, setMode] = useState<'READY' | 'CUSTOM'>('READY');
  const [size, setSize] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  function emit(next: { mode: 'READY' | 'CUSTOM'; size: string | null; values: Record<string, string> }) {
    if (next.mode === 'READY') {
      onChange(next.size ? { mode: 'READY', sizeCode: next.size } : null);
      return;
    }
    const parsed: Record<string, number> = {};
    for (const f of cut.fields) {
      const raw = next.values[f.key];
      if (raw === undefined || raw === '') return onChange(null);
      const n = Number(raw);
      if (!Number.isFinite(n)) return onChange(null);
      parsed[f.key] = n;
    }
    onChange({ mode: 'CUSTOM', values: parsed });
  }

  function chooseMode(next: 'READY' | 'CUSTOM') {
    setMode(next);
    emit({ mode: next, size, values });
  }

  function chooseSize(next: string) {
    setSize(next);
    emit({ mode: 'READY', size: next, values });
  }

  function setValue(key: string, raw: string) {
    const next = { ...values, [key]: raw };
    setValues(next);
    emit({ mode: 'CUSTOM', size, values: next });
  }

  return (
    <div className="mt-7">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{dict.customMeasurements}</span>
        <a
          href={sizeGuideHref}
          className="link-underline inline-flex items-center gap-1.5 text-caption uppercase tracking-[0.12em] text-ink-muted"
        >
          <RulerIcon className="h-3.5 w-3.5" />
          {dict.sizeGuide}
        </a>
      </div>

      <div className="mt-3 inline-flex border border-line">
        <button
          type="button"
          aria-pressed={mode === 'READY'}
          onClick={() => chooseMode('READY')}
          className={clsx('px-5 py-2.5 text-small transition-colors', mode === 'READY' ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink')}
        >
          {dict.readySize}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'CUSTOM'}
          onClick={() => chooseMode('CUSTOM')}
          className={clsx('border-s border-line px-5 py-2.5 text-small transition-colors', mode === 'CUSTOM' ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink')}
        >
          {dict.customMeasurements}
        </button>
      </div>

      <p className="mt-2 text-caption text-ink-faint">
        {ar ? cut.nameAr : cut.nameEn} · {cut.unit}
      </p>

      {mode === 'READY' ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {cut.sizes.map((s) => {
            const isActive = s === size;
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => chooseSize(s)}
                  className={clsx(
                    'min-w-[3.25rem] border px-4 py-2.5 text-small transition-colors',
                    isActive ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink',
                  )}
                >
                  {s}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {cut.fields.map((f) => {
            const raw = values[f.key] ?? '';
            const n = raw === '' ? null : Number(raw);
            const invalid = n !== null && ((f.minValue != null && n < f.minValue) || (f.maxValue != null && n > f.maxValue));
            return (
              <label key={f.key} className="block">
                <span className="flex items-baseline justify-between gap-2 text-caption uppercase tracking-[0.1em] text-ink-muted">
                  {ar ? f.labelAr : f.labelEn}
                  <span className="text-ink-faint normal-case tracking-normal">
                    {f.minValue != null && f.maxValue != null ? `${f.minValue}–${f.maxValue} ${f.unit}` : f.unit}
                  </span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={raw}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  aria-invalid={invalid}
                  className={clsx('field mt-1.5', invalid && 'border-danger text-danger')}
                />
                {(ar ? f.helperAr : f.helperEn) ? (
                  <span className="mt-1 block text-caption text-ink-faint">{ar ? f.helperAr : f.helperEn}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
