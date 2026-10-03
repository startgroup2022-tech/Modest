import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, AdminEmpty, AdminPagination } from '@/components/admin/ui';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { SearchFilter, ClearFilters } from '@/components/admin/Filters';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customers', robots: { index: false, follow: false } };

type Row = Prisma.CustomerGetPayload<{
  include: { user: true; orders: { select: { totalBhd: true; createdAt: true; status: true } } };
}>;

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('customers.view', locale);
  const dict = getAdminDict(locale);
  const sp = await searchParams;
  const href = (p: string) => adminHref(locale, p);

  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const perPage = 20;

  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    where.OR = [
      { user: { firstName: { contains: q } } },
      { user: { lastName: { contains: q } } },
      { user: { email: { contains: q } } },
      { phone: { contains: q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: true, orders: { select: { totalBhd: true, createdAt: true, status: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: dict.common.customer,
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink">
            {[c.user.firstName, c.user.lastName].filter(Boolean).join(' ') || c.user.email}
          </span>
          <span className="block text-caption text-ink-faint">{c.user.email}</span>
        </span>
      ),
    },
    { key: 'phone', header: dict.common.method, render: (c) => <span className="adm-num text-ink-muted">{c.phone ?? '—'}</span> },
    {
      key: 'orders',
      header: dict.customers.orderCount,
      align: 'end',
      render: (c) => <span className="adm-num">{formatNumber(c.orders.length, locale)}</span>,
    },
    {
      key: 'spent',
      header: dict.customers.totalSpent,
      align: 'end',
      render: (c) => (
        <span className="adm-num">
          {formatBhd(c.orders.reduce((s, o) => s + Number(o.totalBhd), 0), locale)}
        </span>
      ),
    },
    {
      key: 'joined',
      header: dict.common.createdAt,
      render: (c) => <span className="text-caption text-ink-faint">{formatDate(c.createdAt, locale)}</span>,
    },
  ];

  return (
    <>
      <PageHeader title={dict.customers.title} subtitle={dict.customers.subtitle} />
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <SearchFilter placeholder={`${dict.common.search}…`} className="w-full sm:w-64" />
          {q && <ClearFilters label={dict.common.clear} />}
          <span className="ms-auto text-caption text-ink-faint">
            {formatNumber(total, locale)} {dict.common.results}
          </span>
        </div>
        <AdminTable
          rows={rows}
          columns={columns}
          hrefFor={(c) => href(`customers/${c.id}`)}
          pathname={href('customers')}
          query={sp}
          empty={<AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />}
        />
        <AdminPagination
          page={page}
          pageCount={pageCount}
          total={total}
          perPage={perPage}
          buildHref={(p) => {
            const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
            u.set('page', String(p));
            return `${href('customers')}?${u.toString()}`;
          }}
          labels={{ previous: dict.common.previous, next: dict.common.next, showing: dict.common.showing, of: dict.common.of, results: dict.common.results }}
        />
      </Panel>
    </>
  );
}
