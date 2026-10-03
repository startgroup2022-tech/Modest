import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyOrders } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { Price } from '@/components/ui/Price';
import { EmptyState } from '@/components/ui/EmptyState';
import { PackageIcon } from '@/components/ui/icons';

function statusMap() {
  return {
    PENDING: 'placed',
    CONFIRMED: 'confirmed',
    PREPARING: 'preparing',
    IN_PRODUCTION: 'inProduction',
    QUALITY_CHECK: 'qualityCheck',
    READY: 'ready',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  } as const;
}

export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const orders = await getMyOrders(user.customerId);
  const map = statusMap();

  if (!orders.length) {
    return (
      <EmptyState
        icon={<PackageIcon className="h-6 w-6" />}
        title={dict.account.noOrders}
        body={dict.account.noOrdersBody}
        actionLabel={dict.nav.shop}
        actionHref={`/${locale}/shop`}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-6 border-b border-line pb-3 text-h3">{dict.account.orders}</h2>
      <ul className="divide-y divide-line">
        {orders.map((o) => {
          const label = map[o.status as keyof typeof map] ?? 'placed';
          return (
            <li key={o.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link href={`/${locale}/account/orders/${o.orderNumber}`} className="link-underline text-h4">
                    {o.orderNumber}
                  </Link>
                  <p className="mt-1 text-caption text-ink-muted">
                    {dict.account.orderDate}: {o.createdAt.toISOString().slice(0, 10)}
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">
                    {o.items.length} {dict.account.itemsCount} · {o.items[0]?.productName}
                    {o.items.length > 1 ? ` +${o.items.length - 1}` : ''}
                  </p>
                </div>
                <div className="text-end">
                  <Price amountBhd={Number(o.totalBhd)} locale={locale} />
                  <p className="mt-1 text-caption uppercase tracking-[0.12em] text-ink-faint">{dict.order[label]}</p>
                </div>
              </div>
              <Link
                href={`/${locale}/account/orders/${o.orderNumber}`}
                className="link-underline mt-3 inline-block text-caption uppercase tracking-[0.14em] text-ink-muted"
              >
                {dict.account.viewDetails}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
