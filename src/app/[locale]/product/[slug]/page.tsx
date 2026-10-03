import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, getRelatedProducts, stockLabel, localizedName } from '@/lib/catalog';
import { toProductCardData } from '@/lib/serialize';
import { getStoreInfo, getShippingMethods } from '@/lib/site';
import { ProductGallery } from '@/components/product/ProductGallery';
import { BuyPanel } from '@/components/product/BuyPanel';
import { Accordion } from '@/components/product/Accordion';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Price } from '@/components/ui/Price';
import { ArrowRight, WhatsAppIcon } from '@/components/ui/icons';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Not found' };
  const name = localizedName(product, locale);
  const description =
    (locale === 'ar' ? product.metaDescAr ?? product.descriptionAr : product.metaDescEn ?? product.descriptionEn) ??
    name;
  const path = `/${locale}/product/${product.slug}`;
  const image = product.media[0]?.url;
  return {
    title: (locale === 'ar' ? product.metaTitleAr : product.metaTitleEn) ?? name,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: `/en/product/${product.slug}`,
        ar: `/ar/product/${product.slug}`,
        'x-default': `/en/product/${product.slug}`,
      },
    },
    openGraph: {
      title: name,
      description,
      url: path,
      type: 'website',
      images: image ? [{ url: image, alt: name }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const product = await getProductBySlug(slug);
  if (!product || product.status !== 'ACTIVE') notFound();

  const [related, store, shipping] = await Promise.all([
    getRelatedProducts(product, 4),
    getStoreInfo(),
    getShippingMethods(),
  ]);

  const name = localizedName(product, locale);
  const subtitle = locale === 'ar' ? product.subtitleAr : product.subtitleEn;
  const description = locale === 'ar' ? product.descriptionAr : product.descriptionEn;
  const details = locale === 'ar' ? product.detailsAr : product.detailsEn;
  const materials = locale === 'ar' ? product.materialsAr : product.materialsEn;
  const care = locale === 'ar' ? product.careAr : product.careEn;
  const stock = stockLabel(product);
  const priceBhd = Number(product.priceBhd);
  const compareAt = product.compareAtBhd != null ? Number(product.compareAtBhd) : null;
  const category = product.categories[0]?.category;
  const collection = product.collections[0]?.collection;

  const images = product.media.map((m) => ({
    url: m.url,
    alt: (locale === 'ar' ? m.altAr : m.altEn) ?? name,
  }));

  const bhShipping = shipping.find((s) => s.code === 'bh-standard') ?? shipping[0];
  const etaMin = bhShipping?.etaMinDays ?? 2;
  const etaMax = bhShipping?.etaMaxDays ?? 5;

  const variants = product.variants.map((v) => ({
    id: v.id,
    size: v.size,
    colorEn: v.colorEn,
    colorAr: v.colorAr,
    stock: v.stock,
    stockStatus: v.stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER',
  }));

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: (description ?? name).replace(/<[^>]*>/g, ' ').slice(0, 500),
    sku: product.sku ?? product.slug,
    image: images.map((i) => i.url),
    brand: { '@type': 'Brand', name: 'Attention Modest Fashion' },
    category: category ? localizedName(category, locale) : undefined,
    material: materials ? materials.replace(/<[^>]*>/g, ' ').trim() : undefined,
    offers: {
      '@type': 'Offer',
      url: `/${locale}/product/${product.slug}`,
      priceCurrency: 'BHD',
      price: priceBhd.toFixed(3),
      availability:
        stock === 'OUT_OF_STOCK' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Attention Modest Fashion' },
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.nav.home, item: `/${locale}` },
      { '@type': 'ListItem', position: 2, name: dict.nav.shop, item: `/${locale}/shop` },
      ...(category
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: localizedName(category, locale),
              item: `/${locale}/shop?category=${category.slug}`,
            },
          ]
        : []),
      { '@type': 'ListItem', position: category ? 4 : 3, name, item: `/${locale}/product/${product.slug}` },
    ],
  };

  const accordionItems = [
    { title: dict.product.description, body: description ?? '' },
    { title: dict.product.details, body: details ?? '' },
    { title: dict.product.materials, body: materials ?? '' },
    { title: dict.product.care, body: care ?? '' },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="shell pt-8 md:pt-12">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-caption uppercase tracking-[0.12em] text-ink-muted">
            <li>
              <Link href={`/${locale}`} className="link-underline">
                {dict.nav.home}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/${locale}/shop`} className="link-underline">
                {dict.nav.shop}
              </Link>
            </li>
            {category ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/${locale}/shop?category=${category.slug}`} className="link-underline">
                    {localizedName(category, locale)}
                  </Link>
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
          {/* Gallery */}
          <div>
            <ProductGallery images={images} productName={name} />
          </div>

          {/* Sticky information panel */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-wrap items-center gap-3">
              {stock === 'PRE_ORDER' || product.madeToOrder ? (
                <span className="border border-ink px-2.5 py-1 text-caption uppercase tracking-[0.14em]">
                  {dict.product.madeToOrderInfo}
                </span>
              ) : null}
              {product.isNewArrival ? (
                <span className="bg-ink px-2.5 py-1 text-caption uppercase tracking-[0.14em] text-paper">
                  {dict.nav.newArrivals}
                </span>
              ) : null}
            </div>

            {category ? (
              <Link
                href={`/${locale}/shop?category=${category.slug}`}
                className="link-underline mt-5 inline-block text-caption uppercase tracking-[0.16em] text-ink-muted"
              >
                {localizedName(category, locale)}
              </Link>
            ) : null}
            <h1 className="mt-2 text-h1">{name}</h1>
            {subtitle ? <p className="mt-2 text-body text-ink-muted">{subtitle}</p> : null}

            <div className="mt-5 flex items-center gap-3">
              <Price amountBhd={priceBhd} compareAtBhd={compareAt} locale={locale} className="text-h3" />
            </div>
            <p className="mt-2 text-caption uppercase tracking-[0.12em] text-ink-faint">
              {locale === 'ar' ? 'الأسعار تشمل الضريبة' : 'Prices include VAT'}
            </p>

            <BuyPanel
              productId={product.id}
              productSlug={product.slug}
              variants={variants}
              madeToOrder={product.madeToOrder}
              leadTimeMin={product.leadTimeMinDays}
              leadTimeMax={product.leadTimeMaxDays}
              dict={dict}
              locale={locale}
              sizeGuideHref={`/${locale}/size-guide`}
            />

            <div className="mt-6">
              <Accordion items={accordionItems} />
            </div>

            <div className="mt-6 space-y-2 border-t border-line pt-6 text-small text-ink-muted">
              <p>
                {dict.product.delivery}: {etaMin}–{etaMax} {locale === 'ar' ? 'أيام عمل' : 'working days'} ·{' '}
                {store.city}
              </p>
              {product.madeToOrder ? (
                <p>
                  {dict.product.leadTime}: {product.leadTimeMinDays}–{product.leadTimeMaxDays}{' '}
                  {locale === 'ar' ? 'يوماً' : 'days'}
                </p>
              ) : null}
              {collection ? (
                <p>
                  <Link href={`/${locale}/collections/${collection.slug}`} className="link-underline">
                    {dict.nav.collections}: {localizedName(collection, locale)}
                  </Link>
                </p>
              ) : null}
            </div>

            <a
              href={store.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-small text-ink-muted transition-colors hover:text-ink"
            >
              <WhatsAppIcon className="h-4 w-4" />
              {dict.product.whatsappHelp}
            </a>
          </div>
        </div>

        {/* Related */}
        {related.length ? (
          <section aria-labelledby="related-heading" className="mt-20 border-t border-line pt-14 md:mt-28">
            <header className="mb-8 flex items-end justify-between gap-6 md:mb-10">
              <h2 id="related-heading" className="text-h2">
                {dict.product.similar}
              </h2>
              <Link
                href={`/${locale}/shop`}
                className="link-underline inline-flex items-center gap-2 text-caption uppercase tracking-[0.14em] text-ink-muted"
              >
                {dict.home.viewAll}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </header>
            <ProductGrid cards={related.map(toProductCardData)} locale={locale} dict={dict} />
          </section>
        ) : null}
      </div>
    </>
  );
}
