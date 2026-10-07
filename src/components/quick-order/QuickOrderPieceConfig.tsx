'use client';

import { clsx } from 'clsx';
import { RulerIcon } from '@/components/ui/icons';
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
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  sizes: string[];
  fields: CutFieldView[];
  matrix: Record<string, Record<string, number>>;
}

export interface SavedProfileView {
  id: string;
  name: string;
  cutId: string | null;
  values: Record<string, number>;
}

/**
 * One physical piece's configuration. `READY` picks a size from the cut's size
 * chart; `CUSTOM` carries free measurement values (optionally seeded from one
 * of the customer's own saved profiles). Only intent is held here — the server
 * re-derives and validates every value against the stored cut before an order
 * is written.
 */
export type PieceState =
  | { mode: 'READY'; sizeCode: string | null }
  | { mode: 'CUSTOM'; values: Record<string, string>; profileId: string | null };

export function emptyPiece(): PieceState {
  return { mode: 'READY', sizeCode: null };
}

/** True when a piece has everything the server needs to accept it. */
export function isPieceComplete(piece: PieceState, cut: CutView): boolean {
  if (piece.mode === 'READY') return Boolean(piece.sizeCode && cut.sizes.includes(piece.sizeCode));
  return cut.fields.every((f) => {
    const raw = piece.values[f.key];
    if (raw === undefined || raw === '') return false;
    const n = Number(raw);
    return Number.isFinite(n) && (f.minValue == null || n >= f.minValue) && (f.maxValue == null || n <= f.maxValue);
  });
}

export function pieceToPayload(piece: PieceState): { mode: 'READY'; sizeCode: string } | { mode: 'CUSTOM'; values: Record<string, number>; profileId: string | null } {
  if (piece.mode === 'READY') return { mode: 'READY', sizeCode: piece.sizeCode ?? '' };
  const values: Record<string, number> = {};
  for (const [k, v] of Object.entries(piece.values)) {
    const n = Number(v);
    if (Number.isFinite(n)) values[k] = n;
  }
  return { mode: 'CUSTOM', values, profileId: piece.profileId };
}

/**
 * Renders a single physical piece's READY/CUSTOM configuration. Used once per
 * unit of quantity; each card owns its own independent state so pieces never
 * share one measurement object.
 */
export function QuickOrderPieceConfig({
  index,
  total,
  piece,
  cut,
  locale,
  profiles,
  sizeGuideHref,
  onChange,
  onCopyToOthers,
  dict,
}: {
  index: number;
  total: number;
  piece: PieceState;
  cut: CutView;
  locale: Locale;
  profiles: SavedProfileView[];
  sizeGuideHref: string;
  onChange: (next: PieceState) => void;
  onCopyToOthers: (() => void) | null;
  dict: {
    piece: string;
    pieces: string;
    size: string;
    sizeGuide: string;
    customMeasurements: string;
    readySize: string;
    copyMeasurements: string;
    savedProfile: string;
    useSavedProfile: string;
    chooseProfile: string;
  };
}) {
  const ar = locale === 'ar';
  const compatibleProfiles = profiles.filter((p) => !p.cutId || p.cutId === cut.id);

  function setMode(mode: 'READY' | 'CUSTOM') {
    if (mode === piece.mode) return;
    if (mode === 'READY') onChange({ mode: 'READY', sizeCode: null });
    else onChange({ mode: 'CUSTOM', values: {}, profileId: null });
  }

  function applyProfile(profileId: string) {
    const profile = compatibleProfiles.find((p) => p.id === profileId);
    if (!profile) {
      onChange({ mode: 'CUSTOM', values: piece.mode === 'CUSTOM' ? piece.values : {}, profileId: null });
      return;
    }
    const values: Record<string, string> = {};
    for (const f of cut.fields) {
      const v = profile.values[f.key];
      if (typeof v === 'number') values[f.key] = String(v);
    }
    onChange({ mode: 'CUSTOM', values, profileId: profile.id });
  }

  function setValue(key: string, raw: string) {
    const values = piece.mode === 'CUSTOM' ? { ...piece.values, [key]: raw } : { [key]: raw };
    onChange({ mode: 'CUSTOM', values, profileId: piece.mode === 'CUSTOM' ? piece.profileId : null });
  }

  return (
    <div className="border border-line p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">
          {dict.piece} {index + 1} / {total}
        </p>
        {onCopyToOthers ? (
          <button
            type="button"
            onClick={onCopyToOthers}
            className="link-underline text-caption uppercase tracking-[0.12em] text-ink-muted"
          >
            {dict.copyMeasurements}
          </button>
        ) : null}
      </div>

      <div className="mt-3 inline-flex border border-line">
        <button
          type="button"
          aria-pressed={piece.mode === 'READY'}
          onClick={() => setMode('READY')}
          className={clsx('px-4 py-2 text-small transition-colors', piece.mode === 'READY' ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink')}
        >
          {dict.readySize}
        </button>
        <button
          type="button"
          aria-pressed={piece.mode === 'CUSTOM'}
          onClick={() => setMode('CUSTOM')}
          className={clsx('border-s border-line px-4 py-2 text-small transition-colors', piece.mode === 'CUSTOM' ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink')}
        >
          {dict.customMeasurements}
        </button>
      </div>

      {piece.mode === 'READY' ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {cut.sizes.map((s) => {
            const isActive = s === piece.sizeCode;
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onChange({ mode: 'READY', sizeCode: s })}
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
        <div className="mt-4 space-y-4">
          {profiles.length ? (
            <label className="block">
              <span className="mb-2 block text-caption uppercase tracking-[0.1em] text-ink-muted">{dict.savedProfile}</span>
              <select
                value={piece.mode === 'CUSTOM' ? piece.profileId ?? '' : ''}
                onChange={(e) => applyProfile(e.target.value)}
                className="field"
              >
                <option value="">{dict.chooseProfile}</option>
                {compatibleProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {cut.fields.map((f) => {
              const raw = piece.mode === 'CUSTOM' ? piece.values[f.key] ?? '' : '';
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
        </div>
      )}

      <p className="mt-3 flex items-center gap-2 text-caption text-ink-faint">
        <RulerIcon className="h-3.5 w-3.5" />
        <a href={sizeGuideHref} className="link-underline">
          {dict.sizeGuide}
        </a>
        <span>·</span>
        <span>{ar ? cut.nameAr : cut.nameEn} · {cut.unit}</span>
      </p>
    </div>
  );
}
