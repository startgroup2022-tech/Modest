import 'server-only';
import { prisma } from './prisma';
import { statusMessage } from './order-status';
import type { OrderStatus, Prisma } from '@prisma/client';

/**
 * Customer notifications. The `Notification` model existed since Phase 1 but
 * nothing ever wrote to it. These helpers are the single emission point for
 * order lifecycle events so a customer actually sees payment/shipping updates
 * in their account.
 */

export interface NotificationInput {
  customerId: string;
  titleEn: string;
  titleAr: string;
  bodyEn?: string | null;
  bodyAr?: string | null;
  href?: string | null;
}

export async function createNotification(
  input: NotificationInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.notification.create({
    data: {
      customerId: input.customerId,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      bodyEn: input.bodyEn ?? null,
      bodyAr: input.bodyAr ?? null,
      href: input.href ?? null,
    },
  });
}

/**
 * Emits the customer-facing notification for an order status change. Called on
 * every transition so the account notification list mirrors the real timeline.
 * A missing customer (guest order) is a no-op.
 */
export async function notifyOrderStatus(
  tx: Prisma.TransactionClient,
  params: {
    customerId: string | null;
    orderNumber: string;
    status: OrderStatus;
    locale?: 'en' | 'ar';
  },
): Promise<void> {
  if (!params.customerId) return;
  const msg = statusMessage(params.status);
  await createNotification(
    {
      customerId: params.customerId,
      titleEn: msg.en,
      titleAr: msg.ar,
      bodyEn: `Order ${params.orderNumber}`,
      bodyAr: `الطلب ${params.orderNumber}`,
      // Locale-less path; the notifications page prefixes the active locale so
      // an Arabic customer is not sent to the English route.
      href: `/account/orders/${params.orderNumber}`,
    },
    tx,
  );
}
