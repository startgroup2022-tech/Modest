/**
 * Membership calculation (pure).
 *
 * A customer's tier is *derived* from the number of qualifying paid,
 * non-refunded abayas — it is never an independently editable truth. The
 * `Customer.membershipTierId` column only caches the last computed result.
 */

export interface MembershipTierLike {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  minQualifying: number;
  isActive: boolean;
  sortOrder: number;
}

export interface QualifyingLine {
  /** Quantity of the piece. */
  quantity: number;
  /** Whether the line's order has a settled (PAID) payment. */
  paid: boolean;
  /** Whether the line has been refunded (fully or partially). */
  refunded: boolean;
}

/** One physical ordered piece considered for qualification. */
export interface QualifyingPiece {
  /** Quantity of the piece (usually 1 — cut pieces are itemised individually). */
  quantity: number;
  /** The order's settled financial state. */
  paid: boolean;
  /** Cancelled / refunded orders never qualify. */
  orderCancelled: boolean;
  orderRefunded: boolean;
  /** Refunded amount attributable to this piece, in BHD. */
  refundedBhd: number;
  /** The piece's own line total, in BHD. Used to detect a fully refunded piece. */
  lineTotalBhd: number;
}

export interface MembershipProgress {
  tier: MembershipTierLike | null;
  nextTier: MembershipTierLike | null;
  qualifyingCount: number;
  /** Pieces still needed to reach the next tier; null when already at the top. */
  toNext: number | null;
  /** 0–100 progress toward the next tier (100 when at the top). */
  percent: number;
}

/**
 * Whether a single piece qualifies. A piece qualifies when its order is paid,
 * not cancelled, and the piece itself has not been fully refunded.
 */
export function pieceQualifies(piece: QualifyingPiece): boolean {
  if (!piece.paid || piece.orderCancelled || piece.orderRefunded) return false;
  const qty = Math.max(0, piece.quantity);
  if (qty === 0) return false;
  // A line whose refunded amount covers its whole value no longer qualifies.
  if (piece.refundedBhd > 0 && piece.lineTotalBhd > 0 && piece.refundedBhd >= piece.lineTotalBhd - 0.0001) {
    return false;
  }
  return true;
}

/**
 * Counts qualifying pieces: paid lines minus refunded pieces, floored at zero.
 * A partially refunded line is treated as non-qualifying for the refunded
 * quantity (approximated at line level until line-level refunds exist).
 */
export function countQualifyingPieces(lines: QualifyingLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (!line.paid || line.refunded) continue;
    total += Math.max(0, line.quantity);
  }
  return total;
}

/** Counts qualifying pieces from the full per-piece model. */
export function countQualifyingPieceRows(pieces: QualifyingPiece[]): number {
  let total = 0;
  for (const piece of pieces) {
    if (!pieceQualifies(piece)) continue;
    total += Math.max(0, piece.quantity);
  }
  return total;
}

/**
 * Resolves the highest active tier whose threshold is met. Returns null when
 * no tier qualifies.
 */
export function resolveMembershipTier(
  qualifyingCount: number,
  tiers: MembershipTierLike[],
): MembershipTierLike | null {
  const eligible = tiers
    .filter((t) => t.isActive && qualifyingCount >= t.minQualifying)
    .sort((a, b) => b.minQualifying - a.minQualifying || b.sortOrder - a.sortOrder);
  return eligible[0] ?? null;
}

/**
 * Computes the current tier, the next tier, and progress toward it. The next
 * tier is the lowest active threshold strictly above the current count, so a
 * customer already above every threshold has no next tier.
 */
export function computeMembershipProgress(
  qualifyingCount: number,
  tiers: MembershipTierLike[],
): MembershipProgress {
  const active = tiers
    .filter((t) => t.isActive)
    .sort((a, b) => a.minQualifying - b.minQualifying || a.sortOrder - b.sortOrder);
  const tier = resolveMembershipTier(qualifyingCount, tiers);
  const nextTier = active.find((t) => t.minQualifying > qualifyingCount) ?? null;

  if (!nextTier) {
    return { tier, nextTier: null, qualifyingCount, toNext: null, percent: 100 };
  }
  const floor = tier?.minQualifying ?? 0;
  const span = Math.max(1, nextTier.minQualifying - floor);
  const done = Math.max(0, qualifyingCount - floor);
  const percent = Math.min(100, Math.round((done / span) * 100));
  return {
    tier,
    nextTier,
    qualifyingCount,
    toNext: Math.max(0, nextTier.minQualifying - qualifyingCount),
    percent,
  };
}
