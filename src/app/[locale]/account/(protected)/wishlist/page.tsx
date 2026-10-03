import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyWishlistProducts } from '@/lib/account';
import { toProductCardData } from '@/lib/serialize';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeartIcon } from '@/components/ui/icons';

export default async function AccountWishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const products = await getMyWishlistProducts(user.customerId);
  const cards = products.map(toProductCardData);

  if (!cards.length) {
    return (
      <EmptyState
        icon={<HeartIcon className="h-6 w-6" />}
        title={dict.account.noWishlist}
        body={dict.account.noWishlistBody}
        actionLabel={dict.nav.shop}
        actionHref={`/${locale}/shop`}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-6 border-b border-line pb-3 text-h3">{dict.account.wishlist}</h2>
      <ProductGrid cards={cards} locale={locale} dict={dict} />
    </div>
  );
}
