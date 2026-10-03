import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty, AdminPagination } from '@/components/admin/ui';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { SearchFilter, SelectFilter, ClearFilters } from '@/components/admin/Filters';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Products', robots: { index: false, follow: false } };

type Row = Prisma.ProductGetPayload<{
  include: { variants: true; categories: { include: { category: true } } };
}>;

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('products.view', locale);
  const dict = getAdminDict(locale);
  const sp = await searchParams;

  const q = sp.q?.trim();
  const status = sp.status ?? 'ALL';
  const kind = sp.kind ?? 'ALL';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const perPage = 20;

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [{ nameEn: { contains: q } }, { nameAr: { contains: q } }, { sku: { contains: q } }];
  }
  if (status !== 'ALL') where.status = status as never;
  if (kind !== 'ALL') where.kind = kind as never;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { variants: true, categories: { include: { category: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const href = (p: string) => adminHref(locale, p);

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: dict.common.product,
      render: (p) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink">{locale === 'ar' ? p.nameAr : p.nameEn}</span>
          <span className="block text-caption text-ink-faint">{p.sku ?? '—'}</span>
        </span>
      ),
    },
    {
      key: 'category',
      header: dict.common.category,
      render: (p) => (
        <span className="text-ink-muted">
          {p.categories.map((c) => (locale === 'ar' ? c.category.nameAr : c.category.nameEn)).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'kind',
      header: dict.products.kind,
      render: (p) => <span className="text-ink-muted">{label(p.kind, locale)}</span>,
    },
    {
      key: 'price',
      header: dict.products.priceBhd,
      align: 'end',
      sortKey: 'priceBhd',
      render: (p) => <span className="adm-num">{formatBhd(p.priceBhd, locale)}</span>,
    },
    {
      key: 'stock',
      header: dict.inventory.onHand,
      align: 'end',
      render: (p) => <span className="adm-num">{formatNumber(p.variants.reduce((s, v) => s + v.stock, 0), locale)}</span>,
    },
    {
      key: 'status',
      header: dict.common.status,
      render: (p) => <StatusBadge status={p.status} label={label(p.status, locale)} />,
    },
    {
      key: 'flags',
      header: dict.common.actions,
      render: (p) => (
        <span className="flex gap-1.5">
          {p.isFeatured && <span className="adm-badge-accent">{dict.products.featured}</span>}
          {p.madeToOrder && <span className="adm-badge-info">{dict.products.madeToOrderTab}</span>}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={dict.products.title}
        subtitle={dict.products.subtitle}
        actions={
          <Link href={href('products/new')} className="adm-btn-primary">
            + {dict.products.newProduct}
          </Link>
        }
      />

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <SearchFilter placeholder={`${dict.common.search}…`} className="w-full sm:w-64" />
          <SelectFilter
            name="status"
            label={dict.common.status}
            value={status}
            options={[
              { value: 'ALL', label: dict.common.all },
              { value: 'ACTIVE', label: label('ACTIVE', locale) },
              { value: 'DRAFT', label: label('DRAFT', locale) },
              { value: 'ARCHIVED', label: label('ARCHIVED', locale) },
            ]}
          />
          <SelectFilter
            name="kind"
            label={dict.products.kind}
            value={kind}
            options={[
              { value: 'ALL', label: dict.common.all },
              { value: 'READY_TO_WEAR', label: label('READY_TO_WEAR', locale) },
              { value: 'MADE_TO_ORDER', label: label('MADE_TO_ORDER', locale) },
            ]}
          />
          {(q || status !== 'ALL' || kind !== 'ALL') && <ClearFilters label={dict.common.clear} />}
          <span className="ms-auto text-caption text-ink-faint">
            {formatNumber(total, locale)} {dict.common.results}
          </span>
        </div>

        <AdminTable
          rows={rows}
          columns={columns}
          hrefFor={(p) => href(`products/${p.id}`)}
          sort={sp.sort}
          pathname={href('products')}
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
            return `${href('products')}?${u.toString()}`;
          }}
          labels={{
            previous: dict.common.previous,
            next: dict.common.next,
            showing: dict.common.showing,
            of: dict.common.of,
            results: dict.common.results,
          }}
        />
      </Panel>
    </>
  );
}
