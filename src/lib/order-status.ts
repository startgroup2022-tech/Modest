import 'server-only';
import type { OrderStatus } from '@prisma/client';

/**
 * Order state machine. Transitions are validated server-side — the UI only ever
 * offers legal moves, but a tampered request is rejected here regardless.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED', 'REFUND_REQUESTED'],
  PREPARING: ['IN_PRODUCTION', 'READY', 'CANCELLED', 'REFUND_REQUESTED'],
  IN_PRODUCTION: ['QUALITY_CHECK', 'READY', 'CANCELLED', 'REFUND_REQUESTED'],
  QUALITY_CHECK: ['READY', 'IN_PRODUCTION', 'REFUND_REQUESTED'],
  READY: ['SHIPPED', 'CANCELLED', 'REFUND_REQUESTED'],
  SHIPPED: ['DELIVERED', 'REFUND_REQUESTED'],
  DELIVERED: ['REFUND_REQUESTED'],
  REFUND_REQUESTED: ['REFUNDED', 'CONFIRMED', 'PREPARING', 'READY'],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** The natural "advance" step, or null when the order is in a terminal state. */
export function advanceTarget(from: OrderStatus): OrderStatus | null {
  const sequence: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'];
  const i = sequence.indexOf(from);
  if (i === -1) return null;
  return sequence[i + 1] ?? null;
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'CANCELLED' || status === 'REFUNDED';
}

export function isFulfilled(status: OrderStatus): boolean {
  return status === 'DELIVERED';
}

/** Ordered list used by the customer-facing and admin timelines. */
export const ORDER_TIMELINE: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'READY',
  'SHIPPED',
  'DELIVERED',
];

export function timelineIndex(status: OrderStatus): number {
  const i = ORDER_TIMELINE.indexOf(status);
  if (i !== -1) return i;
  if (status === 'REFUND_REQUESTED') return ORDER_TIMELINE.indexOf('DELIVERED');
  return -1;
}

const MESSAGES: Record<string, { en: string; ar: string }> = {
  PENDING: { en: 'Order placed', ar: 'تم إنشاء الطلب' },
  CONFIRMED: { en: 'Order confirmed', ar: 'تم تأكيد الطلب' },
  PREPARING: { en: 'Preparing your order', ar: 'جارٍ تحضير طلبك' },
  IN_PRODUCTION: { en: 'In production at the atelier', ar: 'قيد الإنتاج في الأتيليه' },
  QUALITY_CHECK: { en: 'Undergoing quality check', ar: 'قيد فحص الجودة' },
  READY: { en: 'Ready', ar: 'جاهز' },
  SHIPPED: { en: 'Shipped', ar: 'تم الشحن' },
  DELIVERED: { en: 'Delivered', ar: 'تم التوصيل' },
  CANCELLED: { en: 'Order cancelled', ar: 'تم إلغاء الطلب' },
  REFUND_REQUESTED: { en: 'Refund requested', ar: 'تم طلب الاسترداد' },
  REFUNDED: { en: 'Order refunded', ar: 'تم استرداد المبلغ' },
};

export function statusMessage(status: OrderStatus): { en: string; ar: string } {
  return MESSAGES[status] ?? { en: status, ar: status };
}

/**
 * Stable dictionary keys for the customer-facing order status label. Kept here
 * (rather than duplicated in each page) so a new status can never render as a
 * raw enum in one place and a translated label in another.
 */
export const ORDER_STATUS_KEY: Record<OrderStatus, string> = {
  PENDING: 'placed',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  IN_PRODUCTION: 'inProduction',
  QUALITY_CHECK: 'qualityCheck',
  READY: 'ready',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUND_REQUESTED: 'refundRequested',
  REFUNDED: 'refunded',
};

export function customerStatusKey(status: OrderStatus): string {
  return ORDER_STATUS_KEY[status] ?? 'placed';
}

/** Stable dictionary keys for the customer-facing payment status label. */
export const PAYMENT_STATUS_KEY: Record<string, string> = {
  INITIATED: 'paymentInitiated',
  PENDING: 'paymentPending',
  PAID: 'paymentPaid',
  FAILED: 'paymentFailed',
  CANCELLED: 'paymentCancelled',
  REFUNDED: 'paymentRefunded',
  PARTIALLY_REFUNDED: 'paymentPartiallyRefunded',
};

export function customerPaymentStatusKey(status: string): string {
  return PAYMENT_STATUS_KEY[status] ?? 'paymentPending';
}
