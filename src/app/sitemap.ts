import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { locales } from '@/i18n/config';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);

  const staticPaths: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
    { path: '/collections', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/size-guide', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  ];

  const entries: MetadataRoute.Sitemap = [];

  const languagesFor = (path: string) =>
    Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`]));

  const push = (path: string, lastModified: Date, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly') => {
    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        lastModified,
        changeFrequency,
        priority,
        alternates: { languages: languagesFor(path) },
      });
    }
  };

  const now = new Date();
  for (const s of staticPaths) push(s.path, now, s.priority, s.changeFrequency);
  for (const c of categories) push(`/shop?category=${c.slug}`, c.updatedAt, 0.7, 'weekly');
  for (const c of collections) push(`/collections/${c.slug}`, c.updatedAt, 0.7, 'weekly');
  for (const p of pages) push(`/p/${p.slug}`, p.updatedAt, 0.4, 'monthly');
  for (const p of products) push(`/product/${p.slug}`, p.updatedAt, 0.8, 'weekly');

  return entries;
}
