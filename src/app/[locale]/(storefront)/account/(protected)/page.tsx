import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAccountStats, getMyOrders, getMyWishlistProducts } from '@/lib/account';
import { getCustomerMembership } from '@/lib/membership-db';
import { customerStatusKey } from '@/lib/order-status';
import { getDictionary, type Dict } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { formatMoney } from '@/lib/utils';
import { Price } from '@/components/ui/Price';
import { EmptyState } from '@/components/ui/EmptyState';
import { PackageIcon, HeartIcon, RulerIcon, ArrowRight } from '@/components/ui/icons';

export default async function AccountOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const [stats, orders, wishlist, membership] = await Promise.all([
    getAccountStats(user.customerId),
    getMyOrders(user.customerId),
    getMyWishlistProducts(user.customerId),
    getCustomerMembership(user.customerId),
  ]);

  const recent = orders.slice(0, 3);
  const tierName = membership.tier ? (locale === 'ar' ? membership.tier.nameAr : membership.tier.nameEn) : null;

  return (
    <div className="space-y-12">
      {tierName ? (
        <section className="border border-line p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">{dict.account.membership}</p>
              <p className="text-h3">{tierName}</p>
            </div>
            <p className="text-small text-ink-muted">
              {dict.account.membershipPieces}: <span className="tabular-nums">{membership.qualifyingCount}</span>
            </p>
          </div>
          {membership.nextTier ? (
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-caption text-ink-muted">
                <span>
                  {dict.account.membershipProgress} — {locale === 'ar' ? membership.nextTier.nameAr : membership.nextTier.nameEn}
                </span>
                <span className="tabular-nums">{membership.percent}%</span>
              </div>
              <div className="h-px w-full bg-line">
                <div className="h-px bg-ink" style={{ width: `${membership.percent}%` }} />
              </div>
              {membership.toNext != null ? (
                <p className="mt-2 text-caption text-ink-faint">
                  {membership.toNext} {dict.account.membershipPieces}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-line p-6">
          <p className="eyebrow mb-2">{dict.account.orders}</p>
          <p className="text-h2 tabular-nums">{stats.orderCount}</p>
        </div>
        <div className="border border-line p-6">
          <p className="eyebrow mb-2">{dict.account.totalSpent}</p>
          <Price amountBhd={stats.totalSpentBhd} locale={locale} className="text-h2" />
        </div>
        <div className="border border-line p-6">
          <p className="eyebrow mb-2">{dict.account.wishlist}</p>
          <p className="text-h2 tabular-nums">{wishlist.length}</p>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-h3">{dict.account.orders}</h2>
          <Link href={`/${locale}/account/orders`} className="link-underline text-caption uppercase tracking-[0.14em] text-ink-muted">
            {dict.home.viewAll}
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<PackageIcon className="h-6 w-6" />}
            title={dict.account.noOrders}
            body={dict.account.noOrdersBody}
            actionLabel={dict.nav.shop}
            actionHref={`/${locale}/shop`}
          />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <Link href={`/${locale}/account/orders/${o.orderNumber}`} className="link-underline text-body">
                    {o.orderNumber}
                  </Link>
                  <p className="mt-1 text-caption text-ink-muted">
                    {o.createdAt.toISOString().slice(0, 10)} · {o.items.length} {dict.account.itemsCount}
                  </p>
                </div>
                <div className="text-end">
                  <Price amountBhd={Number(o.totalBhd)} locale={locale} />
                  <p className="mt-1 text-caption uppercase tracking-[0.1em] text-ink-faint">
                    {dict.order[customerStatusKey(o.status) as keyof Dict['order']]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href={`/${locale}/account/measurements`} className="group flex items-start gap-4 border border-line p-6 transition-colors hover:border-ink">
          <RulerIcon className="mt-0.5 h-5 w-5 text-ink-muted" />
          <div>
            <p className="text-h4">{dict.account.measurements}</p>
            <p className="mt-1 text-small text-ink-muted">{dict.account.measurementsBody}</p>
          </div>
          <ArrowRight className="ms-auto h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-1 rtl:rotate-180" />
        </Link>
        <Link href={`/${locale}/account/wishlist`} className="group flex items-start gap-4 border border-line p-6 transition-colors hover:border-ink">
          <HeartIcon className="mt-0.5 h-5 w-5 text-ink-muted" />
          <div>
            <p className="text-h4">{dict.account.wishlist}</p>
            <p className="mt-1 text-small text-ink-muted">{dict.account.wishlistBody}</p>
          </div>
          <ArrowRight className="ms-auto h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-1 rtl:rotate-180" />
        </Link>
      </section>
    </div>
  );
}
