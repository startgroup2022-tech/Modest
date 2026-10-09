import 'server-only';
import { prisma } from './prisma';
import {
  buildReadySizeGuide,
  type ReadySizeGuide,
  type SizeFieldDefinition,
} from './size-guide';
import type { Prisma } from '@prisma/client';

const readySizesOrder = ['XS', 'S', 'M', 'L', 'XL'];

export interface CutFieldDefinition extends SizeFieldDefinition {
  id: string;
  isActive: boolean;
}

export interface CutGuide extends ReadySizeGuide {
  id: string;
  isActive: boolean;
  descriptionEn: string | null;
  descriptionAr: string | null;
  /** Field rows with their database ids, ordered for rendering. */
  fieldRows: CutFieldDefinition[];
}

const cutInclude = {
  sizeCharts: { include: { values: { orderBy: { sortOrder: 'asc' as const } } } },
  fields: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ProductCutInclude;

type CutRow = Prisma.ProductCutGetPayload<{ include: typeof cutInclude }>;

function toGuide(cut: CutRow): CutGuide {
  const chart = cut.sizeCharts[0] ?? null;
  const sizes = chart
    ? [...new Set(chart.values.map((v) => v.sizeCode))].sort(
        (a, b) => readySizesOrder.indexOf(a) - readySizesOrder.indexOf(b),
      )
    : [];

  const fieldRows: CutFieldDefinition[] = cut.fields.map((f) => ({
    id: f.id,
    key: f.key,
    labelEn: f.labelEn,
    labelAr: f.labelAr,
    unit: f.unit,
    minValue: f.minValue != null ? Number(f.minValue) : null,
    maxValue: f.maxValue != null ? Number(f.maxValue) : null,
    helperEn: f.helperEn,
    helperAr: f.helperAr,
    sortOrder: f.sortOrder,
    isActive: f.isActive,
  }));

  const guide = buildReadySizeGuide({
    cutCode: cut.code,
    cutNameEn: cut.nameEn,
    cutNameAr: cut.nameAr,
    unit: chart?.unit ?? 'inch',
    sizes,
    fields: fieldRows,
    cells: chart
      ? chart.values.map((v) => ({ fieldKey: v.fieldId, sizeCode: v.sizeCode, value: Number(v.value) }))
      : [],
  });

  // buildReadySizeGuide keys the matrix by the field key it is handed; here the
  // cells carry fieldId, so remap the matrix onto stable field keys.
  const fieldIdToKey = new Map(cut.fields.map((f) => [f.id, f.key]));
  const matrix: Record<string, Record<string, number>> = {};
  for (const f of cut.fields) matrix[f.key] = {};
  for (const v of chart?.values ?? []) {
    const key = fieldIdToKey.get(v.fieldId);
    if (!key) continue;
    matrix[key][v.sizeCode] = Number(v.value);
  }

  return {
    ...guide,
    matrix,
    id: cut.id,
    isActive: cut.isActive,
    descriptionEn: cut.descriptionEn,
    descriptionAr: cut.descriptionAr,
    fieldRows,
  };
}

/** All cuts, active first then display order — used by the admin manager. */
export async function listCuts(): Promise<CutGuide[]> {
  const cuts = await prisma.productCut.findMany({
    include: cutInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return cuts.map(toGuide);
}

/** Only active cuts — the storefront size-guide page and product forms. */
export async function listActiveCuts(): Promise<CutGuide[]> {
  const cuts = await prisma.productCut.findMany({
    where: { isActive: true },
    include: cutInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return cuts.map(toGuide);
}

export async function getCutById(id: string): Promise<CutGuide | null> {
  const cut = await prisma.productCut.findUnique({ where: { id }, include: cutInclude });
  return cut ? toGuide(cut) : null;
}

/** The cut configuration for a product, or null for non-measurement products. */
export async function getCutForProduct(productId: string): Promise<CutGuide | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { cut: { include: cutInclude } },
  });
  return product?.cut ? toGuide(product.cut) : null;
}
