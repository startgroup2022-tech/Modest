import 'server-only';
import { prisma } from '../prisma';
import { AdminActionError, type AdminUser } from '../admin-auth';
import { canTransition, nextStatuses, statusMessage } from '../order-status';
import { releaseOrderStock } from '../orders';
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

    const updated = await tx.order.update({ where: { id: order.id }, data });

    await recordEvent(tx, order.id, input.to, input.note);

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
  return prisma.$transaction(async (tx) => {
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

    return updated;
  });
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
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { refunds: true } });
    if (!order) throw new AdminActionError('Order not found', 'NOT_FOUND', 404);

    const alreadyRefunded = order.refunds.reduce((s, r) => s + Number(r.amountBhd), 0);
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
        metadata: { orderNumber: order.orderNumber, amountBhd: input.amountBhd, method: input.method } as never,
        ip: input.ip ?? null,
      },
    });

    return refund;
  });
}

/** Legal next statuses for the UI. */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return nextStatuses(from);
}
