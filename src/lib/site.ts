import 'server-only';
import { cache } from 'react';
import { prisma } from './prisma';

export interface StoreInfo {
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  cr: string;
  currency: string;
  timezone: string;
  leadTimeEn: string;
  leadTimeAr: string;
}

const FALLBACK_STORE: StoreInfo = {
  name: 'Attention Modest Fashion',
  nameAr: 'أتنشن للموضة المحتشمة',
  email: 'info@attention-modestfashion.com',
  phone: '+97332250467',
  whatsapp: 'https://wa.me/97332250467',
  country: 'Bahrain',
  city: 'Manama',
  cr: '192498-1',
  currency: 'BHD',
  timezone: 'Asia/Bahrain',
  leadTimeEn: 'Please allow 2–3 weeks for processing.',
  leadTimeAr: 'يُرجى منح 2–3 أسابيع للمعالجة.',
};

export const getStoreInfo = cache(async (): Promise<StoreInfo> => {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'store' } });
  if (!row) return FALLBACK_STORE;
  return { ...FALLBACK_STORE, ...(row.value as Partial<StoreInfo>) };
});

export const getSocialLinks = cache(async () => {
  return prisma.socialLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
});

export const getHomeSections = cache(async () => {
  return prisma.homeSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
});

export const getHomeSection = cache(async (key: string) => {
  return prisma.homeSection.findFirst({ where: { key, isActive: true } });
});

export const getPage = cache(async (slug: string) => {
  return prisma.page.findFirst({ where: { slug, isActive: true } });
});

export const getShippingMethods = cache(async () => {
  return prisma.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
});

export const getActivePromotions = cache(async () => {
  const now = new Date();
  return prisma.promotion.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { sortOrder: 'asc' },
  });
});

export function localizedField<T extends Record<string, unknown>>(
  row: T | null | undefined,
  base: string,
  locale: 'en' | 'ar',
): string | null {
  if (!row) return null;
  const key = `${base}${locale === 'ar' ? 'Ar' : 'En'}`;
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
