import { z } from 'zod';

/**
 * Shared product create/update schema. It lives outside the route file because
 * Next.js route modules may only export route handlers and reserved fields.
 */
export const productSchema = z.object({
  slug: z.string().max(160).optional(),
  sku: z.string().max(80).nullable().optional(),
  nameEn: z.string().min(1).max(200),
  nameAr: z.string().min(1).max(200),
  subtitleEn: z.string().max(300).optional().default(''),
  subtitleAr: z.string().max(300).optional().default(''),
  descriptionEn: z.string().max(8000).optional().default(''),
  descriptionAr: z.string().max(8000).optional().default(''),
  materialsEn: z.string().max(4000).optional().default(''),
  materialsAr: z.string().max(4000).optional().default(''),
  careEn: z.string().max(4000).optional().default(''),
  careAr: z.string().max(4000).optional().default(''),
  priceBhd: z.number().min(0).max(1_000_000),
  compareAtBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PREORDER', 'UNAVAILABLE', 'ARCHIVED']).default('DRAFT'),
  kind: z.enum(['READY_TO_WEAR', 'MADE_TO_ORDER']).default('READY_TO_WEAR'),
  cutId: z.string().min(1).nullable().optional(),
  tailorFeeBhd: z.number().min(0).max(1_000_000).nullable().optional(),
  showAvailability: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  madeToOrder: z.boolean().default(false),
  leadTimeMinDays: z.number().int().min(0).max(365).default(14),
  leadTimeMaxDays: z.number().int().min(0).max(365).default(21),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(5),
  metaTitleEn: z.string().max(200).optional().default(''),
  metaTitleAr: z.string().max(200).optional().default(''),
  metaDescEn: z.string().max(400).optional().default(''),
  metaDescAr: z.string().max(400).optional().default(''),
  noIndex: z.boolean().default(false),
  categoryIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
});
