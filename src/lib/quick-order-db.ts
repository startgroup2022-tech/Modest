import 'server-only';
import { prisma } from './prisma';
import { hashToken } from './tokens';
import { nextSequenceStandalone } from './sequences';
import { productDetailInclude, STOREFRONT_PRODUCT_STATUSES, stockLabel, type ProductDetail } from './catalog';
import { getCutForProduct } from './size-guide-db';
import {
  DEFAULT_TTL_DAYS,
  isValidTokenFormat,
  isQuickOrderLinkUsable,
  newQuickOrderToken,
  quickOrderLinkState,
  tokenLast4,
  type QuickOrderLinkState,
} from './quick-order';
import type { Prisma, QuickOrderSource } from '@prisma/client';

/**
 * Server-side Quick Order link service.
 *
 * The raw public token is only ever returned by `createQuickOrderLink`, once,
 * to the staff member who created it. Everything else reads and writes by the
 * token's SHA-256 digest, so a database leak cannot be turned into working
 * links. Product identity, price, availability and measurement requirements are
 * resolved live from the catalogue here — never carried in the URL.
 */

const linkInclude = {
  product: { select: { id: true, nameEn: true, nameAr: true, slug: true } },
  order: { select: { id: true, orderNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.QuickOrderLinkInclude;

type LinkRow = Prisma.QuickOrderLinkGetPayload<{ include: typeof linkInclude }>;

export interface QuickOrderLinkView {
  id: string;
  code: string;
  tokenLast4: string;
  source: QuickOrderSource;
  state: QuickOrderLinkState;
  usable: boolean;
  product: { id: string; nameEn: string; nameAr: string; slug: string };
  customerPhone: string | null;
  createdBy: string | null;
  createdById: string | null;
  order: { id: string; orderNumber: string } | null;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function toView(row: LinkRow): QuickOrderLinkView {
  const state = quickOrderLinkState({
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    orderId: row.orderId,
    openedAt: row.openedAt,
    sentAt: row.sentAt,
  });
  const creator = row.createdBy
    ? [row.createdBy.firstName, row.createdBy.lastName].filter(Boolean).join(' ') || row.createdBy.email
    : null;
  return {
    id: row.id,
    code: row.code,
    tokenLast4: row.tokenLast4,
    source: row.source,
    state,
    usable: isQuickOrderLinkUsable(state),
    product: row.product,
    customerPhone: row.customerPhone,
    createdBy: creator,
    createdById: row.createdById,
    order: row.order ? { id: row.order.id, orderNumber: row.order.orderNumber } : null,
    sentAt: row.sentAt?.toISOString() ?? null,
    openedAt: row.openedAt?.toISOString() ?? null,
    openCount: row.openCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CreateQuickOrderLinkInput {
  productId: string;
  source: QuickOrderSource;
  createdById: string | null;
  customerPhone?: string | null;
  ttlDays?: number;
}

/**
 * Creates a link and returns the raw token exactly once. The product must be
 * storefront-visible, so staff cannot mint a link that will never resolve.
 */
export async function createQuickOrderLink(input: CreateQuickOrderLinkInput): Promise<{
  link: QuickOrderLinkView;
  rawToken: string;
  url: string;
}> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, status: { in: STOREFRONT_PRODUCT_STATUSES } },
    select: { id: true },
  });
  if (!product) throw new Error('PRODUCT_UNAVAILABLE');

  const ttlDays = input.ttlDays && input.ttlDays > 0 ? input.ttlDays : DEFAULT_TTL_DAYS;
  const rawToken = newQuickOrderToken();
  const code = await nextSequenceStandalone({ key: 'quick_order', prefix: 'QOL', pad: 6 });
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const created = await prisma.quickOrderLink.create({
    data: {
      code,
      tokenHash: hashToken(rawToken),
      tokenLast4: tokenLast4(rawToken),
      productId: input.productId,
      source: input.source,
      createdById: input.createdById,
      customerPhone: input.customerPhone?.trim() || null,
      expiresAt,
    },
    include: linkInclude,
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return { link: toView(created), rawToken, url: `${baseUrl}/en/q/${rawToken}` };
}

export interface ListQuickOrderLinksFilter {
  productId?: string;
  source?: QuickOrderSource;
  take?: number;
}

export async function listQuickOrderLinks(filter: ListQuickOrderLinksFilter = {}): Promise<QuickOrderLinkView[]> {
  const rows = await prisma.quickOrderLink.findMany({
    where: {
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.source ? { source: filter.source } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filter.take ?? 100, 200),
    include: linkInclude,
  });
  return rows.map(toView);
}

export async function getQuickOrderLinkById(id: string): Promise<QuickOrderLinkView | null> {
  const row = await prisma.quickOrderLink.findUnique({ where: { id }, include: linkInclude });
  return row ? toView(row) : null;
}

/** Records that a send was initiated (e.g. a WhatsApp deep link was opened). */
export async function markQuickOrderLinkSent(id: string): Promise<boolean> {
  const res = await prisma.quickOrderLink.updateMany({
    where: { id, sentAt: null, revokedAt: null },
    data: { sentAt: new Date() },
  });
  return res.count > 0;
}

/** Revokes a link. Idempotent: revoking an already-revoked link is a no-op. */
export async function revokeQuickOrderLink(id: string): Promise<boolean> {
  const res = await prisma.quickOrderLink.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export type QuickOrderResolveFailure = 'INVALID' | 'REVOKED' | 'EXPIRED' | 'UNAVAILABLE';

export interface ResolvedQuickOrderLink {
  link: {
    id: string;
    code: string;
    source: QuickOrderSource;
    customerPhone: string | null;
    expiresAt: Date | null;
    orderId: string | null;
  };
  product: ProductDetail;
}

export type QuickOrderResolveResult =
  | { ok: true; data: ResolvedQuickOrderLink }
  | { ok: false; reason: QuickOrderResolveFailure };

/**
 * Resolves a raw token to its live product. Rejects malformed tokens without a
 * database hit. A link whose product has since been hidden resolves to
 * UNAVAILABLE rather than leaking a dead page.
 */
export async function resolveQuickOrderLink(token: string): Promise<QuickOrderResolveResult> {
  if (!isValidTokenFormat(token)) return { ok: false, reason: 'INVALID' };
  const row = await prisma.quickOrderLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row) return { ok: false, reason: 'INVALID' };

  const state = quickOrderLinkState({
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    orderId: row.orderId,
    openedAt: row.openedAt,
    sentAt: row.sentAt,
  });
  if (state === 'REVOKED') return { ok: false, reason: 'REVOKED' };
  if (state === 'EXPIRED') return { ok: false, reason: 'EXPIRED' };

  const product = await prisma.product.findFirst({
    where: { id: row.productId, status: { in: STOREFRONT_PRODUCT_STATUSES } },
    include: productDetailInclude,
  });
  if (!product) return { ok: false, reason: 'UNAVAILABLE' };

  return {
    ok: true,
    data: {
      link: {
        id: row.id,
        code: row.code,
        source: row.source,
        customerPhone: row.customerPhone,
        expiresAt: row.expiresAt,
        orderId: row.orderId,
      },
      product,
    },
  };
}

/** Increments the open counter and stamps the first open, once. */
export async function recordQuickOrderLinkOpen(id: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.quickOrderLink.updateMany({
      where: { id, revokedAt: null },
      data: { openCount: { increment: 1 }, lastOpenedAt: now },
    }),
    prisma.quickOrderLink.updateMany({
      where: { id, openedAt: null },
      data: { openedAt: now },
    }),
  ]);
}

export interface QuickOrderProductView {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  materials: string | null;
  care: string | null;
  priceBhd: number;
  compareAtBhd: number | null;
  madeToOrder: boolean;
  leadTimeMin: number;
  leadTimeMax: number;
  stock: string;
  images: { url: string; alt: string }[];
  variants: {
    id: string;
    size: string;
    colorEn: string | null;
    colorAr: string | null;
    priceBhd: number | null;
    stock: number;
    stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';
  }[];
  cut: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    unit: string;
    sizes: string[];
    fields: {
      key: string;
      labelEn: string;
      labelAr: string;
      unit: string;
      minValue: number | null;
      maxValue: number | null;
      helperEn: string | null;
      helperAr: string | null;
    }[];
    matrix: Record<string, Record<string, number>>;
  } | null;
  category: { slug: string; name: string } | null;
}

/** Maps a catalogue product into the localized, serializable view the page needs. */
export async function toQuickOrderProduct(product: ProductDetail, locale: 'en' | 'ar'): Promise<QuickOrderProductView> {
  const ar = locale === 'ar';
  const name = ar ? product.nameAr : product.nameEn;
  const cut = await getCutForProduct(product.id);
  const category = product.categories[0]?.category ?? null;
  return {
    id: product.id,
    slug: product.slug,
    name,
    subtitle: ar ? product.subtitleAr : product.subtitleEn,
    description: ar ? product.descriptionAr : product.descriptionEn,
    materials: ar ? product.materialsAr : product.materialsEn,
    care: ar ? product.careAr : product.careEn,
    priceBhd: Number(product.priceBhd),
    compareAtBhd: product.compareAtBhd != null ? Number(product.compareAtBhd) : null,
    madeToOrder: product.madeToOrder,
    leadTimeMin: product.leadTimeMinDays,
    leadTimeMax: product.leadTimeMaxDays,
    stock: stockLabel(product),
    images: product.media.map((m) => ({ url: m.url, alt: (ar ? m.altAr : m.altEn) ?? name })),
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      colorEn: v.colorEn,
      colorAr: v.colorAr,
      priceBhd: v.priceBhd != null ? Number(v.priceBhd) : null,
      stock: v.stock,
      stockStatus: v.stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER',
    })),
    cut: cut
      ? {
          id: cut.id,
          code: cut.cutCode,
          nameEn: cut.cutNameEn,
          nameAr: cut.cutNameAr,
          unit: cut.unit,
          sizes: cut.sizes,
          fields: cut.fieldRows
            .filter((f) => f.isActive)
            .map((f) => ({
              key: f.key,
              labelEn: f.labelEn,
              labelAr: f.labelAr,
              unit: f.unit,
              minValue: f.minValue,
              maxValue: f.maxValue,
              helperEn: f.helperEn,
              helperAr: f.helperAr,
            })),
          matrix: cut.matrix,
        }
      : null,
    category: category ? { slug: category.slug, name: ar ? category.nameAr : category.nameEn } : null,
  };
}
