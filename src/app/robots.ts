import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/en/admin/', '/ar/admin/', '/en/account/', '/ar/account/', '/en/tailor/', '/ar/tailor/', '/en/checkout/', '/ar/checkout/', '/en/cart/', '/ar/cart/', '/en/search', '/ar/search', '/en/q/', '/ar/q/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
