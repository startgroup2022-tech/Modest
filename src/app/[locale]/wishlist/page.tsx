import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getWishlistIds } from '@/lib/cart';
import { getMyWishlistProducts } from '@/lib/account';
import { getProductsByIds, stockLabel } from '@/lib/catalog';
import { toProductCardData } from '@/lib/serialize';
import { WishlistGrid, type WishlistEntry } from '@/components/product/WishlistGrid';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.wishlist.title,
    robots: { index: false, follow: true },
  };
}

/** First in-stock variant, so the wishlist can offer a one-tap move to bag. */
function defaultVariant(media: { variants: { id: string; stock: number; stockStatus: string }[] }): string | null {
  const inStock = media.variants.find((v) => v.stockStatus === 'IN_STOCK' && v.stock > 0);
  return inStock?.id ?? media.variants[0]?.id ?? null;
}

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const user = await getCurrentUser();
  const ids = await getWishlistIds();

  // Authenticated wishlists read through the account query (single source of truth);
  // guest wishlists resolve the cookie-held ids directly.
  const rows = user?.customerId
    ? await getMyWishlistProducts(user.customerId)
    : (await getProductsByIds(ids)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const entries: WishlistEntry[] = rows.map((p) => ({
    card: toProductCardData(p),
    defaultVariantId: p.variants.length && stockLabel(p) !== 'OUT_OF_STOCK' ? defaultVariant(p) : null,
  }));

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
          <li className="text-ink">{dict.wishlist.title}</li>
        </ol>
      </nav>

      <header className="mb-8 border-b border-line pb-6">
        <h1 className="text-h1">{dict.wishlist.title}</h1>
      </header>

      <WishlistGrid entries={entries} locale={locale} dict={dict} />
    </div>
  );
}
