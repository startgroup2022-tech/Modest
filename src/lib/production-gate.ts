import 'server-only';
import { prisma } from './prisma';
import type { PaymentStatus, Prisma } from '@prisma/client';

/**
 * Payment-before-production gate.
 *
 * A hard business invariant: an order must not enter production until money has
 * actually been captured. This is enforced at the domain layer so every entry
 * point — order status transitions, tailor assignment and production-task
 * creation — shares one rule and a direct API call cannot bypass the UI.
 *
 * "Settled" means a payment that reached PAID (a later refund does not un-capture
 * the payment; refund handling is separate and does not reopen production).
 */

const SETTLED: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']);

type Client = Prisma.TransactionClient | typeof prisma;

export async function isOrderSettled(orderId: string, client: Client = prisma): Promise<boolean> {
  const payment = await client.payment.findFirst({
    where: { orderId, status: { in: [...SETTLED] } },
    select: { id: true },
  });
  return Boolean(payment);
}

export class ProductionGateError extends Error {
  constructor(message = 'Payment must be confirmed before production can begin') {
    super(message);
    this.name = 'ProductionGateError';
  }
}

/** Throws unless the order has a captured payment. */
export async function assertOrderSettledForProduction(orderId: string, client: Client = prisma): Promise<void> {
  if (!(await isOrderSettled(orderId, client))) {
    throw new ProductionGateError();
  }
}
