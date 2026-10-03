import { z } from 'zod';

/**
 * Shared validation schemas for the declarative admin resources. Kept in one
 * place so create and update routes can never drift apart.
 */

const optionalText = (max: number) => z.string().max(max).optional().default('');
const optionalNumber = z.number().nullable().optional();
const bool = (def = true) => z.boolean().default(def);

export const couponSchema = z.object({
  code: z.string().min(2).max(40).transform((v) => v.toUpperCase()),
  descriptionEn: optionalText(300),
  descriptionAr: optionalText(300),
  discountType: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']),
  valueBhd: z.number().min(0).max(1_000_000).default(0),
  minOrderBhd: optionalNumber,
  maxDiscountBhd: optionalNumber,
  usageLimit: z.number().int().min(0).max(1_000_000).nullable().optional(),
  perCustomerLimit: z.number().int().min(0).max(1000).nullable().optional(),
  startsAt: z.string().optional().default(''),
  expiresAt: z.string().optional().default(''),
  isActive: bool(),
});

export const promotionSchema = z.object({
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().min(1).max(200),
  bodyEn: optionalText(4000),
  bodyAr: optionalText(4000),
  ctaLabelEn: optionalText(120),
  ctaLabelAr: optionalText(120),
  ctaHref: optionalText(500),
  imageUrl: optionalText(2000),
  placement: z.enum(['announcement', 'home_banner']).default('announcement'),
  isActive: bool(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  startsAt: z.string().optional().default(''),
  endsAt: z.string().optional().default(''),
});

export const shippingSchema = z.object({
  code: z.string().min(2).max(40).transform((v) => v.toUpperCase()),
  nameEn: z.string().min(1).max(120),
  nameAr: z.string().min(1).max(120),
  descriptionEn: optionalText(500),
  descriptionAr: optionalText(500),
  priceBhd: z.number().min(0).max(100_000).default(0),
  freeOverBhd: optionalNumber,
  courier: optionalText(120),
  etaMinDays: z.number().int().min(0).max(120).default(2),
  etaMaxDays: z.number().int().min(0).max(120).default(5),
  isActive: bool(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const pageSchema = z.object({
  slug: z.string().min(1).max(160),
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().min(1).max(200),
  bodyEn: z.string().max(200_000).default(''),
  bodyAr: z.string().max(200_000).default(''),
  metaTitleEn: optionalText(200),
  metaTitleAr: optionalText(200),
  metaDescEn: optionalText(400),
  metaDescAr: optionalText(400),
  noIndex: bool(false),
  isActive: bool(),
});

export const currencySchema = z.object({
  code: z.string().length(3).transform((v) => v.toUpperCase()),
  nameEn: z.string().min(1).max(80),
  nameAr: z.string().min(1).max(80),
  symbolEn: z.string().min(1).max(8),
  symbolAr: z.string().min(1).max(8),
  decimals: z.number().int().min(0).max(4).default(3),
  symbolPosition: z.enum(['prefix', 'suffix']).default('prefix'),
  rateToBhd: z.number().positive().max(1_000_000),
  isActive: bool(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const tailorSchema = z.object({
  code: optionalText(40),
  nameEn: z.string().min(1).max(160),
  nameAr: z.string().min(1).max(160),
  phone: optionalText(40),
  email: optionalText(160),
  specialization: optionalText(120),
  capacity: z.number().int().min(0).max(100).default(4),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).default('ACTIVE'),
  notes: optionalText(4000),
  settlementType: z.enum(['per_task', 'monthly', 'hourly']).default('per_task'),
  rateBhd: z.number().min(0).max(100_000).default(0),
});

export const expenseSchema = z.object({
  categoryId: z.string().nullable().optional(),
  description: z.string().min(1).max(500),
  amountBhd: z.number().positive().max(10_000_000),
  currencyCode: z.string().length(3).default('BHD'),
  vendor: optionalText(200),
  notes: optionalText(4000),
  attachmentUrl: optionalText(2000),
  expenseDate: z.string().optional().default(''),
});

export const expenseCategorySchema = z.object({
  nameEn: z.string().min(1).max(120),
  nameAr: z.string().min(1).max(120),
  isActive: bool(),
});

export const redirectSchema = z.object({
  fromPath: z.string().min(1).max(500),
  toPath: z.string().min(1).max(500),
  statusCode: z.number().int().min(301).max(308).default(301),
  isEnabled: bool(),
});

export const homeSectionSchema = z.object({
  titleEn: optionalText(200),
  titleAr: optionalText(200),
  bodyEn: optionalText(4000),
  bodyAr: optionalText(4000),
  ctaLabelEn: optionalText(120),
  ctaLabelAr: optionalText(120),
  ctaHref: optionalText(500),
  imageUrl: optionalText(2000),
  mobileImageUrl: optionalText(2000),
  isActive: bool(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const socialLinkSchema = z.object({
  platform: z.string().min(1).max(60),
  url: z.string().url().max(500),
  labelEn: optionalText(120),
  labelAr: optionalText(120),
  isActive: bool(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

/** Normalises an empty date string to null and parses a date string. */
export function dateOrNull(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
