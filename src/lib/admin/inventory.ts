import 'server-only';
import { prisma } from '../prisma';
import { AdminActionError, type AdminUser } from '../admin-auth';
import type { InventoryMovementType } from '@prisma/client';

export interface AdjustStockInput {
  variantId: string;
  /** Signed delta. Positive restocks, negative removes. */
  delta: number;
  type?: InventoryMovementType;
  reason?: string;
}

/**
 * Applies a signed stock adjustment and writes the matching ledger entry in one
 * transaction, so on-hand quantities and the movement history can never drift.
 */
export async function adjustStock(admin: AdminUser, input: AdjustStockInput) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new AdminActionError('Adjustment must be a non-zero whole number', 'INVALID');
  }
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant) throw new AdminActionError('Variant not found', 'NOT_FOUND', 404);

    const stockAfter = variant.stock + input.delta;
    if (stockAfter < 0) throw new AdminActionError('Stock cannot go below zero', 'NEGATIVE_STOCK', 409);

    const updated = await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        stock: stockAfter,
        stockStatus:
          variant.stockStatus === 'PRE_ORDER'
            ? 'PRE_ORDER'
            : stockAfter <= 0
              ? 'OUT_OF_STOCK'
              : stockAfter <= 5
                ? 'LOW_STOCK'
                : 'IN_STOCK',
      },
    });

    await tx.inventoryMovement.create({
      data: {
        variantId: variant.id,
        productId: variant.productId,
        type: input.type ?? 'MANUAL_ADJUSTMENT',
        quantity: input.delta,
        stockAfter,
        reason: input.reason ?? 'Manual adjustment',
        actorId: admin.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: 'inventory.adjust',
        entity: 'ProductVariant',
        entityId: variant.id,
        metadata: { delta: input.delta, stockAfter, reason: input.reason ?? null } as never,
      },
    });

    return updated;
  });
}

export interface InventorySummary {
  totalSkus: number;
  totalUnits: number;
  lowStock: number;
  outOfStock: number;
  valueBhd: number;
}
