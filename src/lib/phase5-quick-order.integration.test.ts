import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  createQuickOrderLink,
  resolveQuickOrderLink,
  revokeQuickOrderLink,
  recordQuickOrderLinkOpen,
  listQuickOrderLinks,
  toQuickOrderProduct,
} from '@/lib/quick-order-db';
import { createOrder, resolveCartLines, type ResolvedLine, CheckoutError } from '@/lib/orders';
import { hashToken } from '@/lib/tokens';
import { isValidTokenFormat } from '@/lib/quick-order';
import type { CheckoutInput } from '@/lib/validation';

/**
 * Database-backed integration tests for the Phase 5 Quick Order link domain.
 * They run against the real Prisma/MySQL schema — no mocks — and are skipped
 * unless RUN_DB_TESTS=1.
 */
const enabled = process.env.RUN_DB_TESTS === '1';
const maybe = enabled ? describe : describe.skip;

let suffix: string;
let productId: string;
let variantId: string;
let archivedProductId: string;
let cutProductId: string;
let cutVariantId: string;
const createdLinkIds: string[] = [];
const createdOrderIds: string[] = [];
const extraProductIds: string[] = [];
const extraCutIds: string[] = [];

const checkout: CheckoutInput = {
  fullName: 'Quick Customer',
  email: 'quick-it@example.com',
  phone: '+97333000000',
  country: 'Bahrain',
  city: 'Manama',
  area: '',
  address: 'Test address 1',
  building: '',
  unit: '',
  notes: '',
  paymentMethod: 'COD',
  shippingMethodCode: '',
  couponCode: '',
  acceptsTerms: true,
};

maybe('phase 5 quick order links (database)', () => {
  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [active, archived] = await Promise.all([
      prisma.product.create({
        data: {
          slug: `it5-active-${suffix}`,
          nameEn: 'IT5 Abaya',
          nameAr: 'عباية IT5',
          subtitleEn: 'Signature piece',
          subtitleAr: 'قطعة مميزة',
          descriptionEn: 'A piece',
          descriptionAr: 'قطعة',
          priceBhd: 75,
          sku: `IT5-ACTIVE-${suffix}`,
          status: 'ACTIVE',
          madeToOrder: false,
          variants: {
            create: [{ size: 'M', colorEn: 'Black', stock: 5, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 0 }],
          },
        },
        include: { variants: true },
      }),
      prisma.product.create({
        data: {
          slug: `it5-archived-${suffix}`,
          nameEn: 'IT5 Archived',
          nameAr: 'مؤرشف',
          descriptionEn: 'x',
          descriptionAr: 'س',
          priceBhd: 40,
          sku: `IT5-ARCH-${suffix}`,
          status: 'ARCHIVED',
        },
      }),
    ]);
    productId = active.id;
    variantId = active.variants[0].id;
    archivedProductId = archived.id;

    // A cut (made-to-measure) product that is also sold in ready sizes, so the
    // size requirement and stock enforcement for cut products can be exercised.
    const cut = await prisma.productCut.create({
      data: {
        code: `IT5CUT-${suffix}`,
        nameEn: 'IT5 Cut',
        nameAr: 'قَصّة IT5',
        isActive: true,
        sortOrder: 901,
        sizeCharts: { create: { unit: 'inch' } },
        fields: {
          create: [{ key: 'shoulder_width', labelEn: 'Shoulder', labelAr: 'الكتف', unit: 'inch', minValue: 10, maxValue: 24, sortOrder: 1 }],
        },
      },
    });
    extraCutIds.push(cut.id);
    const cutProduct = await prisma.product.create({
      data: {
        slug: `it5-cut-${suffix}`,
        nameEn: 'IT5 Cut Abaya',
        nameAr: 'عباية قص IT5',
        descriptionEn: 'Cut piece',
        descriptionAr: 'قطعة',
        priceBhd: 90,
        sku: `IT5-CUT-${suffix}`,
        status: 'ACTIVE',
        cutId: cut.id,
        variants: {
          create: [{ size: 'M', colorEn: 'Black', stock: 2, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 0 }],
        },
      },
      include: { variants: true },
    });
    cutProductId = cutProduct.id;
    cutVariantId = cutProduct.variants[0].id;
  });

  afterAll(async () => {
    if (createdOrderIds.length) {
      // Orders cascade to items, payments, events and quick-order links.
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await prisma.quickOrderLink.deleteMany({ where: { id: { in: createdLinkIds } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId, archivedProductId, cutProductId, ...extraProductIds].filter(Boolean) } } });
    await prisma.productCut.deleteMany({ where: { id: { in: extraCutIds } } });
  });

  /** A resolved line matching the fixture product, without touching cart/cookies. */
  function line(qty = 1): ResolvedLine {
    return {
      productId,
      variantId,
      quantity: qty,
      unitPriceBhd: 75,
      productName: 'IT5 Abaya',
      variantLabel: 'M / Black',
      sku: `IT5-ACTIVE-${suffix}`,
      imageUrl: null,
      stockStatus: 'IN_STOCK',
      cutId: null,
      lineTotalBhd: 75 * qty,
      pieces: [],
    };
  }

  async function newLink(opts: { product?: string; ttlDays?: number } = {}) {
    const created = await createQuickOrderLink({
      productId: opts.product ?? productId,
      source: 'WHATSAPP',
      createdById: null,
      customerPhone: '+97333000000',
      ttlDays: opts.ttlDays,
    });
    createdLinkIds.push(created.link.id);
    return created;
  }

  it('stores only the token hash, never the raw token', async () => {
    const created = await newLink();
    expect(isValidTokenFormat(created.rawToken)).toBe(true);
    expect(created.url).toContain(`/en/q/${created.rawToken}`);

    const row = await prisma.quickOrderLink.findUnique({ where: { id: created.link.id } });
    expect(row?.tokenHash).toBe(hashToken(created.rawToken));
    expect(row?.tokenHash).not.toBe(created.rawToken);
    expect(row?.tokenLast4).toBe(created.rawToken.slice(-4));
    expect(created.link.state).toBe('GENERATED');
    expect(created.link.usable).toBe(true);
  });

  it('resolves a valid token to its live product and rejects unknown ones', async () => {
    const created = await newLink();
    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.data.product.id).toBe(productId);

    expect((await resolveQuickOrderLink('not-a-real-token-value-000000')).ok).toBe(false);
    expect((await resolveQuickOrderLink('too-short')).ok).toBe(false);
  });

  it('rejects a link whose product is no longer storefront-visible', async () => {
    // A link is only ever minted for a live product; visibility is re-checked
    // at open time, so archiving the product afterwards must make it fail.
    const live = await prisma.product.create({
      data: {
        slug: `it5-temp-${suffix}`,
        nameEn: 'IT5 Temp',
        nameAr: 'مؤقت',
        descriptionEn: 'x',
        descriptionAr: 'س',
        priceBhd: 10,
        sku: `IT5-TEMP-${suffix}`,
        status: 'ACTIVE',
      },
    });
    extraProductIds.push(live.id);
    const created = await createQuickOrderLink({
      productId: live.id,
      source: 'WHATSAPP',
      createdById: null,
    });
    createdLinkIds.push(created.link.id);
    await prisma.product.update({ where: { id: live.id }, data: { status: 'ARCHIVED' } });

    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe('UNAVAILABLE');
  });

  it('refuses to mint a link for a non-visible product', async () => {
    await expect(
      createQuickOrderLink({ productId: archivedProductId, source: 'WHATSAPP', createdById: null }),
    ).rejects.toThrow('PRODUCT_UNAVAILABLE');
  });

  it('revoking a link makes it unresolvable and is idempotent', async () => {
    const created = await newLink();
    expect(await revokeQuickOrderLink(created.link.id)).toBe(true);
    expect(await revokeQuickOrderLink(created.link.id)).toBe(false);
    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe('REVOKED');
  });

  it('reports an expired link as EXPIRED', async () => {
    const created = await newLink();
    await prisma.quickOrderLink.update({
      where: { id: created.link.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe('EXPIRED');
  });

  it('counts opens without rewriting the first-open timestamp', async () => {
    const created = await newLink();
    await recordQuickOrderLinkOpen(created.link.id);
    const first = await prisma.quickOrderLink.findUnique({ where: { id: created.link.id } });
    await recordQuickOrderLinkOpen(created.link.id);
    const second = await prisma.quickOrderLink.findUnique({ where: { id: created.link.id } });
    expect(second?.openCount).toBe(2);
    expect(second?.openedAt?.getTime()).toBe(first?.openedAt?.getTime());
  });

  it('maps the product into a localized, serializable view', async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: {
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
        cut: { include: { sizeCharts: { include: { values: { include: { field: true } } } }, fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    const en = await toQuickOrderProduct(product, 'en');
    const ar = await toQuickOrderProduct(product, 'ar');
    expect(en.name).toBe('IT5 Abaya');
    expect(ar.name).toBe('عباية IT5');
    expect(en.priceBhd).toBe(75);
    expect(en.variants[0].stockStatus).toBe('IN_STOCK');
  });

  it('creates a QUICK_ORDER order, claims the link and decrements stock', async () => {
    const created = await newLink();
    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const order = await createOrder({
      checkout,
      lines: [line()],
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      quickOrder: { linkId: resolved.data.link.id, source: 'WHATSAPP' },
    });
    createdOrderIds.push(order.orderId);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.orderId },
      include: { items: true },
    });
    expect(stored.channel).toBe('QUICK_ORDER');
    expect(stored.quickOrderSource).toBe('WHATSAPP');
    expect(stored.items).toHaveLength(1);

    const linkRow = await prisma.quickOrderLink.findUniqueOrThrow({ where: { id: created.link.id } });
    expect(linkRow.orderId).toBe(order.orderId);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stock).toBe(4);
  });

  it('refuses to reuse a link for a second order (atomic claim)', async () => {
    const created = await newLink();
    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const first = await createOrder({
      checkout,
      lines: [line()],
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      quickOrder: { linkId: resolved.data.link.id, source: 'WHATSAPP' },
    });
    createdOrderIds.push(first.orderId);

    // A second attempt must not create an order. Assert on the second call's
    // own idempotency key rather than a global count, which other test files
    // mutate in parallel.
    const secondKey = `it5-claim-second-${suffix}`;
    await expect(
      createOrder({
        checkout,
        lines: [line()],
        customerId: null,
        locale: 'en',
        currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
        shippingBhd: 0,
        coupon: null,
        baseUrl: 'https://attention.test',
        idempotencyKey: secondKey,
        quickOrder: { linkId: resolved.data.link.id, source: 'WHATSAPP' },
      }),
    ).rejects.toMatchObject({ code: 'LINK_USED' });

    expect(await prisma.order.findUnique({ where: { idempotencyKey: secondKey } })).toBeNull();
    const linkAfter = await prisma.quickOrderLink.findUniqueOrThrow({ where: { id: created.link.id } });
    expect(linkAfter.orderId).toBe(first.orderId);
  });

  it('lists links most-recent first and filters by product', async () => {
    const links = await listQuickOrderLinks({ productId, take: 50 });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.product.id === productId)).toBe(true);
    for (let i = 1; i < links.length; i++) {
      expect(new Date(links[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(links[i].createdAt).getTime());
    }
  });

  it('applies a staff manual discount as a first-class amount without rewriting line prices', async () => {
    const order = await createOrder({
      checkout,
      lines: [line(2)],
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 2,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
      manualDiscountBhd: 25,
    });
    createdOrderIds.push(order.orderId);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId }, include: { items: true } });
    // subtotal 150 + shipping 2 - discount 25 = 127
    expect(Number(stored.subtotalBhd)).toBe(150);
    expect(Number(stored.discountBhd)).toBe(25);
    expect(Number(stored.shippingBhd)).toBe(2);
    expect(Number(stored.totalBhd)).toBe(127);
    expect(stored.channel).toBe('QUICK_ORDER');
    // The per-line snapshot is untouched — only the order-level discount moved.
    expect(Number(stored.items[0].lineTotalBhd)).toBe(150);
    expect(order.totalBhd).toBe(127);
  });

  it('clamps a manual discount to the subtotal so the total never goes negative', async () => {
    const order = await createOrder({
      checkout,
      lines: [line()],
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
      manualDiscountBhd: 9999,
    });
    createdOrderIds.push(order.orderId);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(Number(stored.discountBhd)).toBe(75);
    expect(Number(stored.totalBhd)).toBe(0);
  });

  it('keeps CheckoutError code LINK_USED distinct from availability errors', () => {
    expect(new CheckoutError('x', 'LINK_USED').code).toBe('LINK_USED');
  });

  it('requires a size for a cut product sold in ready sizes, then enforces its stock', async () => {
    // No size: refused rather than falling through to an unpriced, unstocked line.
    await expect(
      resolveCartLines([{ productId: cutProductId, variantId: null, quantity: 1 }], { requireMeasurements: false }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });

    // With a size the line resolves to the size-matched variant and its stock.
    const lines = await resolveCartLines(
      [{ productId: cutProductId, variantId: cutVariantId, quantity: 1 }],
      { requireMeasurements: false },
    );
    expect(lines[0].variantId).toBe(cutVariantId);
    expect(lines[0].pieces[0].sizeCode).toBe('M');

    const order = await createOrder({
      checkout,
      lines,
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
    });
    createdOrderIds.push(order.orderId);
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: cutVariantId } });
    expect(variant.stock).toBe(1);
  });

  // ── Phase 5 completion: multi-piece measurements ────────────────────────

  /** A cut product sold in ready sizes with a full size chart, for multi-piece tests. */
  async function makeMultiPieceProduct() {
    const cut = await prisma.productCut.create({
      data: {
        code: `IT5MP-${suffix}-${Math.random().toString(36).slice(2, 6)}`,
        nameEn: 'IT5 Multi Cut',
        nameAr: 'قَصّة متعددة',
        isActive: true,
        sortOrder: 902,
        sizeCharts: { create: { unit: 'inch' } },
        fields: {
          create: [{ key: 'shoulder_width', labelEn: 'Shoulder', labelAr: 'الكتف', unit: 'inch', minValue: 10, maxValue: 24, sortOrder: 1 }],
        },
      },
      include: { sizeCharts: true, fields: true },
    });
    extraCutIds.push(cut.id);
    const chartId = cut.sizeCharts[0].id;
    const fieldId = cut.fields[0].id;
    await prisma.sizeChartValue.createMany({
      data: [
        { chartId, fieldId, sizeCode: 'M', value: 15 },
        { chartId, fieldId, sizeCode: 'L', value: 17 },
      ],
    });
    const product = await prisma.product.create({
      data: {
        slug: `it5-mp-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        nameEn: 'IT5 Multi Abaya',
        nameAr: 'عباية متعددة',
        descriptionEn: 'Cut piece',
        descriptionAr: 'قطعة',
        priceBhd: 80,
        sku: `IT5-MP-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'ACTIVE',
        cutId: cut.id,
        variants: {
          create: [
            { size: 'M', colorEn: 'Black', stock: 5, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 0 },
            { size: 'L', colorEn: 'Black', stock: 3, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 1 },
          ],
        },
      },
      include: { variants: true },
    });
    extraProductIds.push(product.id);
    const m = product.variants.find((v) => v.size === 'M')!;
    const l = product.variants.find((v) => v.size === 'L')!;
    return { productId: product.id, mId: m.id, lId: l.id, cutId: cut.id };
  }

  it('resolves a multi-piece line: READY sizes become their own variant, stock decremented per variant', async () => {
    const mp = await makeMultiPieceProduct();
    const lines = await resolveCartLines(
      [{ productId: mp.productId, variantId: null, quantity: 3 }],
      {
        requireMeasurements: false,
        piecesByProduct: {
          [mp.productId]: [
            { mode: 'READY', sizeCode: 'M' },
            { mode: 'READY', sizeCode: 'M' },
            { mode: 'READY', sizeCode: 'L' },
          ],
        },
      },
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].pieces.map((p) => p.sizeCode)).toEqual(['M', 'M', 'L']);
    expect(lines[0].pieces.map((p) => p.variantId)).toEqual([mp.mId, mp.mId, mp.lId]);
    // Same price per size → no per-piece pricing override.
    expect(lines[0].lineTotalBhd).toBe(240);

    const order = await createOrder({
      checkout,
      lines,
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
    });
    createdOrderIds.push(order.orderId);

    const items = await prisma.orderItem.findMany({ where: { orderId: order.orderId }, orderBy: { sizeCode: 'asc' } });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.quantity)).toEqual([1, 1, 1]);
    expect(items.filter((i) => i.sizeCode === 'M')).toHaveLength(2);
    expect(items.filter((i) => i.sizeCode === 'L')).toHaveLength(1);
    expect(items.every((i) => i.variantId === mp.mId || i.variantId === mp.lId)).toBe(true);

    const [m, l] = await Promise.all([
      prisma.productVariant.findUniqueOrThrow({ where: { id: mp.mId } }),
      prisma.productVariant.findUniqueOrThrow({ where: { id: mp.lId } }),
    ]);
    expect(m.stock).toBe(3); // 5 - 2
    expect(l.stock).toBe(2); // 3 - 1

    const movements = await prisma.inventoryMovement.findMany({ where: { orderId: order.orderId } });
    expect(movements.map((x) => [x.variantId, x.quantity]).sort()).toEqual(
      [
        [mp.mId, -2],
        [mp.lId, -1],
      ].sort(),
    );
  });

  it('resolves mixed READY and CUSTOM pieces with independent immutable snapshots', async () => {
    const mp = await makeMultiPieceProduct();
    const lines = await resolveCartLines(
      [{ productId: mp.productId, variantId: null, quantity: 2 }],
      {
        requireMeasurements: false,
        piecesByProduct: {
          [mp.productId]: [
            { mode: 'READY', sizeCode: 'M' },
            { mode: 'CUSTOM', values: { shoulder_width: 16 } },
          ],
        },
      },
    );
    expect(lines[0].pieces).toHaveLength(2);
    expect(lines[0].pieces[0].measurementKind).toBe('READY');
    expect(lines[0].pieces[1].measurementKind).toBe('CUSTOM');
    expect(lines[0].pieces[0].variantId).toBe(mp.mId);
    expect(lines[0].pieces[1].variantId).toBeNull();

    const order = await createOrder({
      checkout,
      lines,
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
    });
    createdOrderIds.push(order.orderId);

    const items = await prisma.orderItem.findMany({ where: { orderId: order.orderId }, orderBy: { sizeCode: 'asc' } });
    expect(items).toHaveLength(2);
    const custom = items.find((i) => i.measurementKind === 'CUSTOM')!;
    const ready = items.find((i) => i.measurementKind === 'READY')!;
    expect(ready.sizeCode).toBe('M');
    expect((custom.measurementSnapshot as { values: Record<string, number> }).values.shoulder_width).toBe(16);
  });

  it('rejects a piece whose size the cut does not offer or whose value is out of range', async () => {
    const mp = await makeMultiPieceProduct();
    await expect(
      resolveCartLines([{ productId: mp.productId, variantId: null, quantity: 1 }], {
        requireMeasurements: false,
        piecesByProduct: { [mp.productId]: [{ mode: 'READY', sizeCode: 'XXL' }] },
      }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });

    await expect(
      resolveCartLines([{ productId: mp.productId, variantId: null, quantity: 1 }], {
        requireMeasurements: false,
        piecesByProduct: { [mp.productId]: [{ mode: 'CUSTOM', values: { shoulder_width: 99 } }] },
      }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('rejects a piece count that does not match the ordered quantity', async () => {
    const mp = await makeMultiPieceProduct();
    await expect(
      resolveCartLines([{ productId: mp.productId, variantId: null, quantity: 3 }], {
        requireMeasurements: false,
        piecesByProduct: { [mp.productId]: [{ mode: 'READY', sizeCode: 'M' }] },
      }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  // ── Phase 5 completion: idempotent retry ────────────────────────────────

  /** A fresh simple product with its own stock and line builder, so tests never
   * contend over a shared variant's stock. */
  async function makeSimpleProduct() {
    const p = await prisma.product.create({
      data: {
        slug: `it5-simple-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        nameEn: 'IT5 Simple Abaya',
        nameAr: 'عباية بسيطة',
        descriptionEn: 'x',
        descriptionAr: 'س',
        priceBhd: 75,
        sku: `IT5-SIMPLE-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'ACTIVE',
        variants: { create: [{ size: 'M', colorEn: 'Black', stock: 5, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 0 }] },
      },
      include: { variants: true },
    });
    extraProductIds.push(p.id);
    const vid = p.variants[0].id;
    const build = (qty = 1): ResolvedLine => ({
      productId: p.id,
      variantId: vid,
      quantity: qty,
      unitPriceBhd: 75,
      productName: 'IT5 Simple Abaya',
      variantLabel: 'M / Black',
      sku: p.sku,
      imageUrl: null,
      stockStatus: 'IN_STOCK',
      cutId: null,
      lineTotalBhd: 75 * qty,
      pieces: [],
    });
    return { productId: p.id, variantId: vid, line: build };
  }

  it('replays the canonical order for a repeated idempotency key + identical fingerprint', async () => {
    const { variantId: vid, line: makeLine } = await makeSimpleProduct();
    const key = `it5-idem-${suffix}`;
    const base = {
      checkout,
      lines: [makeLine(1)],
      customerId: null,
      locale: 'en' as const,
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      idempotencyKey: key,
      idempotencyFingerprint: 'fp-same',
    };
    const first = await createOrder(base);
    createdOrderIds.push(first.orderId);
    const stockAfterFirst = (await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })).stock;
    const second = await createOrder({ ...base, lines: [makeLine(1)] });

    expect(second.orderId).toBe(first.orderId);
    expect(second.replayed).toBe(true);

    const orders = await prisma.order.findMany({ where: { idempotencyKey: key } });
    expect(orders).toHaveLength(1);
    // The retry must not have consumed a second unit of stock.
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } });
    expect(variant.stock).toBe(stockAfterFirst);
  });

  it('rejects the same idempotency key when the commercial payload differs', async () => {
    const { line: makeLine } = await makeSimpleProduct();
    const key = `it5-idem-diff-${suffix}`;
    const first = await createOrder({
      checkout,
      lines: [makeLine(1)],
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      idempotencyKey: key,
      idempotencyFingerprint: 'fp-a',
    });
    createdOrderIds.push(first.orderId);

    await expect(
      createOrder({
        checkout,
        lines: [makeLine(1)],
        customerId: null,
        locale: 'en',
        currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
        shippingBhd: 0,
        coupon: null,
        baseUrl: 'https://attention.test',
        idempotencyKey: key,
        idempotencyFingerprint: 'fp-b',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE' });

    const orders = await prisma.order.findMany({ where: { idempotencyKey: key } });
    expect(orders).toHaveLength(1);
  });

  // ── Phase 5 closure: mixed READY+CUSTOM, pricing, concurrency ───────────

  /**
   * A cut product sold in ready sizes where one size carries an explicit price
   * override and the other inherits the product base. Lets per-piece pricing be
   * asserted across a mix of priced/unpriced variants.
   */
  async function makePricedCutProduct(basePrice: number, overrides: Record<string, number | null>) {
    const cut = await prisma.productCut.create({
      data: {
        code: `IT5PC-${suffix}-${Math.random().toString(36).slice(2, 6)}`,
        nameEn: 'IT5 Priced Cut',
        nameAr: 'قَصّة مسعّرة',
        isActive: true,
        sortOrder: 903,
        sizeCharts: { create: { unit: 'inch' } },
        fields: {
          create: [{ key: 'shoulder_width', labelEn: 'Shoulder', labelAr: 'الكتف', unit: 'inch', minValue: 10, maxValue: 24, sortOrder: 1 }],
        },
      },
      include: { sizeCharts: true, fields: true },
    });
    extraCutIds.push(cut.id);
    const chartId = cut.sizeCharts[0].id;
    const fieldId = cut.fields[0].id;
    await prisma.sizeChartValue.createMany({
      data: [
        { chartId, fieldId, sizeCode: 'M', value: 15, sortOrder: 0 },
        { chartId, fieldId, sizeCode: 'L', value: 17, sortOrder: 1 },
      ],
    });
    const product = await prisma.product.create({
      data: {
        slug: `it5-pc-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        nameEn: 'IT5 Priced Abaya',
        nameAr: 'عباية مسعّرة',
        descriptionEn: 'Cut piece',
        descriptionAr: 'قطعة',
        priceBhd: basePrice,
        sku: `IT5-PC-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'ACTIVE',
        cutId: cut.id,
        variants: {
          create: [
            { size: 'M', colorEn: 'Black', priceBhd: overrides.M ?? null, stock: 5, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 0 },
            { size: 'L', colorEn: 'Black', priceBhd: overrides.L ?? null, stock: 3, stockStatus: 'IN_STOCK', isActive: true, sortOrder: 1 },
          ],
        },
      },
      include: { variants: true },
    });
    extraProductIds.push(product.id);
    return {
      productId: product.id,
      cutId: cut.id,
      chartId,
      fieldId,
      mId: product.variants.find((v) => v.size === 'M')!.id,
      lId: product.variants.find((v) => v.size === 'L')!.id,
    };
  }

  it('orders three mixed pieces (READY / CUSTOM / different READY) with independent snapshots, correct variants, per-piece prices and stock', async () => {
    // Base 80; M overrides to 100; L and the CUSTOM piece inherit the base.
    const pc = await makePricedCutProduct(80, { M: 100, L: null });
    const lines = await resolveCartLines(
      [{ productId: pc.productId, variantId: null, quantity: 3 }],
      {
        requireMeasurements: false,
        piecesByProduct: {
          [pc.productId]: [
            { mode: 'READY', sizeCode: 'M' },
            { mode: 'CUSTOM', values: { shoulder_width: 16 } },
            { mode: 'READY', sizeCode: 'L' },
          ],
        },
      },
    );

    // Line total is the sum of each piece's effective price: 100 + 80 + 80.
    expect(lines).toHaveLength(1);
    expect(lines[0].lineTotalBhd).toBe(260);
    expect(lines[0].pieces.map((p) => p.sizeCode)).toEqual(['M', null, 'L']);
    expect(lines[0].pieces.map((p) => p.variantId)).toEqual([pc.mId, null, pc.lId]);

    const order = await createOrder({
      checkout,
      lines,
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
    });
    createdOrderIds.push(order.orderId);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId }, include: { items: true } });
    expect(stored.items).toHaveLength(3);
    // The order subtotal equals the sum of its item rows, and each piece price
    // is the variant override or the product base — never a representative price
    // multiplied by quantity.
    expect(Number(stored.subtotalBhd)).toBe(260);
    expect(Number(stored.totalBhd)).toBe(260);
    const bySize = new Map(stored.items.map((i) => [i.sizeCode, i]));
    expect(Number(bySize.get('M')!.unitPriceBhd)).toBe(100);
    expect(Number(bySize.get('L')!.unitPriceBhd)).toBe(80);
    expect(Number(bySize.get('M')!.lineTotalBhd)).toBe(100);
    expect(Number(bySize.get('L')!.lineTotalBhd)).toBe(80);
    expect(stored.items.reduce((s, i) => s + Number(i.lineTotalBhd), 0)).toBe(Number(stored.subtotalBhd));
    // Variants: READY pieces carry their size-matched variant, CUSTOM carries none.
    expect(bySize.get('M')!.variantId).toBe(pc.mId);
    expect(bySize.get('L')!.variantId).toBe(pc.lId);
    expect(stored.items.find((i) => i.measurementKind === 'CUSTOM')!.variantId).toBeNull();

    // Three independent immutable snapshots: two READY (chart values) + one CUSTOM.
    const readyM = bySize.get('M')!.measurementSnapshot as { kind: string; sizeCode: string; values: Record<string, number> };
    const readyL = bySize.get('L')!.measurementSnapshot as { kind: string; sizeCode: string; values: Record<string, number> };
    const custom = stored.items.find((i) => i.measurementKind === 'CUSTOM')!.measurementSnapshot as { kind: string; values: Record<string, number> };
    expect(readyM.kind).toBe('READY');
    expect(readyM.sizeCode).toBe('M');
    expect(readyM.values.shoulder_width).toBe(15);
    expect(readyL.kind).toBe('READY');
    expect(readyL.sizeCode).toBe('L');
    expect(readyL.values.shoulder_width).toBe(17);
    expect(custom.kind).toBe('CUSTOM');
    expect(custom.values.shoulder_width).toBe(16);

    // Inventory: one unit deducted from each READY variant, none from CUSTOM.
    const [m, l] = await Promise.all([
      prisma.productVariant.findUniqueOrThrow({ where: { id: pc.mId } }),
      prisma.productVariant.findUniqueOrThrow({ where: { id: pc.lId } }),
    ]);
    expect(m.stock).toBe(4); // 5 - 1
    expect(l.stock).toBe(2); // 3 - 1
    const movements = await prisma.inventoryMovement.findMany({ where: { orderId: order.orderId } });
    expect(movements.map((x) => [x.variantId, x.quantity]).sort()).toEqual([[pc.mId, -1], [pc.lId, -1]].sort());

    // Editing the live size guide afterwards must not rewrite the snapshot.
    await prisma.sizeChartValue.updateMany({ where: { chartId: pc.chartId, fieldId: pc.fieldId, sizeCode: 'M' }, data: { value: 99 } });
    await prisma.measurementField.update({ where: { id: pc.fieldId }, data: { labelEn: 'Renamed' } });
    const reread = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId, sizeCode: 'M' } });
    const rereadSnap = reread.measurementSnapshot as { values: Record<string, number>; fieldLabels: Record<string, { en: string }> };
    expect(rereadSnap.values.shoulder_width).toBe(15);
    expect(rereadSnap.fieldLabels.shoulder_width.en).toBe('Shoulder');
  });

  it('keeps the order total equal to the sum of its item rows across base, override, mixed, quantity and manual discount', async () => {
    const pc = await makePricedCutProduct(80, { M: 100, L: null });

    // (a) quantity > 1, both READY pieces the same size → override applies per piece.
    const qtyLines = await resolveCartLines(
      [{ productId: pc.productId, variantId: null, quantity: 2 }],
      { requireMeasurements: false, piecesByProduct: { [pc.productId]: [{ mode: 'READY', sizeCode: 'M' }, { mode: 'READY', sizeCode: 'M' }] } },
    );
    expect(qtyLines[0].lineTotalBhd).toBe(200); // 100 + 100

    // (b) mixed priced/unpriced with a manual staff discount.
    const mixedLines = await resolveCartLines(
      [{ productId: pc.productId, variantId: null, quantity: 3 }],
      {
        requireMeasurements: false,
        piecesByProduct: {
          [pc.productId]: [
            { mode: 'READY', sizeCode: 'M' },
            { mode: 'READY', sizeCode: 'L' },
            { mode: 'CUSTOM', values: { shoulder_width: 16 } },
          ],
        },
      },
    );
    expect(mixedLines[0].lineTotalBhd).toBe(260); // 100 + 80 + 80

    const order = await createOrder({
      checkout,
      lines: mixedLines,
      customerId: null,
      locale: 'en',
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 3,
      coupon: null,
      baseUrl: 'https://attention.test',
      channel: 'QUICK_ORDER',
      manualDiscountBhd: 40,
    });
    createdOrderIds.push(order.orderId);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId }, include: { items: true } });
    const itemSum = stored.items.reduce((s, i) => s + Number(i.lineTotalBhd), 0);
    expect(Number(stored.subtotalBhd)).toBe(itemSum);
    expect(Number(stored.subtotalBhd)).toBe(260);
    expect(Number(stored.discountBhd)).toBe(40);
    expect(Number(stored.shippingBhd)).toBe(3);
    // Server-authoritative total: subtotal - discount + shipping.
    expect(Number(stored.totalBhd)).toBe(223);
    expect(order.totalBhd).toBe(223);
    // Line snapshots stay truthful — the discount is order-level, not baked in.
    expect(itemSum).toBe(260);
  });

  it('admits exactly one order when two different idempotency keys submit concurrently against the same link', async () => {
    const { productId: pId, variantId: vid, line: makeLine } = await makeSimpleProduct();
    const created = await newLink({ product: pId });
    const resolved = await resolveQuickOrderLink(created.rawToken);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const linkId = resolved.data.link.id;

    const base = {
      checkout,
      customerId: null,
      locale: 'en' as const,
      currency: { code: 'BHD', rateToBhd: 1, decimals: 3 },
      shippingBhd: 0,
      coupon: null,
      baseUrl: 'https://attention.test',
      quickOrder: { linkId, source: 'WHATSAPP' as const },
    };

    const results = await Promise.allSettled([
      createOrder({ ...base, lines: [makeLine(1)], idempotencyKey: `it5-conc-a-${suffix}` }),
      createOrder({ ...base, lines: [makeLine(1)], idempotencyKey: `it5-conc-b-${suffix}` }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ orderId: string }>[];
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as { code?: string }).code).toBe('LINK_USED');

    const winner = fulfilled[0].value.orderId;
    createdOrderIds.push(winner);
    // Exactly one commercial order, one link claim and one stock deduction.
    expect(await prisma.order.count({ where: { idempotencyKey: { in: [`it5-conc-a-${suffix}`, `it5-conc-b-${suffix}`] } } })).toBe(1);
    const linkRow = await prisma.quickOrderLink.findUniqueOrThrow({ where: { id: linkId } });
    expect(linkRow.orderId).toBe(winner);
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } });
    expect(variant.stock).toBe(4); // 5 - 1, deducted once
  });
});
