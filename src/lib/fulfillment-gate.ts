import 'server-only';
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

/**
 * Fulfillment gate — no uninspected piece becomes shipment-eligible.
 *
 * An order reaches READY / SHIPPED only when every piece that requires
 * production is finished and QC-passed. "Requires production" is derived, not
 * invented: a piece needs the atelier when it has a production task, when it is
 * a custom/made-to-measure piece (`measurementKind = CUSTOM`), when it is made
 * to order, or when it is a cut-based piece. A plain in-stock READY piece
 * carries no task and is exempt, so ordinary stock fulfillment keeps working.
 *
 * A piece is complete when it has at least one production task and *all* of its
 * tasks are COMPLETED (a QC pass sets the task COMPLETED; a failure sets REWORK).
 * A production piece with no task yet, or with any task not COMPLETED, blocks
 * the order — so QC cannot be bypassed by moving the order straight to READY.
 */

type Client = Prisma.TransactionClient | typeof prisma;

export interface IncompletePiece {
  orderItemId: string;
  productName: string;
  status: string | null;
}

export class FulfillmentGateError extends Error {
  code = 'PRODUCTION_INCOMPLETE';
  status = 409;
  pieces: IncompletePiece[];
  constructor(pieces: IncompletePiece[]) {
    const count = pieces.length;
    super(
      count === 1
        ? 'This order has a piece still in production or awaiting quality control'
        : `This order has ${count} pieces still in production or awaiting quality control`,
    );
    this.name = 'FulfillmentGateError';
    this.pieces = pieces;
  }
}

/** Pieces of an order that require production and are not yet QC-complete. */
export async function incompleteProductionPieces(
  orderId: string,
  client: Client = prisma,
): Promise<IncompletePiece[]> {
  const items = await client.orderItem.findMany({
    where: { orderId },
    select: {
      id: true,
      productName: true,
      measurementKind: true,
      product: { select: { madeToOrder: true, cutId: true } },
      productionTasks: { select: { status: true } },
    },
  });

  const incomplete: IncompletePiece[] = [];
  for (const item of items) {
    const requiresProduction =
      item.productionTasks.length > 0 ||
      item.measurementKind === 'CUSTOM' ||
      item.product?.madeToOrder === true ||
      item.product?.cutId != null;
    if (!requiresProduction) continue;

    const allComplete =
      item.productionTasks.length > 0 && item.productionTasks.every((t) => t.status === 'COMPLETED');
    if (!allComplete) {
      incomplete.push({
        orderItemId: item.id,
        productName: item.productName,
        status: item.productionTasks[0]?.status ?? null,
      });
    }
  }
  return incomplete;
}

/** Throws `FulfillmentGateError` when any production piece is not QC-complete. */
export async function assertOrderReadyForFulfillment(orderId: string, client: Client = prisma): Promise<void> {
  const incomplete = await incompleteProductionPieces(orderId, client);
  if (incomplete.length > 0) throw new FulfillmentGateError(incomplete);
}
