import { getStoreInfo, getSocialLinks } from '@/lib/site';
import { isLocale, type Locale } from '@/i18n/config';

/**
 * Site-wide Organization + WebSite structured data, rendered once from the
 * storefront layout so search engines and LLM crawlers can resolve the brand
 * entity and its contact points from every page's HTML.
 */
export async function SiteJsonLd({ locale }: { locale: Locale }) {
  const [store, socials] = await Promise.all([getStoreInfo(), getSocialLinks()]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const loc: Locale = isLocale(locale) ? locale : 'en';

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: loc === 'ar' ? store.nameAr : store.name,
    alternateName: loc === 'ar' ? store.name : store.nameAr,
    url: site,
    logo: `${site}/icon.svg`,
    email: store.email,
    telephone: store.phone,
    address: {
      '@type': 'PostalAddress',
      addressCountry: store.country,
      addressLocality: store.city,
    },
    ...(socials.length ? { sameAs: socials.map((s) => s.url) } : {}),
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    url: site,
    name: loc === 'ar' ? store.nameAr : store.name,
    inLanguage: loc,
    publisher: { '@id': `${site}/#organization` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
