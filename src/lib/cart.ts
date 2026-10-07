import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import { getCurrentUser } from './auth';
import { measurementKindOf, isMeasurementSnapshot, type MeasurementSnapshot } from './order-measurements';
import { getCutForProduct } from './size-guide-db';
import { configKeyFor, validatePieces, type PieceInput } from './measurement-plan';
import { STOREFRONT_PRODUCT_STATUSES } from './catalog';

export const CART_COOKIE = 'att_cart';
export const WISHLIST_COOKIE = 'att_wishlist';
const YEAR = 60 * 60 * 24 * 365;

export interface CartPieceView {
  id: string;
  pieceIndex: number;
  kind: 'READY' | 'CUSTOM' | null;
  sizeCode: string | null;
  /** Variant price for a READY piece; null when the product base price applies. */
  unitPriceBhd: number | null;
  /** Localisable rows rendered under the line in cart/checkout. */
  measurements: { key: string; labelEn: string; labelAr: string; value: number; unit: string }[];
}

export interface CartLineView {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  nameEn: string;
  nameAr: string;
  slug: string;
  image: string | null;
  size: string | null;
  colorEn: string | null;
  colorAr: string | null;
  unitPriceBhd: number;
  lineTotalBhd: number;
  stockStatus: string;
  available: boolean;
  /** Empty for products without a cut (simple size/variant lines). */
  pieces: CartPieceView[];
  /** True when the line still needs its per-piece measurements before checkout. */
  needsMeasurements: boolean;
}

function simpleConfigKey(productId: string, variantId: string | null): string {
  return `${productId}|${variantId ?? '_'}`;
}

function snapshotToMeasurements(snapshot: MeasurementSnapshot, unit: string) {
  return Object.entries(snapshot.values).map(([key, value]) => {
    const labels = snapshot.fieldLabels[key] ?? { en: key, ar: key };
    return { key, labelEn: labels.en, labelAr: labels.ar, value, unit };
  });
}

async function readCartId(): Promise<{ cartId: string | null; createdToken?: string }> {
  const user = await getCurrentUser();
  const store = await cookies();

  if (user?.customerId) {
    let cart = await prisma.cart.findUnique({ where: { customerId: user.customerId } });
    if (!cart) cart = await prisma.cart.create({ data: { customerId: user.customerId } });
    return { cartId: cart.id };
  }

  const token = store.get(CART_COOKIE)?.value;
  if (token) {
    const cart = await prisma.cart.findUnique({ where: { token } });
    if (cart) return { cartId: cart.id };
  }
  const newToken = randomUUID();
  const cart = await prisma.cart.create({ data: { token: newToken } });
  return { cartId: cart.id, createdToken: newToken };
}

/** Ensures a cart row exists and the guest token cookie is set when needed. */
export async function ensureCart(): Promise<string> {
  const { cartId, createdToken } = await readCartId();
  if (createdToken) {
    const store = await cookies();
    store.set(CART_COOKIE, createdToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: YEAR,
    });
  }
  if (!cartId) throw new Error('CART_UNAVAILABLE');
  return cartId;
}

/** Read-only cart id resolution — never creates a cart just to render a count. */
export async function peekCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user?.customerId) {
    const cart = await prisma.cart.findUnique({ where: { customerId: user.customerId } });
    return cart?.id ?? null;
  }
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return null;
  const cart = await prisma.cart.findUnique({ where: { token } });
  return cart?.id ?? null;
}

export async function getCartView(): Promise<{ id: string | null; items: CartLineView[]; count: number; subtotalBhd: number }> {
  const cartId = await peekCartId();
  if (!cartId) return { id: null, items: [], count: 0, subtotalBhd: 0 };

  const items = await prisma.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: 'asc' },
    include: { pieces: { orderBy: { pieceIndex: 'asc' } } },
  });
  if (!items.length) return { id: cartId, items: [], count: 0, subtotalBhd: 0 };

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] } },
    include: {
      media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      variants: true,
      cut: { select: { id: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: CartLineView[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || !STOREFRONT_PRODUCT_STATUSES.includes(product.status)) continue;
    const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
    const unitPriceBhd = Number(variant?.priceBhd ?? product.priceBhd);

    let stockStatus: string;
    let available: boolean;
    if (item.variantId) {
      if (!variant || !variant.isActive) {
        stockStatus = 'OUT_OF_STOCK';
        available = false;
      } else {
        stockStatus = variant.stockStatus;
        available =
          variant.stockStatus !== 'OUT_OF_STOCK' &&
          (variant.stock > 0 || variant.stockStatus === 'PRE_ORDER');
      }
    } else {
      // Made-to-order pieces are producible on demand; ready-to-wear items
      // without variants carry no stock counter, so they stay available.
      stockStatus = product.madeToOrder ? 'PRE_ORDER' : 'IN_STOCK';
      available = true;
    }

    const pieces: CartPieceView[] = item.pieces
      .filter((p) => isMeasurementSnapshot(p.measurementSnapshot ?? p.sizeSnapshot))
      .map((p) => {
        const snapshot = (p.measurementSnapshot ?? p.sizeSnapshot) as unknown as MeasurementSnapshot;
        const pieceVariant = p.sizeCode ? product.variants.find((v) => v.size === p.sizeCode) : null;
        return {
          id: p.id,
          pieceIndex: p.pieceIndex,
          kind: measurementKindOf(snapshot),
          sizeCode: p.sizeCode,
          unitPriceBhd: pieceVariant?.priceBhd != null ? Number(pieceVariant.priceBhd) : null,
          measurements: snapshotToMeasurements(snapshot, snapshot.unit),
        };
      });

    // A cut product must have one complete measurement config per piece.
    const needsMeasurements =
      Boolean(product.cut?.id) && (pieces.length !== item.quantity || pieces.length === 0);

    // When a line carries one piece per ordered unit, price it as the sum of
    // each piece's effective price (variant override or product base) so
    // differently-priced sizes are charged accurately — matching the order. A
    // piece with no override falls back to the product base, never to the
    // representative variant price (which may itself be another piece's override).
    const productBaseBhd = Number(product.priceBhd);
    const perPiecePriced = pieces.length > 0 && pieces.length === item.quantity;
    const lineTotalBhd = perPiecePriced
      ? Math.round(pieces.reduce((sum, p) => sum + (p.unitPriceBhd ?? productBaseBhd), 0) * 1000) / 1000
      : Math.round(unitPriceBhd * item.quantity * 1000) / 1000;

    lines.push({
      id: item.id,
      productId: product.id,
      variantId: item.variantId,
      quantity: item.quantity,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      slug: product.slug,
      image: product.media[0]?.url ?? null,
      size: variant?.size ?? (pieces.length === 1 ? pieces[0].sizeCode : null),
      colorEn: variant?.colorEn ?? null,
      colorAr: variant?.colorAr ?? null,
      unitPriceBhd,
      lineTotalBhd,
      stockStatus,
      available: available && !needsMeasurements,
      pieces,
      needsMeasurements,
    });
  }
  // Unavailable pieces must not contribute to the subtotal the buyer sees.
  const purchasable = lines.filter((l) => l.available);
  const subtotalBhd = Math.round(purchasable.reduce((s, l) => s + l.lineTotalBhd, 0) * 1000) / 1000;
  return { id: cartId, items: lines, count: purchasable.reduce((s, l) => s + l.quantity, 0), subtotalBhd };
}

export async function addToCart(
  productId: string,
  variantId: string | null,
  quantity: number,
  pieces?: PieceInput[],
) {
  const cartId = await ensureCart();
  const product = await prisma.product.findFirst({
    where: { id: productId, status: { in: STOREFRONT_PRODUCT_STATUSES } },
    include: { variants: { where: { isActive: true } } },
  });
  if (!product) throw new Error('PRODUCT_UNAVAILABLE');

  const cut = await getCutForProduct(productId);
  if (cut) return addCutProduct(cartId, product, cut, quantity, pieces);

  if (product.variants.length > 0 && !variantId) throw new Error('VARIANT_REQUIRED');

  // Stock is enforced here as well as at checkout so an unavailable size can
  // never be added (or silently incremented past what is on hand).
  let maxQty = 20;
  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId && v.isActive);
    if (!variant) throw new Error('VARIANT_UNAVAILABLE');
    if (variant.stockStatus === 'OUT_OF_STOCK') throw new Error('VARIANT_UNAVAILABLE');
    if (variant.stockStatus === 'PRE_ORDER' || product.madeToOrder) {
      maxQty = 20;
    } else {
      if (variant.stock < 1) throw new Error('VARIANT_UNAVAILABLE');
      maxQty = Math.min(20, variant.stock);
    }
  }

  const configKey = simpleConfigKey(productId, variantId ?? null);
  const existing = await prisma.cartItem.findFirst({ where: { cartId, configKey } });
  const nextQty = Math.min(maxQty, (existing?.quantity ?? 0) + quantity);
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQty } });
  } else {
    await prisma.cartItem.create({
      data: { cartId, productId, variantId: variantId ?? null, quantity: Math.min(maxQty, quantity), configKey },
    });
  }
  return getCartView();
}

/**
 * Cut-based products carry one measurement configuration per physical piece.
 * The client sends only intent; every piece is re-validated and snapshotted
 * server-side from the product's stored cut.
 */
async function addCutProduct(
  cartId: string,
  product: { id: string; madeToOrder: boolean; variants: { id: string; size: string | null; stock: number; stockStatus: string; isActive: boolean }[] },
  cut: import('./size-guide-db').CutGuide,
  quantity: number,
  pieces?: PieceInput[],
) {
  if (!pieces || pieces.length !== quantity) throw new Error('MEASUREMENTS_REQUIRED');
  const result = validatePieces(cut, pieces);
  if (!result.ok) {
    const suffix = result.error.fieldKey ? `:${result.error.fieldKey}` : '';
    throw new Error(`MEASUREMENT_INVALID:${result.error.code}${suffix}`);
  }

  // READY pieces resolve to the size-matched variant so stock is still enforced.
  let maxQty = 20;
  let representativeVariant: string | null = null;
  for (const piece of result.pieces) {
    if (piece.sizeCode) {
      const variant = product.variants.find((v) => v.size === piece.sizeCode);
      if (product.variants.length > 0 && !variant) throw new Error('VARIANT_UNAVAILABLE');
      if (variant) {
        if (representativeVariant === null) representativeVariant = variant.id;
        if (variant.stockStatus === 'OUT_OF_STOCK') throw new Error('VARIANT_UNAVAILABLE');
        if (!product.madeToOrder && variant.stockStatus !== 'PRE_ORDER') {
          if (variant.stock < pieces.filter((p) => p.mode === 'READY' && p.sizeCode === piece.sizeCode).length) {
            throw new Error('VARIANT_UNAVAILABLE');
          }
          maxQty = Math.min(maxQty, variant.stock);
        }
      }
    }
  }

  const configKey = configKeyFor(product.id, representativeVariant, result.pieces);
  const existing = await prisma.cartItem.findFirst({ where: { cartId, configKey } });
  const target = Math.min(maxQty, (existing?.quantity ?? 0) + quantity);
  if (target < quantity) throw new Error('MAX_QUANTITY');

  if (existing) {
    // Same configuration regroups; the new pieces append with fresh indices.
    const start = existing.quantity;
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: target } });
    for (let i = 0; i < quantity; i++) {
      const piece = result.pieces[i];
      await prisma.cartItemPiece.create({
        data: {
          cartItemId: existing.id,
          pieceIndex: start + i,
          measurementKind: piece.snapshot.kind,
          sizeCode: piece.sizeCode,
          sizeSnapshot: piece.snapshot.kind === 'READY' ? (piece.snapshot as never) : undefined,
          measurementSnapshot: piece.snapshot as never,
          cutId: cut.id,
        },
      });
    }
  } else {
    await prisma.cartItem.create({
      data: {
        cartId,
        productId: product.id,
        variantId: representativeVariant,
        quantity,
        configKey,
        pieces: {
          create: result.pieces.map((piece, i) => ({
            pieceIndex: i,
            measurementKind: piece.snapshot.kind,
            sizeCode: piece.sizeCode,
            sizeSnapshot: piece.snapshot.kind === 'READY' ? (piece.snapshot as never) : undefined,
            measurementSnapshot: piece.snapshot as never,
            cutId: cut.id,
          })),
        },
      },
    });
  }
  return getCartView();
}

export async function updateCartItem(itemId: string, quantity: number) {
  const cartId = await peekCartId();
  if (!cartId) throw new Error('CART_UNAVAILABLE');
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId }, include: { pieces: true } });
  if (!item) throw new Error('ITEM_NOT_FOUND');
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return getCartView();
  }
  const target = Math.min(20, quantity);

  // Cut products keep one piece per unit. Growing the line clones the last
  // piece's configuration; shrinking removes the highest-index pieces — the
  // remaining measurement choices are never silently dropped or rewritten.
  if (item.pieces.length > 0) {
    const ordered = [...item.pieces].sort((a, b) => a.pieceIndex - b.pieceIndex);
    if (target < ordered.length) {
      const toRemove = ordered.slice(target).map((p) => p.id);
      await prisma.cartItemPiece.deleteMany({ where: { id: { in: toRemove } } });
    } else if (target > ordered.length) {
      const template = ordered[ordered.length - 1];
      for (let i = ordered.length; i < target; i++) {
        await prisma.cartItemPiece.create({
          data: {
            cartItemId: item.id,
            pieceIndex: i,
            measurementKind: template.measurementKind,
            sizeCode: template.sizeCode,
            sizeSnapshot: template.sizeSnapshot as never,
            measurementSnapshot: template.measurementSnapshot as never,
            cutId: template.cutId,
          },
        });
      }
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: target } });
  } else {
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: target } });
  }
  return getCartView();
}

export async function removeCartItem(itemId: string) {
  const cartId = await peekCartId();
  if (!cartId) return getCartView();
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
  return getCartView();
}

export async function clearCart() {
  const cartId = await peekCartId();
  if (!cartId) return;
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

/** Moves a guest cart to the customer on sign-in, merging quantities. */
export async function mergeGuestCartInto(customerId: string) {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return;
  const guest = await prisma.cart.findUnique({ where: { token }, include: { items: { include: { pieces: true } } } });
  if (!guest) return;

  const customerCart =
    (await prisma.cart.findUnique({ where: { customerId } })) ??
    (await prisma.cart.create({ data: { customerId } }));

  for (const item of guest.items) {
    const existing = await prisma.cartItem.findFirst({
      where: { cartId: customerCart.id, configKey: item.configKey },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(20, existing.quantity + item.quantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: customerCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          configKey: item.configKey,
        },
      });
    }
  }
  await prisma.cart.delete({ where: { id: guest.id } }).catch(() => {});
  store.delete(CART_COOKIE);
}

// ───────────────────────────────────────────────────────────
// Wishlist — DB for signed-in customers, signed cookie for guests
// ───────────────────────────────────────────────────────────

export async function getWishlistIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (user?.customerId) {
    const rows = await prisma.wishlistItem.findMany({
      where: { customerId: user.customerId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.productId);
  }
  const store = await cookies();
  const raw = store.get(WISHLIST_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

async function setGuestWishlist(ids: string[]) {
  const store = await cookies();
  store.set(WISHLIST_COOKIE, JSON.stringify(ids.slice(0, 200)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR,
  });
}

export async function toggleWishlist(productId: string): Promise<{ saved: boolean; ids: string[] }> {
  const product = await prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' } });
  if (!product) throw new Error('PRODUCT_UNAVAILABLE');

  const user = await getCurrentUser();
  if (user?.customerId) {
    const existing = await prisma.wishlistItem.findUnique({
      where: { customerId_productId: { customerId: user.customerId, productId } },
    });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      return { saved: false, ids: await getWishlistIds() };
    }
    await prisma.wishlistItem.create({ data: { customerId: user.customerId, productId } });
    return { saved: true, ids: await getWishlistIds() };
  }

  const ids = await getWishlistIds();
  const saved = !ids.includes(productId);
  const next = saved ? [productId, ...ids] : ids.filter((id) => id !== productId);
  await setGuestWishlist(next);
  return { saved, ids: next };
}

/** On sign-in, migrate guest wishlist entries into the customer account. */
export async function mergeGuestWishlistInto(customerId: string) {
  const store = await cookies();
  const raw = store.get(WISHLIST_COOKIE)?.value;
  if (!raw) return;
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return;
  }
  if (!ids.length) return;
  const valid = await prisma.product.findMany({ where: { id: { in: ids }, status: 'ACTIVE' }, select: { id: true } });
  for (const { id } of valid) {
    await prisma.wishlistItem
      .create({ data: { customerId, productId: id } })
      .catch(() => {});
  }
  store.delete(WISHLIST_COOKIE);
}
