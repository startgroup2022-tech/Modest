import 'server-only';
import { prisma } from './prisma';
import type { Prisma, ProductStatus } from '@prisma/client';

export interface ProductQuery {
  locale: 'en' | 'ar';
  categorySlugs?: string[];
  collectionSlug?: string;
  search?: string;
  minPriceBhd?: number;
  maxPriceBhd?: number;
  madeToOrder?: boolean;
  inStockOnly?: boolean;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'featured';
  page?: number;
  perPage?: number;
  featuredOnly?: boolean;
  newArrivalsOnly?: boolean;
}

const productCardInclude = {
  media: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }], take: 2 },
  variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
  categories: { include: { category: true } },
  collections: { include: { collection: true } },
} satisfies Prisma.ProductInclude;

export type ProductCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export const productDetailInclude = {
  media: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }] },
  variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
  categories: { include: { category: true } },
  collections: { include: { collection: true } },
  cut: { include: { sizeCharts: { include: { values: { include: { field: true } } } }, fields: { orderBy: { sortOrder: 'asc' as const } } } },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

// Statuses a shopper may see. DRAFT (internal), UNAVAILABLE (published but not
// purchasable → hidden from listing) and ARCHIVED are excluded. Switching this
// one list changes storefront visibility everywhere.
export const STOREFRONT_PRODUCT_STATUSES: ProductStatus[] = ['ACTIVE', 'PREORDER'];

function buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: { in: STOREFRONT_PRODUCT_STATUSES } };

  if (query.categorySlugs?.length) {
    where.categories = { some: { category: { slug: { in: query.categorySlugs } } } };
  }
  if (query.collectionSlug) {
    where.collections = { some: { collection: { slug: query.collectionSlug } } };
  }
  if (query.featuredOnly) where.isFeatured = true;
  if (query.newArrivalsOnly) where.isNewArrival = true;
  if (query.madeToOrder) where.madeToOrder = true;
  if (query.minPriceBhd != null || query.maxPriceBhd != null) {
    where.priceBhd = {
      ...(query.minPriceBhd != null ? { gte: query.minPriceBhd } : {}),
      ...(query.maxPriceBhd != null ? { lte: query.maxPriceBhd } : {}),
    };
  }
  if (query.inStockOnly) {
    where.variants = { some: { isActive: true, stockStatus: { in: ['IN_STOCK', 'LOW_STOCK'] } } };
  }
  if (query.search) {
    const q = query.search.trim();
    if (q) {
      where.OR = [
        { nameEn: { contains: q } },
        { nameAr: { contains: q } },
        { subtitleEn: { contains: q } },
        { subtitleAr: { contains: q } },
        { descriptionEn: { contains: q } },
        { descriptionAr: { contains: q } },
        { materialsEn: { contains: q } },
        { materialsAr: { contains: q } },
        { categories: { some: { category: { OR: [{ nameEn: { contains: q } }, { nameAr: { contains: q } }] } } } },
        { collections: { some: { collection: { OR: [{ nameEn: { contains: q } }, { nameAr: { contains: q } }] } } } },
      ];
    }
  }
  return where;
}

function buildOrderBy(sort: ProductQuery['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }];
    case 'price_asc':
      return [{ priceBhd: 'asc' }];
    case 'price_desc':
      return [{ priceBhd: 'desc' }];
    case 'featured':
      return [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ isNewArrival: 'desc' }, { createdAt: 'desc' }];
  }
}

export async function getProducts(query: ProductQuery) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 12));
  const where = buildWhere(query);
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productCardInclude,
      orderBy: buildOrderBy(query.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getFeaturedProducts(limit = 8) {
  return prisma.product.findMany({
    where: { status: { in: STOREFRONT_PRODUCT_STATUSES }, isFeatured: true },
    include: productCardInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });
}

export async function getNewArrivals(limit = 4) {
  return prisma.product.findMany({
    where: { status: { in: STOREFRONT_PRODUCT_STATUSES }, isNewArrival: true },
    include: productCardInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  return prisma.product.findFirst({
    where: { slug, status: { in: STOREFRONT_PRODUCT_STATUSES } },
    include: productDetailInclude,
  });
}

export async function getRelatedProducts(product: ProductDetail, limit = 4) {
  const collectionSlugs = product.collections.map((c) => c.collection.slug);
  const categorySlugs = product.categories.map((c) => c.category.slug);
  return prisma.product.findMany({
    where: {
      status: { in: STOREFRONT_PRODUCT_STATUSES },
      id: { not: product.id },
      OR: [
        { collections: { some: { collection: { slug: { in: collectionSlugs } } } } },
        { categories: { some: { category: { slug: { in: categorySlugs } } } } },
      ],
    },
    include: productCardInclude,
    take: limit,
  });
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: { where: { product: { status: { in: STOREFRONT_PRODUCT_STATUSES } } } } } } },
  });
}

export async function getCollections() {
  return prisma.collection.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: { where: { product: { status: { in: STOREFRONT_PRODUCT_STATUSES } } } } } } },
  });
}

export async function getCollectionBySlug(slug: string) {
  return prisma.collection.findFirst({ where: { slug, isActive: true } });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findFirst({ where: { slug, isActive: true } });
}

export async function getPriceBounds() {
  const result = await prisma.product.aggregate({
    where: { status: { in: STOREFRONT_PRODUCT_STATUSES } },
    _min: { priceBhd: true },
    _max: { priceBhd: true },
  });
  return {
    min: Number(result._min.priceBhd ?? 0),
    max: Number(result._max.priceBhd ?? 500),
  };
}

export interface SearchResults {
  products: ProductCard[];
  categories: { slug: string; nameEn: string; nameAr: string }[];
  collections: { slug: string; nameEn: string; nameAr: string }[];
  total: number;
}

export async function searchCatalog(rawQuery: string, limit = 8): Promise<SearchResults> {
  const q = rawQuery.trim();
  if (q.length < 2) return { products: [], categories: [], collections: [], total: 0 };
  const where = buildWhere({ locale: 'en', search: q });
  const [products, total, categories, collections] = await Promise.all([
    prisma.product.findMany({ where, include: productCardInclude, take: limit, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }] }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true, OR: [{ nameEn: { contains: q } }, { nameAr: { contains: q } }] },
      take: 4,
    }),
    prisma.collection.findMany({
      where: { isActive: true, OR: [{ nameEn: { contains: q } }, { nameAr: { contains: q } }] },
      take: 4,
    }),
  ]);
  return {
    products,
    total,
    categories: categories.map((c) => ({ slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr })),
    collections: collections.map((c) => ({ slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr })),
  };
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  return prisma.product.findMany({
    where: { id: { in: ids }, status: { in: STOREFRONT_PRODUCT_STATUSES } },
    include: productCardInclude,
  });
}

export function localizedName(
  row: { nameEn: string; nameAr: string },
  locale: 'en' | 'ar',
): string {
  return locale === 'ar' ? row.nameAr || row.nameEn : row.nameEn;
}

export function primaryImage(p: { media: { url: string }[] }): string | null {
  return p.media[0]?.url ?? null;
}

export function secondaryImage(p: { media: { url: string }[] }): string | null {
  return p.media[1]?.url ?? p.media[0]?.url ?? null;
}

export function totalStock(p: { variants: { stock: number; stockStatus: string }[] }): number {
  return p.variants.reduce((sum, v) => (v.stockStatus === 'PRE_ORDER' ? sum : sum + v.stock), 0);
}

export function stockLabel(p: { variants: { stock: number; stockStatus: string }[]; madeToOrder: boolean }):
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'PRE_ORDER' {
  if (p.madeToOrder) return 'PRE_ORDER';
  if (p.variants.some((v) => v.stockStatus === 'PRE_ORDER')) return 'PRE_ORDER';
  const stock = totalStock(p);
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= 5) return 'LOW_STOCK';
  return 'IN_STOCK';
}
