import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getHomeSection, getStoreInfo, getSocialLinks, getActivePromotions } from '@/lib/site';
import { FeaturedProducts, NewArrivalsRail } from '@/components/home/FeaturedProducts';
import { FeaturedCollections } from '@/components/home/FeaturedCollections';
import { ArrowRight, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/icons';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const path = `/${locale}`;
  return {
    title: dict.brand.tagline,
    description: dict.brand.description,
    alternates: {
      canonical: path,
      languages: { en: '/en', ar: '/ar', 'x-default': '/en' },
    },
    openGraph: {
      title: `${dict.brand.name} — ${dict.brand.tagline}`,
      description: dict.brand.description,
      url: path,
      images: ['/media/brand/hero-1.webp'],
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [hero, story, madeToOrder, social, store, socials, promotions] = await Promise.all([
    getHomeSection('hero'),
    getHomeSection('story'),
    getHomeSection('made_to_order'),
    getHomeSection('social'),
    getStoreInfo(),
    getSocialLinks(),
    getActivePromotions(),
  ]);

  const banners = promotions.filter((p) => p.placement === 'home_banner');

  const heroTitle = locale === 'ar' ? hero?.titleAr : hero?.titleEn;
  const heroBody = locale === 'ar' ? hero?.bodyAr : hero?.bodyEn;
  const heroCta = locale === 'ar' ? hero?.ctaLabelAr : hero?.ctaLabelEn;

  return (
    <>
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative bg-ink text-paper">
        <div className="relative h-[76svh] min-h-[520px] w-full overflow-hidden md:h-[86svh] md:min-h-[600px]">
          {hero?.imageUrl ? (
            <Image
              src={hero.imageUrl}
              alt={heroTitle ?? dict.brand.name}
              fill
              priority
              sizes="100vw"
              className="hidden object-cover md:block"
            />
          ) : null}
          {hero?.mobileImageUrl ? (
            <Image
              src={hero.mobileImageUrl}
              alt={heroTitle ?? dict.brand.name}
              fill
              priority
              sizes="100vw"
              className="object-cover md:hidden"
            />
          ) : hero?.imageUrl ? (
            <Image
              src={hero.imageUrl}
              alt={heroTitle ?? dict.brand.name}
              fill
              priority
              sizes="100vw"
              className="object-cover md:hidden"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-ink/10" />

          <div className="absolute inset-x-0 bottom-0">
            <div className="shell pb-10 md:pb-16">
              <p className="mb-4 text-caption uppercase tracking-[0.4em] text-paper/70">
                {store.city} · {store.country}
              </p>
              <h1 className="max-w-3xl text-display text-paper">
                {heroTitle ?? dict.brand.name}
              </h1>
              {heroBody ? (
                <p className="mt-5 max-w-lg text-body text-paper/80">{heroBody}</p>
              ) : null}
              <Link
                href={hero?.ctaHref ? `/${locale}/${hero.ctaHref.replace(/^\//, '')}` : `/${locale}/shop`}
                className="btn mt-8 border border-paper bg-transparent text-paper hover:bg-paper hover:text-ink"
              >
                {heroCta ?? dict.home.discoverCollection}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── ADMIN BANNERS (Promotions → home_banner) ──── */}
      {banners.map((b) => {
        const title = locale === 'ar' ? b.titleAr : b.titleEn;
        const body = (locale === 'ar' ? b.bodyAr : b.bodyEn) ?? '';
        const cta = locale === 'ar' ? b.ctaLabelAr : b.ctaLabelEn;
        return (
          <section key={b.id} aria-label={title} className="border-b border-line bg-ink text-paper">
            <div className="shell grid items-center gap-8 py-12 md:grid-cols-2 md:py-16">
              <div>
                <h2 className="text-h2 text-paper">{title}</h2>
                {body ? <p className="mt-4 max-w-md whitespace-pre-line text-body text-paper/70">{body}</p> : null}
                {b.ctaHref ? (
                  <Link href={b.ctaHref} className="btn mt-7 border border-paper bg-transparent text-paper hover:bg-paper hover:text-ink">
                    {cta ?? dict.home.viewAll}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                ) : null}
              </div>
              {b.imageUrl ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image src={b.imageUrl} alt={title} fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover" />
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      {/* ── FEATURED COLLECTIONS ─────────────────────── */}
      <FeaturedCollections locale={locale} />

      {/* ── NEW ARRIVALS ─────────────────────────────── */}
      <NewArrivalsRail locale={locale} />

      {/* ── FEATURED PRODUCTS ────────────────────────── */}
      <FeaturedProducts locale={locale} />

      {/* ── BRAND STORY ──────────────────────────────── */}
      <section aria-labelledby="story-heading" className="border-y border-line bg-sand-50">
        <div className="grid md:grid-cols-2">
          <div className="relative min-h-[360px] md:min-h-[560px]">
            {story?.imageUrl ? (
              <Image
                src={story.imageUrl}
                alt={locale === 'ar' ? story.titleAr ?? dict.home.ourStory : story.titleEn ?? dict.home.ourStory}
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="flex items-center px-[var(--shell-x)] py-14 md:py-20">
            <div className="max-w-lg">
              <p className="eyebrow mb-4">{dict.brand.name}</p>
              <h2 id="story-heading" className="text-h2">
                {(locale === 'ar' ? story?.titleAr : story?.titleEn) ?? dict.home.ourStory}
              </h2>
              <p className="mt-5 whitespace-pre-line text-body text-ink-muted">
                {(locale === 'ar' ? story?.bodyAr : story?.bodyEn) ?? ''}
              </p>
              <Link
                href={story?.ctaHref ? `/${locale}/${story.ctaHref.replace(/^\//, '')}` : `/${locale}/about`}
                className="btn-outline mt-8"
              >
                {(locale === 'ar' ? story?.ctaLabelAr : story?.ctaLabelEn) ?? dict.home.discoverAttention}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── MADE TO ORDER ────────────────────────────── */}
      <section aria-labelledby="mto-heading" className="shell py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <p className="eyebrow mb-4">{dict.product.madeToOrderInfo}</p>
            <h2 id="mto-heading" className="text-h2">
              {(locale === 'ar' ? madeToOrder?.titleAr : madeToOrder?.titleEn) ?? dict.home.madeToOrderTitle}
            </h2>
            <p className="mt-5 whitespace-pre-line text-body text-ink-muted">
              {(locale === 'ar' ? madeToOrder?.bodyAr : madeToOrder?.bodyEn) ?? dict.home.madeToOrderBody}
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                locale === 'ar' ? 'قياسات مصمّمة على مقاسك' : 'Cut to your measurements',
                locale === 'ar' ? 'تشطيب يدوي دقيق' : 'Hand-finished detailing',
                locale === 'ar' ? 'مدة تنفيذ واضحة' : 'A clear, agreed lead time',
                locale === 'ar' ? 'إمكانية التعديل عند الحاجة' : 'Modifications where possible',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-small text-ink-muted">
                  <span className="h-px w-6 bg-ink" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={
                madeToOrder?.ctaHref
                  ? `/${locale}/${madeToOrder.ctaHref.replace(/^\//, '')}`
                  : `/${locale}/collections/made-to-order`
              }
              className="btn-primary mt-8"
            >
              {(locale === 'ar' ? madeToOrder?.ctaLabelAr : madeToOrder?.ctaLabelEn) ?? dict.home.exploreMadeToOrder}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="relative aspect-[4/5] w-full bg-sand-100 md:col-span-7 md:aspect-[4/3]">
            {madeToOrder?.imageUrl ? (
              <Image
                src={madeToOrder.imageUrl}
                alt={(locale === 'ar' ? madeToOrder.titleAr : madeToOrder.titleEn) ?? dict.home.madeToOrderTitle}
                fill
                sizes="(max-width: 767px) 100vw, 58vw"
                className="object-cover"
              />
            ) : null}
          </div>
        </div>
      </section>

      {/* ── SOCIAL ───────────────────────────────────── */}
      {socials.length ? (
        <section aria-labelledby="social-heading" className="border-t border-line bg-ink text-paper">
          <div className="shell py-14 text-center md:py-20">
            <p className="eyebrow mb-4 text-paper/60">{dict.common.followUs}</p>
            <h2 id="social-heading" className="text-h2 text-paper">
              {(locale === 'ar' ? social?.titleAr : social?.titleEn) ?? dict.home.socialTitle}
            </h2>
            {(locale === 'ar' ? social?.bodyAr : social?.bodyEn) ? (
              <p className="mx-auto mt-4 max-w-xl text-body text-paper/70">
                {locale === 'ar' ? social?.bodyAr : social?.bodyEn}
              </p>
            ) : null}
            <ul className="mt-8 flex items-center justify-center gap-6">
              {socials.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={(locale === 'ar' ? s.labelAr : s.labelEn) ?? s.platform}
                    className="flex items-center gap-2 border border-paper/30 px-5 py-3 text-caption uppercase tracking-[0.14em] text-paper transition-colors hover:bg-paper hover:text-ink"
                  >
                    {s.platform === 'instagram' ? <InstagramIcon className="h-4 w-4" /> : null}
                    {s.platform === 'tiktok' ? <TikTokIcon className="h-4 w-4" /> : null}
                    {s.platform === 'whatsapp' ? <WhatsAppIcon className="h-4 w-4" /> : null}
                    {s.platform === 'instagram' ? 'Instagram' : s.platform === 'tiktok' ? 'TikTok' : 'WhatsApp'}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
