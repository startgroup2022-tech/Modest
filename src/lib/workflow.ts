/**
 * Workflow state machines shared by the admin operations APIs.
 *
 * Each map lists the only legal target states for a given current state. They
 * live here (not inline in routes) so the rules are unit-testable and so that
 * "can this move happen" is answered in exactly one place per workflow.
 */

/** Expense approval lifecycle. A rejected expense may be corrected and
 * resubmitted, so REJECTED is not terminal. */
export const EXPENSE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: ['DRAFT'],
  PAID: [],
};

/**
 * Production task lifecycle (sewing floor), including tailor acceptance and
 * submission for QC. Acceptance is explicit: ASSIGNED is not enough to begin.
 */
export const PRODUCTION_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['ASSIGNED', 'PENDING', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'ASSIGNED', 'PENDING', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED'],
  IN_PROGRESS: ['SUBMITTED_FOR_QC', 'COMPLETED', 'REWORK', 'ASSIGNED', 'CANCELLED'],
  SUBMITTED_FOR_QC: ['COMPLETED', 'REWORK', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['REWORK'],
  REWORK: ['IN_PROGRESS', 'SUBMITTED_FOR_QC', 'ASSIGNED', 'CANCELLED'],
  CANCELLED: [],
};

/**
 * Tailor settlement lifecycle.
 *
 * Payout may not skip the transfer step: the only path to PAID is through
 * TRANSFERRED, which itself requires a recorded transfer proof. The chain is
 * APPROVED → TRANSFERRED → PAID → CONFIRMED.
 */
export const SETTLEMENT_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['TRANSFERRED', 'CANCELLED'],
  TRANSFERRED: ['PAID', 'CANCELLED'],
  PAID: ['CONFIRMED'],
  CONFIRMED: [],
  CANCELLED: [],
};

/** States in which running quality control on a production task is meaningful. */
export const QC_ALLOWED_STATES: readonly string[] = [
  'IN_PROGRESS',
  'SUBMITTED_FOR_QC',
  'REWORK',
  'COMPLETED',
];

/** True when `to` is a legal target from `from` in the given workflow. */
export function canTransition(
  map: Record<string, readonly string[]>,
  from: string,
  to: string,
): boolean {
  return (map[from] ?? []).includes(to);
}
