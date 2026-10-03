import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { label } from '@/lib/admin-format';
import { PageHeader } from '@/components/admin/ui';
import { QuickOrderForm } from '@/components/admin/QuickOrderForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quick Order', robots: { index: false, follow: false } };

export default async function QuickOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('orders.create', locale);
  const dict = getAdminDict(locale);

  const [products, customers, shipping] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { nameEn: 'asc' },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        sku: true,
        priceBhd: true,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, size: true, colorEn: true, stock: true, stockStatus: true },
        },
      },
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader title={dict.quickOrders.title} subtitle={dict.quickOrders.subtitle} />
      <QuickOrderForm
        locale={locale}
        dict={{ quickOrders: dict.quickOrders, common: dict.common, orders: dict.orders }}
        currency="BHD"
        products={products.map((p) => ({
          id: p.id,
          name: locale === 'ar' ? p.nameAr : p.nameEn,
          sku: p.sku,
          priceBhd: Number(p.priceBhd),
          variants: p.variants.map((v) => ({
            id: v.id,
            label: [v.size, v.colorEn].filter(Boolean).join(' / ') || '—',
            stock: v.stock,
            stockStatus: v.stockStatus,
          })),
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: [c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || c.user?.email || 'Customer',
          email: c.user?.email ?? '',
          phone: c.phone ?? '',
        }))}
        shippingOptions={shipping.map((s) => ({
          code: s.code,
          label: locale === 'ar' ? s.nameAr : s.nameEn,
          priceBhd: Number(s.priceBhd),
        }))}
        methods={[
          { value: 'COD', label: label('COD', locale) },
          { value: 'BANK_TRANSFER', label: label('BANK_TRANSFER', locale) },
          { value: 'BENEFIT', label: label('BENEFIT', locale) },
          { value: 'TAPP', label: label('TAPP', locale) },
        ]}
      />
    </>
  );
}
