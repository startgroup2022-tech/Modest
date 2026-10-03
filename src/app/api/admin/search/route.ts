import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

/**
 * Global admin search for the command palette. Results are scoped to the
 * sections the caller may actually open, so a search never leaks a record the
 * user has no permission to view.
 */
export const GET = adminHandler(undefined, async ({ admin, searchParams, req }) => {
  const q = (searchParams.get('q') ?? '').trim();
  const url = new URL(req.url);
  const localeParam = url.pathname.split('/')[1];
  const locale: Locale = isLocale(localeParam) ? localeParam : 'en';
  const empty = { orders: [], customers: [], products: [] };
  if (q.length < 2) return NextResponse.json(empty);

  const canOrders = admin.permissions.has('orders.view');
  const canCustomers = admin.permissions.has('customers.view');
  const canProducts = admin.permissions.has('products.view');

  const [orders, customers, products] = await Promise.all([
    canOrders
      ? prisma.order.findMany({
          where: {
            OR: [
              { orderNumber: { contains: q } },
              { email: { contains: q } },
              { shippingName: { contains: q } },
              { phone: { contains: q } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, orderNumber: true, shippingName: true, totalBhd: true, status: true },
        })
      : [],
    canCustomers
      ? prisma.customer.findMany({
          where: {
            OR: [
              { user: { email: { contains: q } } },
              { user: { firstName: { contains: q } } },
              { user: { lastName: { contains: q } } },
              { phone: { contains: q } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, phone: true, user: { select: { firstName: true, lastName: true, email: true } } },
        })
      : [],
    canProducts
      ? prisma.product.findMany({
          where: { OR: [{ nameEn: { contains: q } }, { nameAr: { contains: q } }, { sku: { contains: q } }] },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, slug: true, nameEn: true, nameAr: true, sku: true },
        })
      : [],
  ]);

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      label: o.orderNumber,
      sub: o.shippingName,
      href: adminHref(locale, `orders/${o.id}`),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      label: [c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || c.user?.email || c.phone || 'Customer',
      sub: c.user?.email ?? '',
      href: adminHref(locale, `customers/${c.id}`),
    })),
    products: products.map((p) => ({
      id: p.id,
      label: locale === 'ar' ? p.nameAr : p.nameEn,
      sub: p.sku ?? '',
      href: adminHref(locale, `products/${p.id}`),
    })),
  });
});
