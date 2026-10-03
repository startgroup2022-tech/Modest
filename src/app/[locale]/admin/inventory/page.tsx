import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDateTime, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { SearchFilter, SelectFilter, ClearFilters, Drawer } from '@/components/admin/Filters';
import { StockAdjustForm } from '@/components/admin/StockAdjustForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Inventory', robots: { index: false, follow: false } };

type VariantRow = Prisma.ProductVariantGetPayload<{ include: { product: true } }>;

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('inventory.view', locale);
  const dict = getAdminDict(locale);
  const sp = await searchParams;
  const href = (p: string) => adminHref(locale, p);

  const q = sp.q?.trim();
  const level = sp.level ?? 'ALL';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const perPage = 25;

  const where: Prisma.ProductVariantWhereInput = { isActive: true };
  if (q) where.OR = [{ sku: { contains: q } }, { product: { nameEn: { contains: q } } }, { product: { nameAr: { contains: q } } }];
  if (level === 'LOW') where.stock = { gt: 0, lte: 5 };
  if (level === 'OUT') where.stock = { lte: 0 };

  const [rows, total, agg] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      include: { product: true },
      orderBy: [{ stock: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where: { isActive: true },
      select: { stock: true, costBhd: true, priceBhd: true, product: { select: { priceBhd: true } } },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const totalUnits = agg.reduce((s, v) => s + v.stock, 0);
  const valueBhd = agg.reduce((s, v) => s + v.stock * Number(v.costBhd ?? v.priceBhd ?? v.product.priceBhd), 0);
  const lowStock = agg.filter((v) => v.stock > 0 && v.stock <= 5).length;
  const outOfStock = agg.filter((v) => v.stock <= 0).length;

  const movements = await prisma.inventoryMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { product: { select: { nameEn: true, nameAr: true } }, variant: { select: { size: true, colorEn: true } } },
  });

  const columns: Column<VariantRow>[] = [
    {
      key: 'product',
      header: dict.common.product,
      render: (v) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink">{locale === 'ar' ? v.product.nameAr : v.product.nameEn}</span>
          <span className="block text-caption text-ink-faint">
            {[v.size, v.colorEn].filter(Boolean).join(' / ')} · {v.sku ?? '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'stock',
      header: dict.inventory.onHand,
      align: 'end',
      sortKey: 'stock',
      render: (v) => <span className="adm-num">{formatNumber(v.stock, locale)}</span>,
    },
    {
      key: 'reserved',
      header: dict.inventory.reserved,
      align: 'end',
      render: (v) => <span className="adm-num text-ink-muted">{formatNumber(v.reserved, locale)}</span>,
    },
    {
      key: 'value',
      header: dict.inventory.value,
      align: 'end',
      render: (v) => (
        <span className="adm-num text-ink-muted">
          {formatBhd(v.stock * Number(v.costBhd ?? v.priceBhd ?? v.product.priceBhd), locale)}
        </span>
      ),
    },
    {
      key: 'status',
      header: dict.common.status,
      render: (v) => (
        <StatusBadge
          status={v.stock <= 0 ? 'OUT_OF_STOCK' : v.stock <= 5 ? 'LOW_STOCK' : 'IN_STOCK'}
          label={
            v.stock <= 0
              ? dict.inventory.outOfStock ?? (locale === 'ar' ? 'غير متوفر' : 'Out of stock')
              : v.stock <= 5
                ? locale === 'ar'
                  ? 'مخزون منخفض'
                  : 'Low stock'
                : locale === 'ar'
                  ? 'متوفر'
                  : 'In stock'
          }
        />
      ),
    },
    {
      key: 'adjust',
      header: dict.common.actions,
      render: (v) => (
        <Drawer trigger={dict.inventory.adjust} title={dict.inventory.adjust}>
          <StockAdjustForm
            fixedVariantId={v.id}
            locale={locale}
            dict={{ inventory: dict.inventory, common: dict.common }}
            variants={[{ id: v.id, label: `${v.size} / ${v.colorEn ?? ''}`, stock: v.stock }]}
          />
        </Drawer>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={dict.inventory.title}
        subtitle={dict.inventory.subtitle}
        actions={
          <Drawer trigger={dict.inventory.adjust} title={dict.inventory.adjust}>
            <StockAdjustForm
              locale={locale}
              dict={{ inventory: dict.inventory, common: dict.common }}
              variants={rows.map((v) => ({
                id: v.id,
                label: `${locale === 'ar' ? v.product.nameAr : v.product.nameEn} — ${v.size}`,
                stock: v.stock,
              }))}
            />
          </Drawer>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={dict.inventory.onHand} value={formatNumber(totalUnits, locale)} />
        <Kpi label={dict.inventory.value} value={formatBhd(valueBhd, locale)} />
        <Kpi label={locale === 'ar' ? 'مخزون منخفض' : 'Low stock'} value={formatNumber(lowStock, locale)} tone={lowStock > 0 ? 'warn' : 'default'} />
        <Kpi label={locale === 'ar' ? 'غير متوفر' : 'Out of stock'} value={formatNumber(outOfStock, locale)} tone={outOfStock > 0 ? 'danger' : 'default'} />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <SearchFilter placeholder={`${dict.common.search}…`} className="w-full sm:w-64" />
          <SelectFilter
            name="level"
            label={dict.common.status}
            value={level}
            options={[
              { value: 'ALL', label: dict.common.all },
              { value: 'LOW', label: locale === 'ar' ? 'مخزون منخفض' : 'Low stock' },
              { value: 'OUT', label: locale === 'ar' ? 'غير متوفر' : 'Out of stock' },
            ]}
          />
          {(q || level !== 'ALL') && <ClearFilters label={dict.common.clear} />}
          <span className="ms-auto text-caption text-ink-faint">
            {formatNumber(total, locale)} {dict.common.results}
          </span>
        </div>
        <AdminTable
          rows={rows}
          columns={columns}
          sort={sp.sort}
          pathname={href('inventory')}
          query={sp}
          empty={<AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />}
        />
      </Panel>

      <div className="mt-6">
        <Panel title={dict.inventory.movements} bodyClassName="p-0">
          {movements.length === 0 ? (
            <AdminEmpty title={dict.common.empty} />
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table adm-table-responsive">
                <thead>
                  <tr>
                    <th>{dict.common.date}</th>
                    <th>{dict.common.product}</th>
                    <th>{dict.common.method}</th>
                    <th className="text-end">{dict.inventory.delta}</th>
                    <th className="text-end">{dict.inventory.onHand}</th>
                    <th>{dict.inventory.reason}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDateTime(m.createdAt, locale)}</td>
                      <td data-label={dict.common.product} className="text-ink">
                        {locale === 'ar' ? m.product.nameAr : m.product.nameEn}
                      </td>
                      <td data-label={dict.common.method} className="text-caption text-ink-muted">{m.type.replace(/_/g, ' ')}</td>
                      <td data-label={dict.inventory.delta} className={`adm-num text-end ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                        {m.quantity > 0 ? '+' : ''}
                        {m.quantity}
                      </td>
                      <td data-label={dict.inventory.onHand} className="adm-num text-end">{m.stockAfter}</td>
                      <td data-label={dict.inventory.reason} className="text-caption text-ink-muted">{m.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
