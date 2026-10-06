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
