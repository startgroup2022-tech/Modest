import 'server-only';
import { prisma } from '../prisma';
import { AdminActionError, type AdminUser } from '../admin-auth';
import { canTransition, nextStatuses, statusMessage } from '../order-status';
import { releaseOrderStock } from '../orders';
import { notifyOrderStatus, createNotification } from '../notifications';
import { recomputeCustomerMembership } from '../membership-db';
import { getPaymentProvider } from '../payments';
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

/** Records a status change on the order timeline. */
async function recordEvent(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
  messageEn?: string,
  messageAr?: string,
) {
  await tx.orderEvent.create({
    data: {
      orderId,
      status,
      messageEn: messageEn ?? statusMessage(status).en,
      messageAr: messageAr ?? statusMessage(status).ar,
    },
  });
}

const TIMESTAMP_FIELD: Partial<Record<OrderStatus, keyof Prisma.OrderUpdateInput>> = {
  SHIPPED: 'shippedAt',
  DELIVERED: 'deliveredAt',
  CANCELLED: 'cancelledAt',
};

export interface TransitionInput {
  orderId: string;
  to: OrderStatus;
  note?: string;
  trackingNumber?: string;
  carrier?: string;
  cancelReason?: string;
  ip?: string | null;
}

/**
 * Applies an order status transition inside a transaction. Validates the move
 * against the state machine, stamps the relevant timestamps, appends a timeline
 * event and — for cancellations — releases reserved stock.
 */
export async function transitionOrder(admin: AdminUser, input: TransitionInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true, payments: true },
    });
    if (!order) throw new AdminActionError('Order not found', 'NOT_FOUND', 404);
    if (order.status === input.to) throw new AdminActionError('Order is already in that status', 'NOOP');
    if (!canTransition(order.status, input.to)) {
      throw new AdminActionError(
        `Cannot move from ${order.status} to ${input.to}`,
        'INVALID_TRANSITION',
        409,
      );
    }

    const data: Prisma.OrderUpdateInput = { status: input.to };
    const stampField = TIMESTAMP_FIELD[input.to];
    if (stampField) (data as Record<string, unknown>)[stampField] = new Date();
    if (input.to === 'SHIPPED') {
      if (input.trackingNumber) data.trackingNumber = input.trackingNumber;
      if (input.carrier) data.carrier = input.carrier;
    }
    if (input.to === 'CANCELLED' && input.cancelReason) data.cancelReason = input.cancelReason;

    // Production may only begin once money has actually been captured. This is
    // enforced here (not just in the UI) so a direct API call cannot start
    // manufacturing an unpaid order. Owners who deliberately start work before
    // payment must confirm the payment first.
    if (input.to === 'IN_PRODUCTION') {
      const settled = order.payments.some(
        (p) => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED' || p.status === 'REFUNDED',
      );
      if (!settled) {
        throw new AdminActionError(
          'Payment must be confirmed before production can begin',
          'PAYMENT_REQUIRED',
          409,
        );
      }
    }

    const updated = await tx.order.update({ where: { id: order.id }, data });

    await recordEvent(tx, order.id, input.to, input.note);
    await notifyOrderStatus(tx, { customerId: order.customerId, orderNumber: order.orderNumber, status: input.to });

    // Releasing stock on cancellation keeps inventory truthful.
    if (input.to === 'CANCELLED') {
      await releaseOrderStock(order.id, admin.id, tx);
    }

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: `order.transition.${input.to.toLowerCase()}`,
        entity: 'Order',
        entityId: order.id,
        metadata: { from: order.status, to: input.to, note: input.note ?? null } as never,
        ip: input.ip ?? null,
      },
    });

    return updated;
  });
}

export interface PaymentUpdateInput {
  paymentId: string;
  status: PaymentStatus;
  reference?: string;
  note?: string;
  ip?: string | null;
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  INITIATED: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  FAILED: ['PENDING'],
  CANCELLED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
};

/**
 * Updates a payment's status with an explicit transition check. Confirming a
 * payment is the single most sensitive action in the system, so it is audited
 * with the staff member's identity and the provider reference.
 */
export async function updatePayment(admin: AdminUser, input: PaymentUpdateInput) {
  const { updated, paidOrder } = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { order: true } });
    if (!payment) throw new AdminActionError('Payment not found', 'NOT_FOUND', 404);
    if (payment.status === input.status) throw new AdminActionError('No change', 'NOOP');
    if (!PAYMENT_TRANSITIONS[payment.status]?.includes(input.status)) {
      throw new AdminActionError(
        `Cannot move payment from ${payment.status} to ${input.status}`,
        'INVALID_TRANSITION',
        409,
      );
    }

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: input.status,
        providerRef: input.reference ?? payment.providerRef,
        paidAt: input.status === 'PAID' ? new Date() : payment.paidAt,
        verifiedById: input.status === 'PAID' ? admin.id : payment.verifiedById,
        verifiedAt: input.status === 'PAID' ? new Date() : payment.verifiedAt,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: `payment.${input.status.toLowerCase()}`,
        entity: 'Payment',
        entityId: payment.id,
        metadata: {
          orderNumber: payment.order.orderNumber,
          from: payment.status,
          to: input.status,
          reference: input.reference ?? null,
          note: input.note ?? null,
        } as never,
        ip: input.ip ?? null,
      },
    });

    // Confirming the first payment confirms the order so fulfilment can begin.
    if (input.status === 'PAID' && payment.order.status === 'PENDING') {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } });
      await recordEvent(tx, payment.orderId, 'CONFIRMED', 'Payment confirmed');
    }

    return {
      updated,
      paidOrder:
        input.status === 'PAID'
          ? {
              customerId: payment.order.customerId,
              orderNumber: payment.order.orderNumber,
              status: payment.order.status === 'PENDING' ? ('CONFIRMED' as const) : payment.order.status,
            }
          : null,
    };
  });

  // A payment reaching PAID is what makes a piece "qualifying". The membership
  // recompute reads the settled financial state through the global client, so it
  // must run *after* the transaction commits — otherwise it would read the
  // pre-commit payment and under-count. Both steps are idempotent.
  if (paidOrder) {
    await notifyOrderStatus(prisma, paidOrder);
    if (paidOrder.customerId) {
      await recomputeCustomerMembership(paidOrder.customerId);
    }
  }

  return updated;
}

export interface RefundInput {
  orderId: string;
  amountBhd: number;
  method: string;
  reference?: string;
  reason?: string;
  ip?: string | null;
}

export async function createRefund(admin: AdminUser, input: RefundInput) {
  if (!(input.amountBhd > 0)) throw new AdminActionError('Refund amount must be greater than zero', 'INVALID');
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { refunds: true, payments: true },
    });
    if (!order) throw new AdminActionError('Order not found', 'NOT_FOUND', 404);

    // Money can only be refunded after it was actually received. This blocks the
    // class of bug where staff "refund" an unpaid order and the ledger implies a
    // payment that never happened.
    const settled = order.payments.some((p) => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED' || p.status === 'REFUNDED');
    if (!settled) {
      throw new AdminActionError('This order has no captured payment to refund', 'NOT_PAID', 409);
    }

    const alreadyRefunded = order.refunds
      .filter((r) => r.status === 'COMPLETED')
      .reduce((s, r) => s + Number(r.amountBhd), 0);
    if (alreadyRefunded + input.amountBhd > Number(order.totalBhd) + 0.0001) {
      throw new AdminActionError('Refund exceeds the order total', 'REFUND_EXCEEDS_TOTAL', 409);
    }

    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        amountBhd: input.amountBhd,
        method: input.method,
        reference: input.reference ?? null,
        reason: input.reason ?? null,
        status: 'COMPLETED',
        createdById: admin.id,
      },
    });

    const totalRefunded = alreadyRefunded + input.amountBhd;
    const fullyRefunded = totalRefunded >= Number(order.totalBhd) - 0.0001;

    if (fullyRefunded) {
      // The payment may already be PARTIALLY_REFUNDED from an earlier partial
      // refund, so match both states — otherwise a completing refund would
      // leave the payment stuck at PARTIALLY_REFUNDED.
      await tx.payment.updateMany({
        where: { orderId: order.id, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
        data: { status: 'REFUNDED' },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
      await recordEvent(tx, order.id, 'REFUNDED', input.reason);

      // Revert every active coupon redemption for this order so per-customer
      // limits relax and the code's remaining usage is restored — traceably,
      // by stamping `revertedAt` rather than deleting the row.
      const reverted = await tx.couponRedemption.updateMany({
        where: { orderId: order.id, revertedAt: null },
        data: { revertedAt: new Date() },
      });
      if (reverted.count > 0) {
        const redemptions = await tx.couponRedemption.findMany({ where: { orderId: order.id }, select: { couponId: true } });
        const couponIds = [...new Set(redemptions.map((r) => r.couponId))];
        await tx.coupon.updateMany({
          where: { id: { in: couponIds }, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    } else {
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PAID' },
        data: { status: 'PARTIALLY_REFUNDED' },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: 'refund.create',
        entity: 'Refund',
        entityId: refund.id,
        metadata: { orderNumber: order.orderNumber, amountBhd: input.amountBhd, method: input.method, fullyRefunded } as never,
        ip: input.ip ?? null,
      },
    });

    return { refund, fullyRefunded };
  }).then(async (result) => {
    // Membership and notifications live outside the transaction: a refund must
    // never fail because a notification write failed, and the recompute is
    // idempotent so a retry is safe.
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { customerId: true, orderNumber: true },
    });
    if (order?.customerId) {
      await recomputeCustomerMembership(order.customerId);
      if (result.fullyRefunded) {
        await createNotification({
          customerId: order.customerId,
          titleEn: 'Order refunded',
          titleAr: 'تم استرداد المبلغ',
          bodyEn: `Order ${order.orderNumber}`,
          bodyAr: `الطلب ${order.orderNumber}`,
          href: `/account/orders/${order.orderNumber}`,
        });
      }
    }
    return result.refund;
  });
}

/** Legal next statuses for the UI. */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return nextStatuses(from);
}

/**
 * Mints a fresh provider session and records it on the payment so a staff
 * member can resend a payment link. A settled payment is never re-linked, and
 * the link issuance is audited with the acting staff member.
 */
export async function resendPaymentLink(admin: AdminUser, paymentId: string, baseUrl: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
          totalBhd: true,
          presentmentCode: true,
          presentmentTotal: true,
          presentmentRate: true,
          shippingName: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!payment) throw new AdminActionError('Payment not found', 'NOT_FOUND', 404);
  if (payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED') {
    throw new AdminActionError('This payment is already settled', 'ALREADY_PAID', 409);
  }

  const provider = getPaymentProvider(payment.method);
  const init = await provider.init({
    orderId: payment.order.id,
    orderNumber: payment.order.orderNumber,
    amountBhd: Number(payment.amountBhd),
    currencyCode: payment.order.presentmentCode,
    amountPresentment: Number(payment.order.presentmentTotal ?? payment.amountBhd),
    customer: {
      name: payment.order.shippingName,
      email: payment.order.email,
      phone: payment.order.phone,
    },
    returnUrl: `${baseUrl}/en/checkout/success`,
    cancelUrl: `${baseUrl}/en/checkout`,
  });

  if (init.status === 'FAILED' || !init.redirectUrl) {
    throw new AdminActionError('The payment provider could not create a link', 'PROVIDER_FAILED', 502);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentUrl: init.redirectUrl,
      providerRef: init.providerRef ?? payment.providerRef,
      linkSentAt: new Date(),
      linkSentById: admin.id,
      status: payment.status === 'INITIATED' ? 'PENDING' : payment.status,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'payment.link_sent',
      entity: 'Payment',
      entityId: payment.id,
      metadata: { orderNumber: payment.order.orderNumber, method: payment.method } as never,
    },
  });

  return { url: updated.paymentUrl!, sentAt: updated.linkSentAt! };
}
