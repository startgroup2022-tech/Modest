import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

/**
 * An in-memory cookie store standing in for Next's request cookie scope, so the
 * real `addToCart` / `getCartView` code paths can run against the database
 * without a browser. Only the framework primitive is substituted — the cart
 * logic, validation and pricing under test are the production implementations.
 */
const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const { prisma } = await import('@/lib/prisma');
const { addToCart, getCartView, CART_COOKIE } = await import('@/lib/cart');

/**
 * Database-backed pricing regression for the storefront cart: the subtotal the
 * buyer sees must equal the sum of the per-piece effective prices the order
 * will charge. Skipped unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

const extraProductIds: string[] = [];
const extraCutIds: string[] = [];
let suffix: string;

maybe('storefront cart pricing (database)', () => {
  beforeAll(() => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: extraProductIds } } });
    await prisma.productCut.deleteMany({ where: { id: { in: extraCutIds } } });
  });

  /** A cut product with a size chart and per-size price overrides. */
  async function makePricedCutProduct(basePrice: number, overrides: Record<string, number | null>) {
    const cut = await prisma.productCut.create({
      data: {
        code: `CARTPC-${suffix}-${Math.random().toString(36).slice(2, 6)}`,
        nameEn: 'Cart Priced Cut',
        nameAr: 'قَصّة مسعّرة',
        isActive: true,
        sortOrder: 950,
        sizeCharts: { create: { unit: 'inch' } },
        fields: {
          create: [{ key: 'shoulder_width', labelEn: 'Shoulder', labelAr: 'الكتف', unit: 'inch', minValue: 10, maxValue: 24, sortOrder: 1 }],
        },
      },
      include: { sizeCharts: true, fields: true },
    });
    extraCutIds.push(cut.id);
    await prisma.sizeChartValue.createMany({
      data: [
        { chartId: cut.sizeCharts[0].id, fieldId: cut.fields[0].id, sizeCode: 'M', value: 15, sortOrder: 0 },
        { chartId: cut.sizeCharts[0].id, fieldId: cut.fields[0].id, sizeCode: 'L', value: 17, sortOrder: 1 },
      ],
    });
    const product = await prisma.product.create({
      data: {
        slug: `cart-pc-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        nameEn: 'Cart Priced Abaya',
        nameAr: 'عباية مسعّرة',
        descriptionEn: 'Cut piece',
        descriptionAr: 'قطعة',
        priceBhd: basePrice,
        sku: `CART-PC-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'ACTIVE',
        cutId: cut.id,
        variants: {
          create: [
            { size: 'M', colorEn: 'Black', priceBhd: overrides.M ?? null, stock: 5, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 0 },
            { size: 'L', colorEn: 'Black', priceBhd: overrides.L ?? null, stock: 3, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 1 },
          ],
        },
      },
    });
    extraProductIds.push(product.id);
    return product.id;
  }

  it('prices a mixed priced/unpriced multi-piece cart line from each piece, matching the order rule', async () => {
    cookieJar.clear();
    const productId = await makePricedCutProduct(80, { M: 100, L: null });

    const cart = await addToCart(productId, null, 3, [
      { mode: 'READY', sizeCode: 'M' },
      { mode: 'READY', sizeCode: 'L' },
      { mode: 'CUSTOM', values: { shoulder_width: 16 } },
    ]);

    expect(cart.items).toHaveLength(1);
    const line = cart.items[0];
    expect(line.pieces).toHaveLength(3);
    // Each piece's effective price: 100 (M override) + 80 (L base) + 80 (custom base).
    expect(line.lineTotalBhd).toBe(260);
    expect(cart.subtotalBhd).toBe(260);
    // The displayed line total equals the sum of the piece prices shown.
    const pieceSum = line.pieces.reduce((s, p) => s + (p.unitPriceBhd ?? 80), 0);
    expect(line.lineTotalBhd).toBe(pieceSum);
  });

  it('applies a variant override per piece when quantity exceeds one', async () => {
    cookieJar.clear();
    const productId = await makePricedCutProduct(80, { M: 100, L: null });

    const cart = await addToCart(productId, null, 2, [
      { mode: 'READY', sizeCode: 'M' },
      { mode: 'READY', sizeCode: 'M' },
    ]);

    expect(cart.items[0].lineTotalBhd).toBe(200); // 100 + 100
    expect(cart.subtotalBhd).toBe(200);
  });

  it('re-reads the cart view with the same per-piece total after the pieces are stored', async () => {
    cookieJar.clear();
    const productId = await makePricedCutProduct(80, { M: 100, L: null });
    await addToCart(productId, null, 3, [
      { mode: 'READY', sizeCode: 'M' },
      { mode: 'READY', sizeCode: 'L' },
      { mode: 'CUSTOM', values: { shoulder_width: 16 } },
    ]);

    // The cookie was minted on add; a fresh read must reproduce the total.
    expect(cookieJar.has(CART_COOKIE)).toBe(true);
    const view = await getCartView();
    expect(view.items).toHaveLength(1);
    expect(view.items[0].lineTotalBhd).toBe(260);
    expect(view.subtotalBhd).toBe(260);
  });

  it('rejects a cart add whose piece size the cut does not offer', async () => {
    cookieJar.clear();
    const productId = await makePricedCutProduct(80, { M: 100, L: null });
    await expect(
      addToCart(productId, null, 1, [{ mode: 'READY', sizeCode: 'XXL' }]),
    ).rejects.toThrow(/MEASUREMENT_INVALID/);
  });
});
