import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { listOrders, resolveRange } from '@/lib/admin/queries';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDateTime, label } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminPagination, AdminEmpty } from '@/components/admin/ui';
import { SearchFilter, SelectFilter, DateRangeFilter, ClearFilters } from '@/components/admin/Filters';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Orders', robots: { index: false, follow: false } };

const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'IN_PRODUCTION', 'QUALITY_CHECK',
  'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED',
];
const CHANNELS = ['ONLINE', 'QUICK_ORDER', 'WHATSAPP', 'INSTAGRAM', 'PHONE', 'WALK_IN', 'MANUAL'];
const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('orders.view', locale);
  const dict = getAdminDict(locale);
  const sp = await searchParams;

  const range = resolveRange({ range: sp.range, from: sp.from, to: sp.to });
  const result = await listOrders({
    q: sp.q,
    status: sp.status,
    channel: sp.channel,
    paymentStatus: sp.paymentStatus,
    range: sp.range || sp.from || sp.to ? range : undefined,
    sort: (sp.sort as 'newest') ?? 'newest',
    page: Number(sp.page ?? '1') || 1,
  });

  const href = (p: string) => adminHref(locale, p);
  const buildHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') next.set(k, v);
    next.set('page', String(page));
    return `${href('orders')}?${next.toString()}`;
  };

  const rangeOptions = [
    { value: 'last30', label: dict.common.last30 },
    { value: 'today', label: dict.common.today },
    { value: 'yesterday', label: dict.common.yesterday },
    { value: 'last7', label: dict.common.last7 },
    { value: 'thisMonth', label: dict.common.thisMonth },
    { value: 'lastMonth', label: dict.common.lastMonth },
    { value: 'custom', label: dict.common.custom },
    { value: 'all', label: dict.common.all },
  ];

  return (
    <>
      <PageHeader
        title={dict.orders.title}
        subtitle={dict.orders.subtitle}
        actions={
          <>
            <Link href={href('reports/orders')} className="adm-btn-outline">
              {dict.common.exportExcel}
            </Link>
            <Link href={href('orders/quick')} className="adm-btn-primary">
              + {dict.orders.placeOrder}
            </Link>
          </>
        }
      />

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <SearchFilter placeholder={dict.common.search} className="w-full sm:w-64" />
          <SelectFilter
            name="status"
            label={dict.common.status}
            value={sp.status ?? 'ALL'}
            options={[
              { value: 'ALL', label: `${dict.common.status}: ${dict.common.all}` },
              ...ORDER_STATUSES.map((s) => ({ value: s, label: label(s, locale) })),
            ]}
          />
          <SelectFilter
            name="channel"
            label={dict.common.channel}
            value={sp.channel ?? 'ALL'}
            options={[
              { value: 'ALL', label: `${dict.common.channel}: ${dict.common.all}` },
              ...CHANNELS.map((c) => ({ value: c, label: label(c, locale) })),
            ]}
          />
          <SelectFilter
            name="paymentStatus"
            label={dict.orders.payment}
            value={sp.paymentStatus ?? 'ALL'}
            options={[
              { value: 'ALL', label: `${dict.orders.payment}: ${dict.common.all}` },
              ...PAYMENT_STATUSES.map((p) => ({ value: p, label: label(p, locale) })),
            ]}
          />
          <DateRangeFilter
            range={sp.range ?? 'last30'}
            from={sp.from}
            to={sp.to}
            options={rangeOptions}
            labels={{ from: dict.common.from, to: dict.common.to, custom: dict.common.custom }}
          />
          <SelectFilter
            name="sort"
            label={dict.common.date}
            value={sp.sort ?? 'newest'}
            options={[
              { value: 'newest', label: locale === 'ar' ? 'الأحدث' : 'Newest' },
              { value: 'oldest', label: locale === 'ar' ? 'الأقدم' : 'Oldest' },
              { value: 'total_desc', label: locale === 'ar' ? 'الأعلى قيمة' : 'Highest value' },
              { value: 'total_asc', label: locale === 'ar' ? 'الأدنى قيمة' : 'Lowest value' },
            ]}
          />
          <ClearFilters label={dict.common.clear} />
        </div>

        {result.rows.length === 0 ? (
          <AdminEmpty
            title={dict.common.empty}
            hint={dict.common.emptyHint}
            action={
              <Link href={href('orders/quick')} className="adm-btn-primary">
                + {dict.orders.placeOrder}
              </Link>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="adm-table adm-table-responsive">
                <thead>
                  <tr>
                    <th>{dict.orders.orderNumber}</th>
                    <th>{dict.common.customer}</th>
                    <th>{dict.common.channel}</th>
                    <th>{dict.orders.payment}</th>
                    <th className="text-end">{dict.common.total}</th>
                    <th>{dict.common.status}</th>
                    <th>{dict.common.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((o) => {
                    const payment = o.payments[0];
                    return (
                      <tr key={o.id}>
                        <td data-label={dict.orders.orderNumber}>
                          <Link href={href(`orders/${o.id}`)} className="link-underline font-medium text-ink">
                            {o.orderNumber}
                          </Link>
                          <span className="mt-0.5 block text-caption text-ink-faint">
                            {o.items.length} {locale === 'ar' ? 'عنصر' : 'items'}
                          </span>
                        </td>
                        <td data-label={dict.common.customer}>
                          <span className="block text-ink">{o.shippingName}</span>
                          <span className="block text-caption text-ink-faint">{o.email}</span>
                        </td>
                        <td data-label={dict.common.channel} className="text-ink-muted">{label(o.channel, locale)}</td>
                        <td data-label={dict.orders.payment}>
                          <span className="block text-caption text-ink-muted">
                            {payment ? label(payment.method, locale) : '—'}
                          </span>
                          {payment && <StatusBadge status={payment.status} label={label(payment.status, locale)} />}
                        </td>
                        <td data-label={dict.common.total} className="adm-num text-end font-medium">
                          {formatBhd(o.totalBhd, locale)}
                        </td>
                        <td data-label={dict.common.status}>
                          <StatusBadge status={o.status} label={label(o.status, locale)} />
                        </td>
                        <td data-label={dict.common.date} className="text-caption text-ink-faint">
                          {formatDateTime(o.createdAt, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              perPage={result.perPage}
              buildHref={buildHref}
              labels={{
                previous: dict.common.previous,
                next: dict.common.next,
                showing: dict.common.showing,
                of: dict.common.of,
                results: dict.common.results,
              }}
            />
          </>
        )}
      </Panel>
    </>
  );
}
