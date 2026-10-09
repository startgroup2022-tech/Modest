import type { Permission } from '@/lib/permission-defs';

export interface NavItem {
  /** Path relative to the admin root, e.g. '' for the dashboard. */
  path: string;
  key: string;
  permission?: Permission;
  badge?: 'orders' | 'payments' | 'production' | 'qc' | 'expenses' | 'refunds' | 'notifications';
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

/**
 * Grouped admin navigation. Items are filtered by permission before render, but
 * the server re-checks every route and API — the filter is cosmetic only.
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    key: 'overview',
    items: [{ path: '', key: 'dashboard', permission: 'dashboard.view' }],
  },
  {
    key: 'commerce',
    items: [
      { path: 'orders', key: 'orders', permission: 'orders.view', badge: 'orders' },
      { path: 'orders/quick', key: 'quickOrders', permission: 'orders.create' },
      { path: 'products', key: 'products', permission: 'products.view' },
      { path: 'categories', key: 'categories', permission: 'products.view' },
      { path: 'collections', key: 'collections', permission: 'products.view' },
      { path: 'inventory', key: 'inventory', permission: 'inventory.view' },
      { path: 'promotions', key: 'promotions', permission: 'promotions.view' },
      { path: 'coupons', key: 'coupons', permission: 'promotions.view' },
    ],
  },
  {
    key: 'customers',
    items: [
      { path: 'customers', key: 'customers', permission: 'customers.view' },
      { path: 'customers/measurements', key: 'measurements', permission: 'measurements.view' },
    ],
  },
  {
    key: 'production',
    items: [
      { path: 'production', key: 'productionQueue', permission: 'production.view', badge: 'production' },
      { path: 'production/qc', key: 'qc', permission: 'qc.view', badge: 'qc' },
      { path: 'tailors', key: 'tailors', permission: 'tailors.view' },
    ],
  },
  {
    key: 'delivery',
    items: [
      { path: 'shipping', key: 'shipping', permission: 'shipping.view' },
      { path: 'deliveries', key: 'deliveries', permission: 'shipping.view' },
    ],
  },
  {
    key: 'finance',
    items: [
      { path: 'payments', key: 'payments', permission: 'payments.view', badge: 'payments' },
      { path: 'refunds', key: 'refunds', permission: 'orders.refund', badge: 'refunds' },
      { path: 'expenses', key: 'expenses', permission: 'expenses.view', badge: 'expenses' },
      { path: 'settlements', key: 'settlements', permission: 'settlements.view' },
    ],
  },
  {
    key: 'reports',
    items: [{ path: 'reports', key: 'reports', permission: 'reports.view' }],
  },
  {
    key: 'content',
    items: [
      { path: 'content/homepage', key: 'homepage', permission: 'content.view' },
      { path: 'content/pages', key: 'pages', permission: 'content.view' },
      { path: 'content/social', key: 'social', permission: 'content.view' },
      { path: 'seo', key: 'seo', permission: 'seo.view' },
    ],
  },
  {
    key: 'system',
    items: [
      { path: 'employees', key: 'employees', permission: 'users.manage' },
      { path: 'roles', key: 'roles', permission: 'roles.manage' },
      { path: 'notifications', key: 'notifications', permission: 'notifications.view', badge: 'notifications' },
      { path: 'settings', key: 'settings', permission: 'settings.view' },
      { path: 'audit', key: 'audit', permission: 'audit.view' },
    ],
  },
];
