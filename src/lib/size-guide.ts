/**
 * Size-guide domain types and pure helpers.
 *
 * This module holds no database or React dependency so it can be unit-tested
 * and shared by the storefront, admin, order snapshotting and the tailor
 * portal. The database (ProductCut / SizeChart / MeasurementField /
 * SizeChartValue) is the single source of truth; these are the shapes it maps
 * into.
 */

export type MeasurementKindValue = 'READY' | 'CUSTOM';

export interface SizeFieldDefinition {
  key: string;
  labelEn: string;
  labelAr: string;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  helperEn: string | null;
  helperAr: string | null;
  sortOrder: number;
}

export interface SizeChartCell {
  fieldKey: string;
  sizeCode: string;
  value: number;
}

export interface ReadySizeGuide {
  cutCode: string;
  cutNameEn: string;
  cutNameAr: string;
  unit: string;
  /** Ordered ready-size codes, e.g. ['XS','S','M','L','XL']. */
  sizes: string[];
  fields: SizeFieldDefinition[];
  /** fieldKey → sizeCode → value. */
  matrix: Record<string, Record<string, number>>;
}

/** Renders a size guide from flat cell rows, preserving field/size order. */
export function buildReadySizeGuide(input: {
  cutCode: string;
  cutNameEn: string;
  cutNameAr: string;
  unit: string;
  sizes: string[];
  fields: SizeFieldDefinition[];
  cells: SizeChartCell[];
}): ReadySizeGuide {
  const matrix: Record<string, Record<string, number>> = {};
  for (const field of input.fields) matrix[field.key] = {};
  for (const cell of input.cells) {
    if (!matrix[cell.fieldKey]) matrix[cell.fieldKey] = {};
    matrix[cell.fieldKey][cell.sizeCode] = cell.value;
  }
  return {
    cutCode: input.cutCode,
    cutNameEn: input.cutNameEn,
    cutNameAr: input.cutNameAr,
    unit: input.unit,
    sizes: [...input.sizes],
    fields: [...input.fields].sort((a, b) => a.sortOrder - b.sortOrder),
    matrix,
  };
}

/** True when a ready size code exists on the guide. */
export function hasReadySize(guide: ReadySizeGuide, sizeCode: string): boolean {
  return guide.sizes.includes(sizeCode);
}

/** The row of values for a ready size, keyed by field key. */
export function readySizeValues(guide: ReadySizeGuide, sizeCode: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of guide.fields) {
    const v = guide.matrix[field.key]?.[sizeCode];
    if (typeof v === 'number') out[field.key] = v;
  }
  return out;
}
