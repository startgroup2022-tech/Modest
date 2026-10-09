/**
 * Server-authoritative validation of per-piece measurement choices.
 *
 * The client sends only *intent* (a ready size code or raw custom values). This
 * module re-derives the snapshot from the product's stored cut and rejects
 * anything that does not belong to it, so a tampered payload cannot inject
 * fields, use a size the cut does not offer, or smuggle values outside the
 * configured range. It holds no DB/React dependency so it is unit-tested
 * directly.
 */

import type { ReadySizeGuide, SizeFieldDefinition } from './size-guide';
import {
  buildCustomMeasurementSnapshot,
  buildReadySizeSnapshot,
  type MeasurementSnapshot,
} from './order-measurements';

export type PieceInput =
  | { mode: 'READY'; sizeCode: string }
  | { mode: 'CUSTOM'; values: Record<string, unknown>; profileId?: string | null };

export interface PieceValidationError {
  code:
    | 'SIZE_REQUIRED'
    | 'SIZE_UNKNOWN'
    | 'CUSTOM_REQUIRED'
    | 'VALUE_REQUIRED'
    | 'VALUE_NOT_NUMERIC'
    | 'VALUE_OUT_OF_RANGE'
    | 'UNKNOWN_FIELD';
  fieldKey?: string;
  /** Stable key for i18n on the client. */
  message: string;
}

export interface ValidatedPiece {
  snapshot: MeasurementSnapshot;
  sizeCode: string | null;
}

export type ValidatePieceResult =
  | { ok: true; piece: ValidatedPiece }
  | { ok: false; error: PieceValidationError };

function clampMessage(field: SizeFieldDefinition): { min: number | null; max: number | null } {
  return { min: field.minValue, max: field.maxValue };
}

/** Validates one piece against a cut guide. */
export function validatePiece(guide: ReadySizeGuide, input: PieceInput): ValidatePieceResult {
  const fields = guide.fields.filter((f) => f.key);

  if (input.mode === 'READY') {
    const sizeCode = typeof input.sizeCode === 'string' ? input.sizeCode.trim() : '';
    if (!sizeCode) return { ok: false, error: { code: 'SIZE_REQUIRED', message: 'Choose a size.' } };
    if (!guide.sizes.includes(sizeCode)) {
      return { ok: false, error: { code: 'SIZE_UNKNOWN', message: 'That size is not offered for this piece.' } };
    }
    const values: Record<string, number> = {};
    for (const field of fields) {
      const v = guide.matrix[field.key]?.[sizeCode];
      if (typeof v === 'number') values[field.key] = v;
    }
    return {
      ok: true,
      piece: {
        sizeCode,
        snapshot: buildReadySizeSnapshot({
          unit: guide.unit,
          cutCode: guide.cutCode,
          cutNameEn: guide.cutNameEn,
          cutNameAr: guide.cutNameAr,
          sizeCode,
          values,
          fields,
        }),
      },
    };
  }

  // CUSTOM — only declared fields with an active definition are accepted.
  const input_values = input.values ?? {};
  for (const key of Object.keys(input_values)) {
    if (!fields.some((f) => f.key === key)) {
      return { ok: false, error: { code: 'UNKNOWN_FIELD', fieldKey: key, message: 'Unknown measurement field.' } };
    }
  }

  const values: Record<string, number> = {};
  for (const field of fields) {
    const raw = input_values[field.key];
    const isBlank = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
    if (isBlank) {
      return { ok: false, error: { code: 'VALUE_REQUIRED', fieldKey: field.key, message: 'This measurement is required.' } };
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) {
      return { ok: false, error: { code: 'VALUE_NOT_NUMERIC', fieldKey: field.key, message: 'Enter a number.' } };
    }
    const { min, max } = clampMessage(field);
    if ((min != null && n < min) || (max != null && n > max)) {
      return { ok: false, error: { code: 'VALUE_OUT_OF_RANGE', fieldKey: field.key, message: 'Value is out of range.' } };
    }
    values[field.key] = n;
  }

  return {
    ok: true,
    piece: {
      sizeCode: null,
      snapshot: buildCustomMeasurementSnapshot({
        unit: guide.unit,
        cutCode: guide.cutCode,
        cutNameEn: guide.cutNameEn,
        cutNameAr: guide.cutNameAr,
        values,
        fields,
        profileId: input.profileId ?? null,
      }),
    },
  };
}

/** Validates an ordered list of pieces; fails on the first invalid piece. */
export function validatePieces(
  guide: ReadySizeGuide,
  pieces: PieceInput[],
): { ok: true; pieces: ValidatedPiece[] } | { ok: false; error: PieceValidationError; index: number } {
  const out: ValidatedPiece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const result = validatePiece(guide, pieces[i]);
    if (!result.ok) return { ok: false, error: result.error, index: i };
    out.push(result.piece);
  }
  return { ok: true, pieces: out };
}

/**
 * A stable grouping key for a cart line: identical product/variant/measurement
 * configs share a line, different measurements stay separate. `_` is used for
 * the variant-less case so the key never contains an empty segment.
 */
export function configKeyFor(productId: string, variantId: string | null, pieces: ValidatedPiece[]): string {
  const config = pieces
    .map((p) => JSON.stringify([p.sizeCode, p.snapshot.kind, p.snapshot.kind === 'CUSTOM' ? p.snapshot.values : null]))
    .join(';');
  return `${productId}|${variantId ?? '_'}|${config}`;
}
