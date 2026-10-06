/**
 * "Late" is a computed condition, never a workflow state (pure).
 *
 * An order or piece is late when its expected date has passed and it is still
 * open. Nothing in the database stores a LATE status, so a late item can never
 * be "stuck" in a pseudo-state.
 */

/** Order statuses that are considered closed; a closed order is never late. */
export const CLOSED_ORDER_STATUSES: readonly string[] = ['DELIVERED', 'CANCELLED', 'REFUNDED'];

export interface LatenessInput {
  expectedDeliveryAt: Date | string | number | null | undefined;
  status: string;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export interface LatenessResult {
  late: boolean;
  /** Whole days past the expected date (0 when not late). */
  daysLate: number;
}

export function isLate(input: LatenessInput): LatenessResult {
  if (!input.expectedDeliveryAt) return { late: false, daysLate: 0 };
  if (CLOSED_ORDER_STATUSES.includes(input.status)) return { late: false, daysLate: 0 };

  const expected = new Date(input.expectedDeliveryAt);
  if (Number.isNaN(expected.getTime())) return { late: false, daysLate: 0 };

  const now = input.now ?? new Date();
  if (now.getTime() <= expected.getTime()) return { late: false, daysLate: 0 };

  const days = Math.floor((now.getTime() - expected.getTime()) / 86_400_000);
  return { late: true, daysLate: days };
}
