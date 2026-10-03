import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { Toast } from '@/components/ui/Toast';
import { StoreProvider } from '@/components/providers/StoreProvider';
import { getStorefrontContext } from '@/lib/storefront';
import { getActivePromotions } from '@/lib/site';
import { getCurrentUser } from '@/lib/auth';
import { isLocale } from '@/i18n/config';
import { SiteJsonLd } from '@/components/seo/SiteJsonLd';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [ctx, user, promotions] = await Promise.all([
    getStorefrontContext(locale),
    getCurrentUser(),
    getActivePromotions(),
  ]);
  const announcements = promotions
    .filter((p) => p.placement === 'announcement')
    .map((p) => ({
      id: p.id,
      titleEn: p.titleEn,
      titleAr: p.titleAr,
      ctaLabelEn: p.ctaLabelEn,
      ctaLabelAr: p.ctaLabelAr,
      ctaHref: p.ctaHref,
    }));

  return (
    <StoreProvider
      initialCart={ctx.cart}
      initialWishlist={ctx.wishlist}
      initialCurrency={ctx.currency.code}
      currencyMeta={ctx.currencyMeta}
    >
      <SiteJsonLd locale={locale} />
      <div className="flex min-h-screen flex-col">
        <AnnouncementBar promos={announcements} locale={locale} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-caption focus:text-paper"
        >
          Skip to content
        </a>
        <Header
          locale={locale}
          dict={ctx.dict}
          categories={ctx.categories.map((c) => ({ slug: c.slug, name: c.name }))}
          collections={ctx.collections.map((c) => ({ slug: c.slug, name: c.name }))}
        />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer
          locale={locale}
          dict={ctx.dict}
          store={ctx.store}
          socials={ctx.socials}
          currencies={ctx.currencyOptions}
          categories={ctx.categories.map((c) => ({ slug: c.slug, name: c.name }))}
          collections={ctx.collections.map((c) => ({ slug: c.slug, name: c.name }))}
        />
        <MobileBottomNav locale={locale} dict={ctx.dict} />
        <CartDrawer locale={locale} dict={ctx.dict} />
        <SearchOverlay locale={locale} dict={ctx.dict} />
        <Toast />
        <input type="hidden" name="signed-in" value={user ? '1' : '0'} />
      </div>
    </StoreProvider>
  );
}
