import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCartView } from '@/lib/cart';
import { getShippingMethods } from '@/lib/site';
import { CartView } from '@/components/cart/CartView';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.cart.title, robots: { index: false, follow: true } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [cart, shipping] = await Promise.all([getCartView(), getShippingMethods()]);

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
          <li className="text-ink">{dict.cart.title}</li>
        </ol>
      </nav>

      <header className="mb-8 border-b border-line pb-6">
        <h1 className="text-h1">{dict.cart.title}</h1>
      </header>

      <CartView
        locale={locale}
        dict={dict}
        initialCart={cart}
        shipping={shipping.map((s) => ({
          code: s.code,
          name: locale === 'ar' ? s.nameAr : s.nameEn,
          priceBhd: Number(s.priceBhd),
          etaMin: s.etaMinDays,
          etaMax: s.etaMaxDays,
        }))}
      />
    </div>
  );
}
