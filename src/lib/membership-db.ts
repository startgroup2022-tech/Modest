import 'server-only';
import { prisma } from './prisma';
import {
  computeMembershipProgress,
  resolveMembershipTier,
  type MembershipProgress,
  type MembershipTierLike,
  type QualifyingPiece,
} from './membership';

/**
 * Membership is *derived*, never stored as truth. This module reads the
 * customer's orders and recomputes qualifying pieces from the settled financial
 * state, so a refund immediately reduces qualification and a new paid order
 * immediately raises it. `Customer.membershipTierId` is only a cache pointer.
 *
 * Qualification rules (see ATTENTION_PHASE4_CHECKOUT_CUSTOMER_REPORT.md):
 *  - Only pieces from an order with a captured (PAID/partially/fully refunded)
 *    payment qualify. Awaiting-payment, failed and cancelled orders never do.
 *  - A fully refunded order contributes zero qualifying pieces.
 *  - Partial refunds are order-level today, so a partially refunded order keeps
 *    its pieces qualifying until the owner defines piece-level refunds. This is
 *    a documented owner decision, not a hidden policy.
 */

interface MembershipSetting {
  /** Product ids excluded from qualification (e.g. accessories, gift cards). */
  excludedProductIds?: string[];
}

const EPSILON = 0.0001;

const PAID_PAYMENT_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']);

async function readMembershipSetting(): Promise<MembershipSetting> {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'membership' } });
  return (row?.value as MembershipSetting) ?? {};
}

function toTierLike(t: {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  minQualifying: number;
  isActive: boolean;
  sortOrder: number;
}): MembershipTierLike {
  return {
    id: t.id,
    code: t.code,
    nameEn: t.nameEn,
    nameAr: t.nameAr,
    minQualifying: t.minQualifying,
    isActive: t.isActive,
    sortOrder: t.sortOrder,
  };
}

/**
 * Builds the qualifying-piece list for a customer from real order data. Each
 * order item is one piece row (cut products are itemised per piece at checkout;
 * simple lines carry their grouped quantity).
 */
export async function collectQualifyingPieces(customerId: string): Promise<QualifyingPiece[]> {
  const setting = await readMembershipSetting();
  const excluded = new Set(setting.excludedProductIds ?? []);

  const orders = await prisma.order.findMany({
    where: { customerId },
    select: {
      id: true,
      status: true,
      totalBhd: true,
      items: { select: { productId: true, quantity: true, lineTotalBhd: true } },
      payments: { select: { status: true } },
      refunds: { select: { amountBhd: true, status: true } },
    },
  });

  const pieces: QualifyingPiece[] = [];
  for (const order of orders) {
    const paid = order.payments.some((p) => PAID_PAYMENT_STATUSES.has(p.status));
    const orderCancelled = order.status === 'CANCELLED';
    const orderRefunded = order.status === 'REFUNDED';
    const refundedBhd = order.refunds
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + Number(r.amountBhd), 0);
    const fullyRefunded = refundedBhd > 0 && refundedBhd >= Number(order.totalBhd) - EPSILON;

    for (const item of order.items) {
      if (item.productId && excluded.has(item.productId)) continue;
      pieces.push({
        quantity: item.quantity,
        paid,
        orderCancelled,
        orderRefunded: orderRefunded || fullyRefunded,
        // Partial refunds are not attributed to individual pieces yet; see the
        // module note. A full refund is reflected through orderRefunded.
        refundedBhd: fullyRefunded ? Number(item.lineTotalBhd) : 0,
        lineTotalBhd: Number(item.lineTotalBhd),
      });
    }
  }
  return pieces;
}

export interface CustomerMembership extends MembershipProgress {
  tiers: MembershipTierLike[];
}

/** The authoritative, freshly computed membership for a customer. */
export async function getCustomerMembership(customerId: string): Promise<CustomerMembership> {
  const [tiers, pieces] = await Promise.all([
    prisma.membershipTier.findMany({ where: { isActive: true }, orderBy: { minQualifying: 'asc' } }),
    collectQualifyingPieces(customerId),
  ]);
  const tierLikes = tiers.map(toTierLike);
  let qualifyingCount = 0;
  for (const p of pieces) {
    const q = Math.max(0, p.quantity);
    if (!p.paid || p.orderCancelled || p.orderRefunded || q === 0) continue;
    qualifyingCount += q;
  }
  const progress = computeMembershipProgress(qualifyingCount, tierLikes);
  return { ...progress, tiers: tierLikes };
}

/**
 * Recomputes and caches the customer's tier pointer. Call after a payment is
 * confirmed or a refund is recorded so lists can render without recomputing.
 * Returns the recomputed membership.
 */
export async function recomputeCustomerMembership(customerId: string): Promise<CustomerMembership> {
  const membership = await getCustomerMembership(customerId);
  const tierId = membership.tier?.id ?? null;
  await prisma.customer.update({ where: { id: customerId }, data: { membershipTierId: tierId } });
  return membership;
}

/** The qualifying count for a customer, used by membership-targeted coupons. */
export async function getQualifyingCount(customerId: string): Promise<number> {
  const pieces = await collectQualifyingPieces(customerId);
  let total = 0;
  for (const p of pieces) {
    if (!p.paid || p.orderCancelled || p.orderRefunded) continue;
    total += Math.max(0, p.quantity);
  }
  return total;
}

/** Resolves the tier for an already-computed count (pure wrapper). */
export function tierForCount(count: number, tiers: MembershipTierLike[]): MembershipTierLike | null {
  return resolveMembershipTier(count, tiers);
}
