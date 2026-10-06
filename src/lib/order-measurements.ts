/**
 * Order-item measurement snapshot shapes and builders (pure).
 *
 * A snapshot is written once when an order item is created and is never
 * recomputed. It captures the *values actually used*, not a pointer to the
 * live guide, so later edits to the size guide or a saved measurement profile
 * cannot change a historical order.
 */

import type { MeasurementKindValue } from './size-guide';

export interface ReadySizeSnapshot {
  kind: 'READY';
  unit: string;
  cutCode: string | null;
  cutNameEn: string | null;
  cutNameAr: string | null;
  sizeCode: string;
  /** fieldKey → value, frozen at order time. */
  values: Record<string, number>;
  /** fieldKey → { en, ar } labels frozen at order time. */
  fieldLabels: Record<string, { en: string; ar: string }>;
}

export interface CustomMeasurementSnapshot {
  kind: 'CUSTOM';
  unit: string;
  cutCode: string | null;
  cutNameEn: string | null;
  cutNameAr: string | null;
  /** fieldKey → value, frozen at order time. */
  values: Record<string, number>;
  /** fieldKey → { en, ar } labels frozen at order time. */
  fieldLabels: Record<string, { en: string; ar: string }>;
  /** Saved profile the values originated from, if any (provenance only). */
  profileId?: string | null;
}

export type MeasurementSnapshot = ReadySizeSnapshot | CustomMeasurementSnapshot;

export interface SnapshotField {
  key: string;
  labelEn: string;
  labelAr: string;
}

function labelsFor(fields: SnapshotField[]): Record<string, { en: string; ar: string }> {
  const out: Record<string, { en: string; ar: string }> = {};
  for (const f of fields) out[f.key] = { en: f.labelEn, ar: f.labelAr };
  return out;
}

/** Only finite numeric values are frozen — blanks are omitted, not zeroed. */
function cleanValues(values: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    // `Number('')` is 0, which would silently record a zero measurement, so
    // blank strings are skipped explicitly before coercion.
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function buildReadySizeSnapshot(input: {
  unit: string;
  cutCode?: string | null;
  cutNameEn?: string | null;
  cutNameAr?: string | null;
  sizeCode: string;
  values: Record<string, unknown>;
  fields: SnapshotField[];
}): ReadySizeSnapshot {
  return {
    kind: 'READY',
    unit: input.unit,
    cutCode: input.cutCode ?? null,
    cutNameEn: input.cutNameEn ?? null,
    cutNameAr: input.cutNameAr ?? null,
    sizeCode: input.sizeCode,
    values: cleanValues(input.values),
    fieldLabels: labelsFor(input.fields),
  };
}

export function buildCustomMeasurementSnapshot(input: {
  unit: string;
  cutCode?: string | null;
  cutNameEn?: string | null;
  cutNameAr?: string | null;
  values: Record<string, unknown>;
  fields: SnapshotField[];
  profileId?: string | null;
}): CustomMeasurementSnapshot {
  return {
    kind: 'CUSTOM',
    unit: input.unit,
    cutCode: input.cutCode ?? null,
    cutNameEn: input.cutNameEn ?? null,
    cutNameAr: input.cutNameAr ?? null,
    values: cleanValues(input.values),
    fieldLabels: labelsFor(input.fields),
    profileId: input.profileId ?? null,
  };
}

/** Narrowing helper for JSON read back out of the database. */
export function isMeasurementSnapshot(value: unknown): value is MeasurementSnapshot {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'READY' || kind === 'CUSTOM';
}

export function measurementKindOf(snapshot: MeasurementSnapshot): MeasurementKindValue {
  return snapshot.kind;
}
