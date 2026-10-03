import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import { getCurrentUser } from './auth';

export const CART_COOKIE = 'att_cart';
export const WISHLIST_COOKIE = 'att_wishlist';
const YEAR = 60 * 60 * 24 * 365;

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
  });
  if (!items.length) return { id: cartId, items: [], count: 0, subtotalBhd: 0 };

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] } },
    include: {
      media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      variants: true,
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: CartLineView[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || product.status !== 'ACTIVE') continue;
    const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
    const unitPriceBhd = Number(variant?.priceBhd ?? product.priceBhd);
    const stockStatus = variant?.stockStatus ?? (product.madeToOrder ? 'PRE_ORDER' : 'IN_STOCK');
    lines.push({
      id: item.id,
      productId: product.id,
      variantId: item.variantId,
      quantity: item.quantity,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      slug: product.slug,
      image: product.media[0]?.url ?? null,
      size: variant?.size ?? null,
      colorEn: variant?.colorEn ?? null,
      colorAr: variant?.colorAr ?? null,
      unitPriceBhd,
      lineTotalBhd: Math.round(unitPriceBhd * item.quantity * 1000) / 1000,
      stockStatus,
      available: stockStatus !== 'OUT_OF_STOCK',
    });
  }
  const subtotalBhd = Math.round(lines.reduce((s, l) => s + l.lineTotalBhd, 0) * 1000) / 1000;
  return { id: cartId, items: lines, count: lines.reduce((s, l) => s + l.quantity, 0), subtotalBhd };
}

export async function addToCart(productId: string, variantId: string | null, quantity: number) {
  const cartId = await ensureCart();
  const product = await prisma.product.findFirst({
    where: { id: productId, status: 'ACTIVE' },
    include: { variants: true },
  });
  if (!product) throw new Error('PRODUCT_UNAVAILABLE');
  if (product.variants.length > 0 && !variantId) throw new Error('VARIANT_REQUIRED');
  if (variantId && !product.variants.some((v) => v.id === variantId && v.isActive)) {
    throw new Error('VARIANT_UNAVAILABLE');
  }

  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productId, variantId: variantId ?? null },
  });
  const nextQty = Math.min(20, (existing?.quantity ?? 0) + quantity);
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQty } });
  } else {
    await prisma.cartItem.create({ data: { cartId, productId, variantId: variantId ?? null, quantity: Math.min(20, quantity) } });
  }
  return getCartView();
}

export async function updateCartItem(itemId: string, quantity: number) {
  const cartId = await peekCartId();
  if (!cartId) throw new Error('CART_UNAVAILABLE');
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw new Error('ITEM_NOT_FOUND');
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(20, quantity) } });
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
  const guest = await prisma.cart.findUnique({ where: { token }, include: { items: true } });
  if (!guest) return;

  const customerCart =
    (await prisma.cart.findUnique({ where: { customerId } })) ??
    (await prisma.cart.create({ data: { customerId } }));

  for (const item of guest.items) {
    const existing = await prisma.cartItem.findFirst({
      where: { cartId: customerCart.id, productId: item.productId, variantId: item.variantId },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(20, existing.quantity + item.quantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: customerCart.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity },
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
