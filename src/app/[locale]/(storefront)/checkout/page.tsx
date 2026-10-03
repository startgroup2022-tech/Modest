import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCartView } from '@/lib/cart';
import { getShippingMethods, getStoreInfo } from '@/lib/site';
import { listEnabledPaymentMethods } from '@/lib/payments';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.checkout.title, robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [cart, shipping, methods, user, store] = await Promise.all([
    getCartView(),
    getShippingMethods(),
    listEnabledPaymentMethods(),
    getCurrentUser(),
    getStoreInfo(),
  ]);

  if (!cart.items.length) {
    return (
      <div className="shell pt-16">
        <EmptyState
          title={dict.checkout.emptyCart}
          body={dict.cart.emptyBody}
          actionLabel={dict.cart.startShopping}
          actionHref={`/${locale}/shop`}
        />
      </div>
    );
  }

  const profile = user
    ? { firstName: user.firstName ?? '', lastName: user.lastName ?? '', phone: user.phone }
    : null;

  const checkoutSettings = await prisma.siteSetting.findUnique({ where: { key: 'checkout' } });
  const settings = (checkoutSettings?.value ?? {}) as {
    allowGuestCheckout?: boolean;
    enableCoupons?: boolean;
    enableOrderNotes?: boolean;
    requirePhone?: boolean;
  };

  return (
    <div className="shell pt-10 md:pt-14">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-caption uppercase tracking-[0.12em] text-ink-muted">
          <li>
            <Link href={`/${locale}`} className="link-underline">
              {dict.nav.home}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/${locale}/cart`} className="link-underline">
              {dict.cart.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink">{dict.checkout.title}</li>
        </ol>
      </nav>

      <header className="mb-8 border-b border-line pb-6">
        <h1 className="text-h1">{dict.checkout.title}</h1>
      </header>

      <CheckoutForm
        locale={locale}
        dict={dict}
        signedIn={Boolean(user)}
        profile={profile}
        cart={cart}
        shipping={shipping.map((s) => ({
          code: s.code,
          name: locale === 'ar' ? s.nameAr : s.nameEn,
          priceBhd: Number(s.priceBhd),
          etaMin: s.etaMinDays,
          etaMax: s.etaMaxDays,
        }))}
        methods={methods.map((m) => ({
          method: m.method,
          label: locale === 'ar' ? m.labelAr : m.labelEn,
          description: locale === 'ar' ? m.descriptionAr : m.descriptionEn,
        }))}
        store={store}
        settings={{
          enableCoupons: settings.enableCoupons ?? true,
          enableOrderNotes: settings.enableOrderNotes ?? true,
          allowGuestCheckout: settings.allowGuestCheckout ?? true,
        }}
      />
    </div>
  );
}
