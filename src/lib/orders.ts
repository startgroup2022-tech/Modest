import 'server-only';
import { prisma } from './prisma';
import { computeTotals, type CouponLike } from './money';
import { generateOrderNumber, roundBhd } from './utils';
import { getPaymentProvider, type PaymentInitResult } from './payments';
import type { CheckoutInput } from './validation';
import type { OrderStatus, PaymentStatus } from '@prisma/client';

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
export async function resolveCartLines(lines: RawLine[]): Promise<ResolvedLine[]> {
  if (!lines.length) return [];
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      variants: true,
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolved: ResolvedLine[] = [];

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product || product.status !== 'ACTIVE') {
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

  const order = await prisma.$transaction(async (tx) => {
    // Guarded stock decrement — fails the whole transaction on oversell.
    for (const line of lines) {
      if (!line.variantId) continue;
      const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
      if (!variant || !variant.isActive) {
        throw new CheckoutError('Selected variant is unavailable', 'UNAVAILABLE');
      }
      if (variant.stockStatus === 'OUT_OF_STOCK') {
        throw new CheckoutError('Selected variant is out of stock', 'UNAVAILABLE');
      }
      if (variant.stockStatus !== 'PRE_ORDER') {
        const updated = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw new CheckoutError('Not enough stock for the requested quantity', 'UNAVAILABLE');
        }
      }
    }

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
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
        couponId: coupon ? undefined : null,
        couponCode: checkout.couponCode || null,
        idempotencyKey: input.idempotencyKey ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            variantLabel: l.variantLabel,
            sku: l.sku,
            imageUrl: l.imageUrl,
            unitPriceBhd: l.unitPriceBhd,
            quantity: l.quantity,
            lineTotalBhd: roundBhd(l.unitPriceBhd * l.quantity),
          })),
        },
        events: {
          create: { status: 'PENDING', messageEn: 'Order placed', messageAr: 'تم إنشاء الطلب' },
        },
      },
    });

    const couponId = coupon && 'id' in (coupon as unknown as Record<string, unknown>)
      ? ((coupon as unknown as { id: string }).id)
      : null;
    if (couponId) {
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
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
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new CheckoutError('Payment not found', 'PAYMENT_FAILED');

    if (status === 'PAID' && payment.status === 'PAID') {
      return payment; // idempotent — already applied
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

    if (status === 'PAID') {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
      await tx.orderEvent.create({
        data: {
          orderId,
          status: 'CONFIRMED',
          messageEn: 'Payment confirmed',
          messageAr: 'تم تأكيد الدفع',
        },
      });
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
    return updated;
  });
}
