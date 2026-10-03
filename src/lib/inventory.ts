import 'server-only';
import type { InventoryMovementType, Prisma, StockStatus } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Every change to stock flows through this ledger so nothing is altered
 * silently. The movement is written inside the same transaction as the stock
 * change, and `stockAfter` records the resulting level for audit.
 */

export interface AdjustStockInput {
  variantId: string;
  /** Signed delta. Positive increases stock, negative decreases it. */
  quantity: number;
  type: InventoryMovementType;
  reason?: string | null;
  orderId?: string | null;
  actorId?: string | null;
}

function deriveStockStatus(stock: number, current: StockStatus, threshold: number): StockStatus {
  if (current === 'PRE_ORDER') return 'PRE_ORDER';
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export async function adjustStock(input: AdjustStockInput, tx?: Prisma.TransactionClient) {
  const run = async (client: Prisma.TransactionClient) => {
    const variant = await client.productVariant.findUnique({
      where: { id: input.variantId },
      include: { product: { select: { lowStockThreshold: true } } },
    });
    if (!variant) throw new Error('Variant not found');

    const stockAfter = variant.stock + input.quantity;
    if (stockAfter < 0) throw new Error('Adjustment would make stock negative');

    await client.productVariant.update({
      where: { id: input.variantId },
      data: {
        stock: stockAfter,
        stockStatus: deriveStockStatus(stockAfter, variant.stockStatus, variant.product.lowStockThreshold),
      },
    });

    return client.inventoryMovement.create({
      data: {
        variantId: input.variantId,
        productId: variant.productId,
        type: input.type,
        quantity: input.quantity,
        stockAfter,
        reason: input.reason ?? null,
        orderId: input.orderId ?? null,
        actorId: input.actorId ?? null,
      },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/** Sets stock to an absolute level, recording the delta as a movement. */
export async function setStockLevel(
  params: { variantId: string; newLevel: number; reason?: string | null; actorId?: string | null },
  tx?: Prisma.TransactionClient,
) {
  const run = async (client: Prisma.TransactionClient) => {
    const variant = await client.productVariant.findUnique({ where: { id: params.variantId } });
    if (!variant) throw new Error('Variant not found');
    const delta = params.newLevel - variant.stock;
    if (delta === 0) return null;
    return adjustStock(
      {
        variantId: params.variantId,
        quantity: delta,
        type: 'MANUAL_ADJUSTMENT',
        reason: params.reason ?? null,
        actorId: params.actorId ?? null,
      },
      client,
    );
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/** Total inventory value at cost, and counts by stock state. */
export async function getInventorySummary() {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true },
    select: {
      stock: true,
      reserved: true,
      incoming: true,
      costBhd: true,
      priceBhd: true,
      stockStatus: true,
      product: { select: { priceBhd: true, lowStockThreshold: true, status: true } },
    },
  });

  let valueAtCost = 0;
  let valueAtRetail = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let units = 0;
  for (const v of variants) {
    const cost = Number(v.costBhd ?? 0);
    const retail = Number(v.priceBhd ?? v.product.priceBhd);
    valueAtCost += cost * v.stock;
    valueAtRetail += retail * v.stock;
    units += v.stock;
    if (v.stock <= 0) outOfStock += 1;
    else if (v.stock <= v.product.lowStockThreshold) lowStock += 1;
  }
  return { valueAtCost, valueAtRetail, units, lowStock, outOfStock, variantCount: variants.length };
}
