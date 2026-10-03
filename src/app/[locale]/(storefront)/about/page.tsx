import { jsonLdHtml } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreInfo, getHomeSection } from '@/lib/site';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { ArrowRight } from '@/components/ui/icons';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const path = `/${locale}/about`;
  return {
    title: dict.about.title,
    description: dict.about.lead,
    alternates: { canonical: path, languages: { en: '/en/about', ar: '/ar/about', 'x-default': '/en/about' } },
    openGraph: { title: dict.about.title, description: dict.about.lead, url: path },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [store, story] = await Promise.all([getStoreInfo(), getHomeSection('story')]);

  const storyImage = story?.imageUrl ?? '/media/brand/hero-2.webp';

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Attention Modest Fashion',
    alternateName: 'أتنشن للموضة المحتشمة',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? undefined,
    email: store.email,
    telephone: store.phone,
    address: { '@type': 'PostalAddress', addressLocality: store.city, addressCountry: 'BH' },
    description: dict.brand.description,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(orgJsonLd) }} />

      <section className="relative bg-ink text-paper">
        <div className="relative h-[46svh] min-h-[340px] w-full overflow-hidden md:h-[56svh]">
          <Image src={storyImage} alt={dict.about.title} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 to-ink/20" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="shell pb-10 md:pb-14">
              <h1 className="max-w-3xl text-h1 text-paper">{dict.about.title}</h1>
              <p className="mt-4 max-w-xl text-body text-paper/80">{dict.about.lead}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="shell py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:gap-20">
          <section>
            <p className="eyebrow mb-4">{dict.brand.name}</p>
            <h2 className="text-h2">{dict.about.storyTitle}</h2>
            <p className="mt-5 whitespace-pre-line text-body text-ink-muted">{dict.about.storyBody}</p>
          </section>
          <section>
            <p className="eyebrow mb-4">{dict.about.craftTitle}</p>
            <h2 className="text-h2">{dict.about.craftTitle}</h2>
            <p className="mt-5 whitespace-pre-line text-body text-ink-muted">{dict.about.craftBody}</p>
          </section>
        </div>

        <section className="mt-20 border-t border-line pt-14">
          <h2 className="text-h2">{dict.about.valuesTitle}</h2>
          <ul className="mt-8 grid gap-8 md:grid-cols-3">
            {[dict.about.value1, dict.about.value2, dict.about.value3].map((v, i) => (
              <li key={v} className="border-t border-ink pt-5">
                <span className="text-caption tabular-nums text-ink-faint">0{i + 1}</span>
                <p className="mt-2 text-h4">{v}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 grid items-center gap-10 border-t border-line pt-14 md:grid-cols-2">
          <div>
            <h2 className="text-h2">{dict.about.ctaTitle}</h2>
            <p className="mt-4 text-body text-ink-muted">{dict.about.ctaBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/${locale}/shop`} className="btn-primary">
                {dict.nav.shop}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
              <Link href={`/${locale}/contact`} className="btn-outline">
                {dict.nav.contact}
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6 text-small">
            <div>
              <dt className="eyebrow mb-2">{dict.common.email}</dt>
              <dd>
                <a href={`mailto:${store.email}`} className="link-underline">
                  {store.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="eyebrow mb-2">{dict.common.phone}</dt>
              <dd>
                <a href={`tel:${store.phone.replace(/\s/g, '')}`} className="link-underline">
                  {store.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="eyebrow mb-2">{dict.common.address}</dt>
              <dd className="text-ink-muted">
                {store.city}, {store.country}
              </dd>
            </div>
            <div>
              <dt className="eyebrow mb-2">{dict.brand.cr}</dt>
              <dd className="text-ink-muted">{store.cr}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
