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
import { validatePieces, type PieceInput } from './measurement-plan';
import { getCutForProduct } from './size-guide-db';
import { STOREFRONT_PRODUCT_STATUSES } from './catalog';
import type { CheckoutInput } from './validation';
import type { OrderStatus, Prisma, PaymentStatus, QuickOrderSource } from '@prisma/client';

/** True when an error is Prisma's unique-constraint violation (P2002). */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

/**
 * A stable fingerprint of the commercial payload that produces an order —
 * product/variant/quantity, each piece's measurement identity, shipping,
 * payment method and any staff discount. It deliberately excludes contact and
 * address details: a retry that only corrects a typo in the delivery note is
 * the same commercial request, while a changed item, size, measurement or
 * amount is not. Used to reject a reused idempotency key whose payload differs.
 */
export function orderFingerprint(input: {
  lines: { productId: string; variantId: string | null; quantity: number; unitPriceBhd: number; pieces: { measurementKind: string | null; sizeCode: string | null; values: Record<string, number> | null }[] }[];
  shippingBhd: number;
  paymentMethod: string;
  couponCode?: string | null;
  manualDiscountBhd?: number;
}): string {
  const canonical = {
    lines: input.lines.map((l) => ({
      p: l.productId,
      v: l.variantId,
      q: l.quantity,
      up: l.unitPriceBhd,
      pc: l.pieces.map((p) => ({
        k: p.measurementKind,
        s: p.sizeCode,
        vals: p.values
          ? Object.keys(p.values)
              .sort()
              .map((key) => [key, p.values?.[key]])
          : null,
      })),
    })),
    sh: input.shippingBhd,
    pm: input.paymentMethod,
    cc: input.couponCode ?? null,
    md: input.manualDiscountBhd ?? 0,
  };
  return JSON.stringify(canonical);
}

export interface ResolvedPiece {
  measurementKind: 'READY' | 'CUSTOM' | null;
  sizeCode: string | null;
  sizeSnapshot: unknown;
  measurementSnapshot: unknown;
  /** Variant this physical piece resolves to (READY sizes), when sold by size. */
  variantId: string | null;
  /**
   * This piece's effective unit price (its variant override, else the product
   * base). Always set for a per-piece line so an item row is priced from the
   * piece itself rather than a representative line price.
   */
  unitPriceBhd: number | null;
}

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
  /**
   * Explicit line total. Differs from `unitPriceBhd * quantity` only when the
   * physical pieces of one line carry different variant prices.
   */
  lineTotalBhd: number;
  /** One entry per physical piece; empty for lines without measurements. */
  pieces: ResolvedPiece[];
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
      | 'LINK_USED'
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

export interface ResolveLineOptions {
  /**
   * When false (staff Quick Order), a cut product without a stored per-piece
   * configuration is taken at its selected ready size.
   */
  requireMeasurements?: boolean;
  /**
   * Server-validated per-piece configuration supplied by a caller that has no
   * cart (the public Quick Order landing form). Keyed by product id. Each entry
   * is the exact `PieceInput[]` the client sent; it is re-validated against the
   * product's stored cut here and never trusted as-is. When present it takes
   * precedence over the cart lookup for that product.
   */
  piecesByProduct?: Record<string, PieceInput[]>;
}

/**
 * Resolves client cart lines against the database. Prices are always taken
 * from the server — the client can never dictate a price. Unavailable or
 * archived products are rejected rather than silently dropped.
 */
export async function resolveCartLines(
  lines: RawLine[],
  options: ResolveLineOptions = {},
): Promise<ResolvedLine[]> {
  const requireMeasurements = options.requireMeasurements ?? true;
  const piecesByProduct = options.piecesByProduct ?? null;
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
    // The product's own base price, kept separately because `unitPrice` is
    // replaced by a representative variant's override below. A piece that has no
    // override of its own must fall back to this base, never to another piece's
    // representative price.
    const basePrice = unitPrice;
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
    } else if (product.variants.length > 0 && !piecesByProduct?.[product.id]) {
      throw new CheckoutError('Please select a size', 'UNAVAILABLE');
    }

    if (line.quantity < 1 || line.quantity > 20) {
      throw new CheckoutError('Invalid quantity', 'UNAVAILABLE');
    }

    // Cut products must carry one complete measurement config per piece. The
    // snapshots are frozen from a server-validated source: the cart's own
    // copies (written server-side at add-to-cart) or, for a caller with no cart,
    // the pieces re-validated here against the product's stored cut. A tampered
    // client payload can never influence the snapshot.
    const pieces: ResolvedPiece[] = [];
    const overridePieces = piecesByProduct?.[product.id];
    if (product.cut?.id) {
      if (overridePieces) {
        // Re-derive every piece from the stored cut; the client's raw values are
        // only intent. Fails loudly rather than silently dropping a piece.
        const cut = await getCutForProduct(product.id);
        if (!cut) throw new CheckoutError('Product configuration is unavailable', 'UNAVAILABLE');
        if (overridePieces.length !== line.quantity) {
          throw new CheckoutError('Please choose your measurements', 'UNAVAILABLE');
        }
        const validated = validatePieces(cut, overridePieces);
        if (!validated.ok) {
          throw new CheckoutError(`MEASUREMENT_INVALID:${validated.error.code}`, 'UNAVAILABLE');
        }
        for (const vp of validated.pieces) {
          const variant = vp.sizeCode
            ? (product.variants.find((v) => v.size === vp.sizeCode && v.isActive) ?? null)
            : null;
          if (vp.sizeCode && product.variants.length > 0 && !variant) {
            throw new CheckoutError('Selected variant is unavailable', 'UNAVAILABLE');
          }
          pieces.push({
            measurementKind: vp.snapshot.kind,
            sizeCode: vp.sizeCode,
            sizeSnapshot: vp.snapshot.kind === 'READY' ? vp.snapshot : null,
            measurementSnapshot: vp.snapshot,
            variantId: variant?.id ?? null,
            unitPriceBhd: variant?.priceBhd != null ? Number(variant.priceBhd) : basePrice,
          });
        }
      } else if (!requireMeasurements) {
        // Staff Quick Order: the piece is taken at its selected ready size. When
        // the product is sold by size, a size is mandatory so the size-matched
        // variant (and therefore its stock) is still enforced — a cut product
        // with variants can never be ordered without one.
        if (product.variants.length > 0 && !line.variantId) {
          throw new CheckoutError('Please select a size', 'UNAVAILABLE');
        }
        const sizeCode = line.variantId
          ? (product.variants.find((v) => v.id === line.variantId && v.isActive)?.size ?? null)
          : null;
        pieces.push({ measurementKind: null, sizeCode, sizeSnapshot: null, measurementSnapshot: null, variantId: line.variantId ?? null, unitPriceBhd: null });
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
          const variant = p.sizeCode
            ? (product.variants.find((v) => v.size === p.sizeCode && v.isActive) ?? null)
            : null;
          pieces.push({
            measurementKind: p.measurementKind,
            sizeCode: p.sizeCode,
            sizeSnapshot: p.sizeSnapshot,
            measurementSnapshot: p.measurementSnapshot,
            variantId: variant?.id ?? null,
            unitPriceBhd: variant?.priceBhd != null ? Number(variant.priceBhd) : basePrice,
          });
        }
      }
    }

    // Per-piece pricing: a line is priced per physical piece only when it
    // carries exactly one piece per ordered unit (the cut-product case). The
    // line total is then the sum of each piece's effective price — its
    // variant's override or the product base — so pieces of different sizes or
    // prices are charged accurately. Size-only lines (one representative piece
    // for a quantity > 1) keep unit price × quantity.
    const perPiecePriced = pieces.length > 0 && pieces.length === line.quantity;
    const effectivePiecePrices = pieces.map((p) => p.unitPriceBhd ?? unitPrice);
    const lineTotalBhd = perPiecePriced
      ? roundBhd(effectivePiecePrices.reduce((sum, price) => sum + price, 0))
      : roundBhd(unitPrice * line.quantity);

    resolved.push({
      productId: product.id,
      variantId: line.variantId ?? null,
      quantity: line.quantity,
      unitPriceBhd: perPiecePriced ? roundBhd(Math.max(...effectivePiecePrices)) : roundBhd(unitPrice),
      productName: product.nameEn,
      variantLabel,
      sku,
      imageUrl: product.media[0]?.url ?? null,
      stockStatus,
      cutId: product.cut?.id ?? null,
      pieces,
      lineTotalBhd,
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
  /**
   * Fingerprint of the commercial payload (lines, pieces, shipping, discount,
   * payment method). When a key is present, a retry must present the same
   * fingerprint; a materially different payload under the same key is rejected
   * rather than silently applied to the existing order.
   */
  idempotencyFingerprint?: string | null;
  baseUrl: string;
  /** Guest identity anchor for coupon per-customer limits (hashed email). */
  guestEmailHash?: string | null;
  /**
   * When set, the order is tied to a Quick Order link. The link is claimed
   * inside the same transaction that creates the order, so a link can yield at
   * most one order even under concurrent submits: the second claim matches zero
   * rows and the whole transaction rolls back.
   */
  quickOrder?: { linkId: string; source: QuickOrderSource } | null;
  /**
   * Staff-applied discount as a first-class amount (never applied by mutating
   * line prices). Clamped to the subtotal and recorded in the order's discount
   * total so the per-line snapshot stays truthful.
   */
  manualDiscountBhd?: number;
  /** Sales channel. Defaults to QUICK_ORDER when a Quick Order link is used. */
  channel?: 'ONLINE' | 'QUICK_ORDER';
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  totalBhd: number;
  paymentStatus: PaymentStatus;
  redirectUrl?: string;
  instructions?: { en: string; ar: string };
  /** True when an existing order was returned for a repeated idempotency key. */
  replayed?: boolean;
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
      // Same key, different commercial payload must not be silently applied to
      // the existing order. When the stored order carries a fingerprint (every
      // keyed order written since Phase 5 does) and it differs, reject.
      if (
        input.idempotencyFingerprint != null &&
        existing.idempotencyFingerprint != null &&
        existing.idempotencyFingerprint !== input.idempotencyFingerprint
      ) {
        throw new CheckoutError('This request does not match the order already placed', 'DUPLICATE');
      }
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        totalBhd: Number(existing.totalBhd),
        paymentStatus: existing.payments[0]?.status ?? 'PENDING',
        replayed: true,
      };
    }
  }

  const totals = computeTotals(
    lines.map((l) => ({ unitPriceBhd: l.unitPriceBhd, quantity: l.quantity, lineTotalBhd: l.lineTotalBhd })),
    coupon,
    input.shippingBhd,
  );

  // A staff Quick Order discount is applied as a first-class amount on top of
  // the computed totals — never by rewriting line prices — so the stored
  // per-line snapshot stays truthful. It is clamped to the subtotal so a manual
  // entry can never make the order negative.
  const manualDiscount = roundBhd(
    Math.min(Math.max(input.manualDiscountBhd ?? 0, 0), totals.subtotalBhd),
  );
  const finalDiscountBhd = roundBhd(totals.discountBhd + manualDiscount);
  const finalTotalBhd = roundBhd(Math.max(0, totals.totalBhd - manualDiscount));

  const presentmentTotal = roundBhd(finalTotalBhd * input.currency.rateToBhd);

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
        discountBhd: finalDiscountBhd,
        shippingBhd: totals.shippingBhd,
        totalBhd: finalTotalBhd,
        presentmentCode: input.currency.code,
        presentmentRate: input.currency.rateToBhd,
        presentmentTotal,
        rateCapturedAt: new Date(),
        couponId: couponIdForOrder,
        couponCode: checkout.couponCode || null,
        locale: input.locale,
        idempotencyKey: input.idempotencyKey ?? null,
        idempotencyFingerprint: input.idempotencyFingerprint ?? null,
        channel: input.channel ?? (input.quickOrder ? 'QUICK_ORDER' : 'ONLINE'),
        quickOrderSource: input.quickOrder?.source ?? null,
        items: {
          // A cut product is itemised one OrderItem per physical piece so each
          // carries its own immutable measurement snapshot, tailors can be
          // assigned and settled per piece, and QC history is per piece. Simple
          // lines keep the grouped quantity.
          create: lines.flatMap((l) => {
            const hasSnapshot = l.pieces.some((p) => p.measurementSnapshot || p.sizeSnapshot);
            if (hasSnapshot) {
              return l.pieces.map((p) => {
                const piecePrice = roundBhd(p.unitPriceBhd ?? l.unitPriceBhd);
                return {
                  productId: l.productId,
                  variantId: p.variantId ?? l.variantId,
                  productName: l.productName,
                  variantLabel: p.sizeCode ?? l.variantLabel,
                  sku: l.sku,
                  imageUrl: l.imageUrl,
                  unitPriceBhd: piecePrice,
                  quantity: 1,
                  lineTotalBhd: piecePrice,
                  measurementKind: p.measurementKind ?? undefined,
                  sizeCode: p.sizeCode,
                  sizeSnapshot: (p.sizeSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
                  measurementSnapshot: (p.measurementSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
                  cutId: l.cutId,
                };
              });
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
                lineTotalBhd: roundBhd(l.lineTotalBhd ?? l.unitPriceBhd * l.quantity),
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
    // Demand is aggregated per variant first: a line's physical pieces may
    // resolve to different variants (e.g. piece 1 = M, piece 2 = M, piece 3 =
    // XL), so each variant must have enough stock for the total demanded from
    // it, and each is decremented once.
    const demandByVariant = new Map<string, { productId: string; quantity: number }>();
    for (const line of lines) {
      const pieceVariants = line.pieces.filter((p) => p.variantId);
      if (pieceVariants.length > 0) {
        for (const p of pieceVariants) {
          const key = p.variantId as string;
          const prev = demandByVariant.get(key);
          demandByVariant.set(key, { productId: line.productId, quantity: (prev?.quantity ?? 0) + 1 });
        }
      } else if (line.variantId) {
        const prev = demandByVariant.get(line.variantId);
        demandByVariant.set(line.variantId, { productId: line.productId, quantity: (prev?.quantity ?? 0) + line.quantity });
      }
    }

    for (const [variantId, demand] of demandByVariant) {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || !variant.isActive) {
        throw new CheckoutError('Selected variant is unavailable', 'UNAVAILABLE');
      }
      if (variant.stockStatus === 'OUT_OF_STOCK') {
        throw new CheckoutError('Selected variant is out of stock', 'UNAVAILABLE');
      }
      if (variant.stockStatus === 'PRE_ORDER') continue;
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, stock: { gte: demand.quantity } },
        data: { stock: { decrement: demand.quantity } },
      });
      if (updated.count === 0) {
        throw new CheckoutError('Not enough stock for the requested quantity', 'UNAVAILABLE');
      }
      await tx.inventoryMovement.create({
        data: {
          variantId,
          productId: demand.productId,
          type: 'SALE',
          quantity: -demand.quantity,
          stockAfter: variant.stock - demand.quantity,
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

    // Claim the Quick Order link atomically. The `orderId: null` guard means a
    // link already used by another order (or by a racing submit) matches zero
    // rows here and the whole transaction rolls back — a link can never yield
    // two orders.
    if (input.quickOrder) {
      const claimed = await tx.quickOrderLink.updateMany({
        where: { id: input.quickOrder.linkId, orderId: null, revokedAt: null },
        data: { orderId: created.id },
      });
      if (claimed.count === 0) {
        throw new CheckoutError('This quick order link has already been used', 'LINK_USED');
      }
    }

    return created;
  });

  // Initialise the payment outside the order transaction, so a slow or failing
  // provider never holds the order lock. A provider failure does not delete the
  // order, but it does cancel it (releasing reserved stock) rather than leaving
  // it PENDING — an order that never reached a live payment session must not sit
  // in the queue as "awaiting payment".
  const provider = getPaymentProvider(checkout.paymentMethod);
  let init: PaymentInitResult;
  try {
    init = await provider.init({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountBhd: finalTotalBhd,
      currencyCode: input.currency.code,
      amountPresentment: presentmentTotal,
      customer: { name: checkout.fullName, email: checkout.email, phone: checkout.phone },
      returnUrl: `${input.baseUrl}/${input.locale}/checkout/success`,
      cancelUrl: `${input.baseUrl}/${input.locale}/checkout`,
    });
  } catch (err) {
    // Never surface provider internals to the client; keep the reason in logs.
    console.error('[checkout] payment initialisation failed', err);
    init = { status: 'FAILED', provider: provider.key, failureReason: 'Provider initialisation failed' };
  }

  if (init.status === 'FAILED') {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: checkout.paymentMethod,
          provider: init.provider,
          status: 'FAILED',
          amountBhd: finalTotalBhd,
          currencyCode: input.currency.code,
          amountPresentment: presentmentTotal,
          failedReason: init.failureReason ?? 'Provider initialisation failed',
        },
      });
      // Release the reserved stock and mark the order cancelled, transactionally.
      await releaseOrderStock(order.id, null, tx);
      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelReason: 'Payment initialisation failed' } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: 'CANCELLED',
          messageEn: 'Payment could not be started',
          messageAr: 'تعذّر بدء عملية الدفع',
        },
      });
    });
    throw new CheckoutError(
      'We could not start the payment for this order. No charge was made; your bag is still saved.',
      'PAYMENT_FAILED',
    );
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      method: checkout.paymentMethod,
      provider: init.provider,
      status: init.status === 'PAID' ? 'PAID' : 'PENDING',
      amountBhd: finalTotalBhd,
      currencyCode: input.currency.code,
      amountPresentment: presentmentTotal,
      providerRef: init.providerRef ?? null,
      // Persist the provider-hosted payment page so the customer can resume a
      // redirect they abandoned (the order detail page surfaces a "Pay now"
      // link while the payment is unsettled).
      paymentUrl: init.redirectUrl ?? null,
      paidAt: init.status === 'PAID' ? new Date() : null,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalBhd: finalTotalBhd,
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
  /**
   * Durable identity of the signature-verified provider callback. When present
   * it is recorded inside the same transaction as the state change, so a
   * replayed body can never append a second business event.
   */
  webhookEventKey?: string;
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

    // Record the callback identity first (atomic with the write below). A
    // duplicate key here means the exact same callback is being applied twice,
    // so we must not append another event — return the current state untouched.
    // Only a unique-constraint violation is a duplicate; any other error is a
    // real failure and must propagate rather than be swallowed as a replay.
    if (params.webhookEventKey) {
      try {
        await tx.paymentWebhookEvent.create({
          data: {
            provider: payment.provider,
            eventKey: params.webhookEventKey,
            orderId,
            status,
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return { payment, justPaid: false, deduplicated: true };
        }
        throw err;
      }
    }

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
