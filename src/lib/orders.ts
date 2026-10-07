import 'server-only';
import { prisma } from './prisma';
import { computeTotals, type CouponLike } from './money';
import { roundBhd } from './utils';
import { nextSequence, monthlyScope } from './sequences';
import { getPaymentProvider, type PaymentInitResult } from './payments';
import { notifyOrderStatus } from './notifications';
import { recomputeCustomerMembership } from './membership-db';
import { peekCartId } from './cart';
import { isMeasurementSnapshot } from './order-measurements';
import { STOREFRONT_PRODUCT_STATUSES } from './catalog';
import type { CheckoutInput } from './validation';
import type { OrderStatus, Prisma, PaymentStatus } from '@prisma/client';

export interface ResolvedLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPriceBhd: number;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  stockStatus: string;
  cutId: string | null;
  /** One entry per physical piece; empty for lines without measurements. */
  pieces: { measurementKind: 'READY' | 'CUSTOM' | null; sizeCode: string | null; sizeSnapshot: unknown; measurementSnapshot: unknown }[];
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code:
      | 'EMPTY_CART'
      | 'UNAVAILABLE'
      | 'INVALID_COUPON'
      | 'DUPLICATE'
      | 'PAYMENT_FAILED'
      | 'UNKNOWN' = 'UNKNOWN',
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

interface RawLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/**
 * Resolves client cart lines against the database. Prices are always taken
 * from the server — the client can never dictate a price. Unavailable or
 * archived products are rejected rather than silently dropped.
 */
export async function resolveCartLines(
  lines: RawLine[],
  options: { requireMeasurements?: boolean } = {},
): Promise<ResolvedLine[]> {
  const requireMeasurements = options.requireMeasurements ?? true;
  if (!lines.length) return [];
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      variants: true,
      cut: { select: { id: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolved: ResolvedLine[] = [];

  // Cart-line measurement configs, keyed by product+variant+quantity so the
  // client cannot inject a snapshot: the pieces are read back from the cart and
  // validated against each product's stored cut.
  const cartId = requireMeasurements ? await peekCartId() : null;
  const cartItems = cartId
    ? await prisma.cartItem.findMany({
        where: { cartId },
        include: { pieces: { orderBy: { pieceIndex: 'asc' } } },
      })
    : [];

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product || !STOREFRONT_PRODUCT_STATUSES.includes(product.status)) {
      throw new CheckoutError(`Product ${line.productId} is unavailable`, 'UNAVAILABLE');
    }
    let unitPrice = Number(product.priceBhd);
    let variantLabel: string | null = null;
    let sku = product.sku;
    let stockStatus = 'IN_STOCK';

    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId && v.isActive);
      if (!variant) throw new CheckoutError('Selected variant is unavailable', 'UNAVAILABLE');
      if (variant.priceBhd != null) unitPrice = Number(variant.priceBhd);
      variantLabel = [variant.size, variant.colorEn].filter(Boolean).join(' / ');
      sku = variant.sku ?? sku;
      stockStatus = variant.stockStatus;
      if (variant.stockStatus === 'OUT_OF_STOCK') {
        throw new CheckoutError('Selected variant is out of stock', 'UNAVAILABLE');
      }
      if (variant.stock < line.quantity && variant.stockStatus !== 'PRE_ORDER') {
        throw new CheckoutError('Not enough stock for the requested quantity', 'UNAVAILABLE');
      }
    } else if (product.variants.length > 0) {
      throw new CheckoutError('Please select a size', 'UNAVAILABLE');
    }

    if (line.quantity < 1 || line.quantity > 20) {
      throw new CheckoutError('Invalid quantity', 'UNAVAILABLE');
    }

    // Cut products must carry one complete measurement config per piece. The
    // snapshots are frozen from the cart's own copies (written server-side at
    // add-to-cart), so a tampered client payload cannot influence them.
    const pieces: ResolvedLine['pieces'] = [];
    if (product.cut?.id) {
      if (!requireMeasurements) {
        const sizeCode = line.variantId
          ? (product.variants.find((v) => v.id === line.variantId && v.isActive)?.size ?? null)
          : null;
        pieces.push({ measurementKind: null, sizeCode, sizeSnapshot: null, measurementSnapshot: null });
      } else {
        const cartItem =
          cartItems.find((c) => c.productId === line.productId && (c.variantId ?? null) === (line.variantId ?? null)) ??
          cartItems.find((c) => c.productId === line.productId);
        const source = cartItem?.pieces ?? [];
        if (source.length !== line.quantity) {
          throw new CheckoutError('Please choose your measurements', 'UNAVAILABLE');
        }
        for (const p of source) {
          const snapshot = (p.measurementSnapshot ?? p.sizeSnapshot) as unknown;
          if (!isMeasurementSnapshot(snapshot)) {
            throw new CheckoutError('A piece is missing its measurements', 'UNAVAILABLE');
          }
          pieces.push({
            measurementKind: p.measurementKind,
            sizeCode: p.sizeCode,
            sizeSnapshot: p.sizeSnapshot,
            measurementSnapshot: p.measurementSnapshot,
          });
        }
      }
    }

    resolved.push({
      productId: product.id,
      variantId: line.variantId ?? null,
      quantity: line.quantity,
      unitPriceBhd: roundBhd(unitPrice),
      productName: product.nameEn,
      variantLabel,
      sku,
      imageUrl: product.media[0]?.url ?? null,
      stockStatus,
      cutId: product.cut?.id ?? null,
      pieces,
    });
  }
  return resolved;
}

export interface CreateOrderInput {
  checkout: CheckoutInput;
  lines: ResolvedLine[];
  customerId: string | null;
  locale: 'en' | 'ar';
  currency: { code: string; rateToBhd: number; decimals: number };
  shippingBhd: number;
  coupon: CouponLike | null;
  idempotencyKey?: string | null;
  baseUrl: string;
  /** Guest identity anchor for coupon per-customer limits (hashed email). */
  guestEmailHash?: string | null;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  totalBhd: number;
  paymentStatus: PaymentStatus;
  redirectUrl?: string;
  instructions?: { en: string; ar: string };
}

/**
 * Creates an order inside a single transaction. Stock is decremented
 * atomically with a guarded update so concurrent checkouts cannot oversell.
 * An idempotency key prevents duplicate order creation from double submits.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { checkout, lines, coupon } = input;
  if (!lines.length) throw new CheckoutError('Cart is empty', 'EMPTY_CART');

  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { payments: true },
    });
    if (existing) {
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        totalBhd: Number(existing.totalBhd),
        paymentStatus: existing.payments[0]?.status ?? 'PENDING',
      };
    }
  }

  const totals = computeTotals(
    lines.map((l) => ({ unitPriceBhd: l.unitPriceBhd, quantity: l.quantity })),
    coupon,
    input.shippingBhd,
  );

  const presentmentTotal = roundBhd(totals.totalBhd * input.currency.rateToBhd);

  // The coupon's own id is what links the order to the code it consumed; the
  // discount itself is computed from `coupon` above. Without this the order's
  // `couponId` stayed null and reporting could not attribute the discount.
  const couponIdForOrder =
    coupon && 'id' in (coupon as unknown as Record<string, unknown>)
      ? (coupon as unknown as { id: string }).id
      : null;

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextSequence(tx, {
      key: `order:${monthlyScope()}`,
      prefix: 'ATT',
      scope: monthlyScope(),
      pad: 6,
    });
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId,
        email: checkout.email,
        phone: checkout.phone,
        shippingName: checkout.fullName,
        shippingCountry: checkout.country,
        shippingCity: checkout.city,
        shippingArea: checkout.area || null,
        shippingAddress: checkout.address,
        shippingBuilding: checkout.building || null,
        shippingUnit: checkout.unit || null,
        notes: checkout.notes || null,
        status: 'PENDING',
        subtotalBhd: totals.subtotalBhd,
        discountBhd: totals.discountBhd,
        shippingBhd: totals.shippingBhd,
        totalBhd: totals.totalBhd,
        presentmentCode: input.currency.code,
        presentmentRate: input.currency.rateToBhd,
        presentmentTotal,
        rateCapturedAt: new Date(),
        couponId: couponIdForOrder,
        couponCode: checkout.couponCode || null,
        locale: input.locale,
        idempotencyKey: input.idempotencyKey ?? null,
        items: {
          // A cut product is itemised one OrderItem per physical piece so each
          // carries its own immutable measurement snapshot, tailors can be
          // assigned and settled per piece, and QC history is per piece. Simple
          // lines keep the grouped quantity.
          create: lines.flatMap((l) => {
            const hasSnapshot = l.pieces.some((p) => p.measurementSnapshot || p.sizeSnapshot);
            if (hasSnapshot) {
              return l.pieces.map((p) => ({
                productId: l.productId,
                variantId: l.variantId,
                productName: l.productName,
                variantLabel: p.sizeCode ?? l.variantLabel,
                sku: l.sku,
                imageUrl: l.imageUrl,
                unitPriceBhd: l.unitPriceBhd,
                quantity: 1,
                lineTotalBhd: roundBhd(l.unitPriceBhd),
                measurementKind: p.measurementKind ?? undefined,
                sizeCode: p.sizeCode,
                sizeSnapshot: (p.sizeSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
                measurementSnapshot: (p.measurementSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
                cutId: l.cutId,
              }));
            }
            return [
              {
                productId: l.productId,
                variantId: l.variantId,
                productName: l.productName,
                variantLabel: l.variantLabel,
                sku: l.sku,
                imageUrl: l.imageUrl,
                unitPriceBhd: l.unitPriceBhd,
                quantity: l.quantity,
                lineTotalBhd: roundBhd(l.unitPriceBhd * l.quantity),
              },
            ];
          }),
        },
        events: {
          create: { status: 'PENDING', messageEn: 'Order placed', messageAr: 'تم إنشاء الطلب' },
        },
      },
    });

    // Guarded stock decrement — fails the whole transaction on oversell, and
    // records the movement in the ledger so stock never changes silently.
    for (const line of lines) {
      if (!line.variantId) continue;
      const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
      if (!variant || !variant.isActive) {
        throw new CheckoutError('Selected variant is unavailable', 'UNAVAILABLE');
      }
      if (variant.stockStatus === 'OUT_OF_STOCK') {
        throw new CheckoutError('Selected variant is out of stock', 'UNAVAILABLE');
      }
      if (variant.stockStatus === 'PRE_ORDER') continue;
      const updated = await tx.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (updated.count === 0) {
        throw new CheckoutError('Not enough stock for the requested quantity', 'UNAVAILABLE');
      }
      await tx.inventoryMovement.create({
        data: {
          variantId: line.variantId,
          productId: line.productId,
          type: 'SALE',
          quantity: -line.quantity,
          stockAfter: variant.stock - line.quantity,
          orderId: created.id,
        },
      });
    }

    if (couponIdForOrder) {
      await tx.coupon.update({
        where: { id: couponIdForOrder },
        data: { usedCount: { increment: 1 } },
      });
      // Append-only redemption row: the per-customer limit and refund reverts
      // both read from this, and history is never rewritten.
      await tx.couponRedemption.create({
        data: {
          couponId: couponIdForOrder,
          customerId: input.customerId,
          orderId: created.id,
          guestEmailHash: input.customerId ? null : (input.guestEmailHash ?? null),
          amountBhd: totals.discountBhd,
        },
      });
    }

    return created;
  });

  // Initialise the payment outside the order transaction. A provider failure
  // never deletes the order — it is left PENDING so the customer can retry.
  const provider = getPaymentProvider(checkout.paymentMethod);
  let init: PaymentInitResult;
  try {
    init = await provider.init({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountBhd: totals.totalBhd,
      currencyCode: input.currency.code,
      amountPresentment: presentmentTotal,
      customer: { name: checkout.fullName, email: checkout.email, phone: checkout.phone },
      returnUrl: `${input.baseUrl}/${input.locale}/checkout/success`,
      cancelUrl: `${input.baseUrl}/${input.locale}/checkout`,
    });
  } catch {
    init = { status: 'FAILED', provider: provider.key };
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      method: checkout.paymentMethod,
      provider: init.provider,
      status: init.status === 'PAID' ? 'PAID' : init.status === 'FAILED' ? 'FAILED' : 'PENDING',
      amountBhd: totals.totalBhd,
      currencyCode: input.currency.code,
      amountPresentment: presentmentTotal,
      providerRef: init.providerRef ?? null,
      // Persist the provider-hosted payment page so the customer can resume a
      // redirect they abandoned (the order detail page surfaces a "Pay now"
      // link while the payment is unsettled).
      paymentUrl: init.redirectUrl ?? null,
      paidAt: init.status === 'PAID' ? new Date() : null,
      failedReason: init.status === 'FAILED' ? 'Provider initialisation failed' : null,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalBhd: totals.totalBhd,
    paymentStatus: payment.status,
    redirectUrl: init.redirectUrl,
    instructions: init.instructions,
  };
}

const STATUS_ORDER: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'READY',
  'SHIPPED',
  'DELIVERED',
];

export function statusIndex(status: OrderStatus): number {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? -1 : i;
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'CANCELLED' || status === 'REFUNDED';
}

/**
 * Releases stock held by an order's items back into inventory, recording a
 * movement per line. Safe to call once — guarded by the order's terminal state.
 */
export async function releaseOrderStock(
  orderId: string,
  actorId: string | null,
  tx?: Prisma.TransactionClient,
) {
  const run = async (client: Prisma.TransactionClient) => {
    const items = await client.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (!item.variantId) continue;
      const variant = await client.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) continue;
      const stockAfter = variant.stock + item.quantity;
      await client.productVariant.update({
        where: { id: item.variantId },
        data: {
          stock: stockAfter,
          stockStatus:
            variant.stockStatus === 'PRE_ORDER'
              ? 'PRE_ORDER'
              : stockAfter <= 0
                ? 'OUT_OF_STOCK'
                : variant.stockStatus === 'OUT_OF_STOCK'
                  ? 'IN_STOCK'
                  : variant.stockStatus,
        },
      });
      await client.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          productId: item.productId ?? '',
          type: 'CANCELLATION',
          quantity: item.quantity,
          stockAfter,
          orderId,
          actorId,
          reason: 'Order cancelled — stock released',
        },
      });
    }
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/** Applies a verified payment result to an order, idempotently. */
export async function applyPaymentResult(params: {
  orderId: string;
  providerRef?: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  signatureVerified: boolean;
  rawPayload?: unknown;
}) {
  const { orderId, status, signatureVerified } = params;
  if (!signatureVerified) {
    throw new CheckoutError('Unverified payment callback rejected', 'PAYMENT_FAILED');
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { customerId: true, orderNumber: true, status: true } } },
    });
    if (!payment) throw new CheckoutError('Payment not found', 'PAYMENT_FAILED');

    if (status === 'PAID' && payment.status === 'PAID') {
      return { payment, justPaid: false }; // idempotent — already applied
    }

    // A settled payment can never be downgraded by a later or replayed callback
    // (e.g. a delayed FAILED event after a successful capture). Refunds are the
    // only legal move away from a settled state and are handled elsewhere.
    const settled = payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED';
    if (settled && status !== 'PAID' && status !== 'REFUNDED') {
      return { payment, justPaid: false };
    }

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status,
        providerRef: params.providerRef ?? payment.providerRef,
        paidAt: status === 'PAID' ? new Date() : payment.paidAt,
        signatureVerified: true,
        providerPayload: (params.rawPayload ?? undefined) as never,
      },
    });

    let justPaid = false;
    if (status === 'PAID') {
      justPaid = true;
      // Only the PENDING → CONFIRMED transition is ours to make. If the order
      // has already moved on (or was cancelled/refunded), a late callback must
      // not drag it backwards into CONFIRMED.
      if (payment.order.status === 'PENDING') {
        await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
        await tx.orderEvent.create({
          data: {
            orderId,
            status: 'CONFIRMED',
            messageEn: 'Payment confirmed',
            messageAr: 'تم تأكيد الدفع',
          },
        });
      }
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await tx.orderEvent.create({
        data: {
          orderId,
          status: 'PENDING',
          messageEn: 'Payment not completed',
          messageAr: 'لم تكتمل عملية الدفع',
        },
      });
    }
    return {
      payment: updated,
      justPaid,
      customerId: payment.order.customerId,
      orderNumber: payment.order.orderNumber,
    };
  });

  // Mirror the admin payment path: a provider-confirmed payment must notify the
  // customer and refresh their derived membership. Runs after commit so the
  // recompute reads the settled state.
  if (outcome.justPaid && outcome.orderNumber) {
    await notifyOrderStatus(prisma, {
      customerId: outcome.customerId,
      orderNumber: outcome.orderNumber,
      status: 'CONFIRMED',
    });
    if (outcome.customerId) {
      await recomputeCustomerMembership(outcome.customerId);
    }
  }

  return outcome.payment;
}
