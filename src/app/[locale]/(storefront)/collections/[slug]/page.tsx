import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCollectionBySlug, getProducts } from '@/lib/catalog';
import { toProductCardData } from '@/lib/serialize';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: 'Not found' };
  const name = locale === 'ar' ? collection.nameAr : collection.nameEn;
  const description =
    (locale === 'ar' ? collection.descriptionAr ?? collection.taglineAr : collection.descriptionEn ?? collection.taglineEn) ??
    name;
  const path = `/${locale}/collections/${collection.slug}`;
  return {
    title: name,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: `/en/collections/${collection.slug}`,
        ar: `/ar/collections/${collection.slug}`,
        'x-default': `/en/collections/${collection.slug}`,
      },
    },
    openGraph: {
      title: name,
      description,
      url: path,
      images: collection.heroImage ? [{ url: collection.heroImage, alt: name }] : undefined,
    },
  };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const collection = await getCollectionBySlug(slug);
  if (!collection || !collection.isActive) notFound();

  const result = await getProducts({ locale, collectionSlug: slug, sort: 'newest', perPage: 24 });
  const cards = result.items.map(toProductCardData);

  const name = locale === 'ar' ? collection.nameAr : collection.nameEn;
  const tagline = locale === 'ar' ? collection.taglineAr : collection.taglineEn;
  const description = locale === 'ar' ? collection.descriptionAr : collection.descriptionEn;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.nav.home, item: `/${locale}` },
      { '@type': 'ListItem', position: 2, name: dict.collections.title, item: `/${locale}/collections` },
      { '@type': 'ListItem', position: 3, name, item: `/${locale}/collections/${collection.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Editorial collection hero */}
      <section className="relative bg-ink text-paper">
        <div className="relative h-[52svh] min-h-[380px] w-full overflow-hidden md:h-[62svh]">
          {collection.heroImage ? (
            <Image src={collection.heroImage} alt={name} fill priority sizes="100vw" className="object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/25 to-ink/10" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="shell pb-10 md:pb-14">
              <nav aria-label="Breadcrumb" className="mb-5">
                <ol className="flex items-center gap-2 text-caption uppercase tracking-[0.12em] text-paper/70">
                  <li>
                    <Link href={`/${locale}`} className="link-underline">
                      {dict.nav.home}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link href={`/${locale}/collections`} className="link-underline">
                      {dict.collections.title}
                    </Link>
                  </li>
                </ol>
              </nav>
              <h1 className="text-h1 text-paper">{name}</h1>
              {tagline ? <p className="mt-3 max-w-xl text-body text-paper/80">{tagline}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="shell py-12 md:py-16">
        {description ? (
          <p className="mx-auto mb-12 max-w-prose text-center text-body text-ink-muted">{description}</p>
        ) : null}

        <div className="mb-8 flex items-baseline justify-between border-b border-line pb-4">
          <p className="text-small text-ink-muted">
            {result.total} {dict.collections.pieces}
          </p>
          <Link href={`/${locale}/shop`} className="link-underline text-caption uppercase tracking-[0.14em] text-ink-muted">
            {dict.shop.title}
          </Link>
        </div>

        {cards.length === 0 ? (
          <EmptyState
            title={dict.collections.empty}
            body={dict.shop.noResultsBody}
            actionLabel={dict.shop.allCategories}
            actionHref={`/${locale}/shop`}
          />
        ) : (
          <Suspense fallback={<ProductGridSkeleton count={12} />}>
            <ProductGrid cards={cards} locale={locale} dict={dict} priorityCount={4} />
          </Suspense>
        )}
      </div>
    </>
  );
}
