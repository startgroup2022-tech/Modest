import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getFeaturedProducts, getNewArrivals, getProductBySlug } from '@/lib/catalog';
import { listActiveCuts, getCutForProduct } from '@/lib/size-guide-db';
import { validatePieces } from '@/lib/measurement-plan';

/**
 * Database-backed integration tests for the Phase 3 catalog lifecycle and
 * made-to-measure domain. They exercise the real Prisma/MySQL code paths — the
 * storefront status filter, the DB-backed size guide, and server-authoritative
 * measurement validation — rather than mocks. Skipped unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let suffix: string;
const createdProductIds: string[] = [];
let cutId: string;

maybe('phase 3 catalog lifecycle (database)', () => {
  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const cut = await prisma.productCut.create({
      data: {
        code: `IT3-${suffix}`,
        nameEn: 'IT Cut',
        nameAr: 'قَصّة',
        isActive: true,
        sortOrder: 900,
        sizeCharts: { create: { unit: 'inch' } },
        fields: {
          create: [
            { key: 'shoulder_width', labelEn: 'Shoulder', labelAr: 'الكتف', unit: 'inch', minValue: 10, maxValue: 24, sortOrder: 1 },
          ],
        },
      },
      include: { sizeCharts: true, fields: true },
    });
    cutId = cut.id;
    const chart = cut.sizeCharts[0];
    const field = cut.fields[0];
    await prisma.sizeChartValue.createMany({
      data: [
        { chartId: chart.id, fieldId: field.id, sizeCode: 'S', value: 15.2, sortOrder: 0 },
        { chartId: chart.id, fieldId: field.id, sizeCode: 'M', value: 15.8, sortOrder: 1 },
      ],
    });

    const make = (key: string, status: 'ACTIVE' | 'PREORDER' | 'ARCHIVED', extra: Record<string, unknown> = {}) =>
      prisma.product.create({
        data: {
          slug: `it3-${key}-${suffix}`,
          nameEn: `IT3 ${key}`,
          nameAr: `آي ${key}`,
          descriptionEn: 'x',
          descriptionAr: 'س',
          priceBhd: 50,
          sku: `IT3-${key}-${suffix}`,
          status,
          ...extra,
        },
      });

    const [active, preorder, archived] = await Promise.all([
      make('active', 'ACTIVE', { isFeatured: true, isNewArrival: true, cutId }),
      make('preorder', 'PREORDER', { isFeatured: true, isNewArrival: true, cutId }),
      make('archived', 'ARCHIVED', { isFeatured: true, isNewArrival: true, cutId }),
    ]);
    createdProductIds.push(active.id, preorder.id, archived.id);
  });

  afterAll(async () => {
    await prisma.productCut.delete({ where: { id: cutId } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  });

  it('featured and new-arrival queries exclude archived products', async () => {
    const slugs = new Set<string>();
    const [featured, arrivals] = await Promise.all([getFeaturedProducts(50), getNewArrivals(50)]);
    for (const p of [...featured, ...arrivals]) slugs.add(p.slug);
    expect(slugs.has(`it3-active-${suffix}`)).toBe(true);
    expect(slugs.has(`it3-preorder-${suffix}`)).toBe(true);
    expect(slugs.has(`it3-archived-${suffix}`)).toBe(false);
  });

  it('resolves a live product but not an archived one', async () => {
    expect(await getProductBySlug(`it3-active-${suffix}`)).not.toBeNull();
    expect(await getProductBySlug(`it3-archived-${suffix}`)).toBeNull();
  });

  it('reads the cut and its ready-size matrix from the database', async () => {
    const cuts = await listActiveCuts();
    const cut = cuts.find((c) => c.cutCode === `IT3-${suffix}`);
    expect(cut).toBeTruthy();
    expect(cut?.sizes).toEqual(['S', 'M']);
    expect(cut?.matrix.shoulder_width.M).toBe(15.8);
  });

  it('validates a ready size against the stored cut', async () => {
    const guide = await getCutForProduct(createdProductIds[0]);
    expect(guide).not.toBeNull();
    if (!guide) return;
    const ok = validatePieces(guide, [{ mode: 'READY', sizeCode: 'M' }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.pieces[0].snapshot.kind).toBe('READY');

    const bad = validatePieces(guide, [{ mode: 'READY', sizeCode: 'XL' }]);
    expect(bad.ok).toBe(false);
  });

  it('rejects a custom value outside the configured range', async () => {
    const guide = await getCutForProduct(createdProductIds[0]);
    if (!guide) return;
    const ok = validatePieces(guide, [{ mode: 'CUSTOM', values: { shoulder_width: 18 } }]);
    expect(ok.ok).toBe(true);
    const bad = validatePieces(guide, [{ mode: 'CUSTOM', values: { shoulder_width: 99 } }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALUE_OUT_OF_RANGE');
  });
});
