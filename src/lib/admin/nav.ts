import 'server-only';
import { cache } from 'react';
import { prisma } from '../prisma';
import type { Permission } from '../permission-defs';
import { ADMIN_NAV } from '../admin-nav';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import type { Locale } from '@/i18n/config';

export interface BadgeCounts {
  orders: number;
  payments: number;
  production: number;
  qc: number;
  expenses: number;
  refunds: number;
  notifications: number;
}

/** Live badge counts for the sidebar. Only queried for permissions the user holds. */
export const getBadgeCounts = cache(async (permissions: Set<Permission>, userId: string): Promise<BadgeCounts> => {
  const zero: BadgeCounts = { orders: 0, payments: 0, production: 0, qc: 0, expenses: 0, refunds: 0, notifications: 0 };
  const [orders, payments, production, qc, expenses, refunds, notifications] = await Promise.all([
    permissions.has('orders.view')
      ? prisma.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } })
      : 0,
    permissions.has('payments.view')
      ? prisma.payment.count({ where: { status: { in: ['PENDING', 'INITIATED'] } } })
      : 0,
    permissions.has('production.view')
      ? prisma.productionTask.count({ where: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } } })
      : 0,
    permissions.has('qc.view')
      ? prisma.qcRecord.count({ where: { status: 'PENDING' } })
      : 0,
    permissions.has('finance.approve')
      ? prisma.expense.count({ where: { status: 'SUBMITTED' } })
      : 0,
    permissions.has('orders.refund')
      ? prisma.order.count({ where: { status: 'REFUND_REQUESTED' } })
      : 0,
    permissions.has('notifications.view')
      ? prisma.staffNotification.count({ where: { OR: [{ userId }, { userId: null }], readAt: null } })
      : 0,
  ]);
  return { orders, payments, production, qc, expenses, refunds, notifications };
});

export interface AdminNavPayload {
  groups: {
    key: string;
    label: string;
    items: { path: string; key: string; label: string; href: string; badge?: number }[];
  }[];
  commandItems: { label: string; href: string; group: string }[];
}

/**
 * Builds the sidebar + command-palette payload, filtered to the user's
 * permissions. Every route and API re-checks authorization independently.
 */
export async function getAdminNav(
  locale: Locale,
  permissions: Set<Permission>,
  userId: string,
): Promise<AdminNavPayload> {
  const dict = getAdminDict(locale);
  const badges = await getBadgeCounts(permissions, userId);

  const groups: AdminNavPayload['groups'] = [];
  const commandItems: AdminNavPayload['commandItems'] = [];

  for (const group of ADMIN_NAV) {
    const items: AdminNavPayload['groups'][number]['items'] = [];
    for (const item of group.items) {
      if (item.permission && !permissions.has(item.permission)) continue;
      const label = (dict.nav as Record<string, string>)[item.key] ?? item.key;
      const href = adminHref(locale, item.path);
      const badge = item.badge ? badges[item.badge] : 0;
      items.push({ path: item.path, key: item.key, label, href, badge: badge || undefined });
      commandItems.push({ label, href, group: (dict.groups as Record<string, string>)[group.key] ?? group.key });
    }
    if (items.length) {
      groups.push({
        key: group.key,
        label: (dict.groups as Record<string, string>)[group.key] ?? group.key,
        items,
      });
    }
  }

  return { groups, commandItems };
}
