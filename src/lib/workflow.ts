/**
 * Workflow state machines shared by the admin operations APIs.
 *
 * Each map lists the only legal target states for a given current state. They
 * live here (not inline in routes) so the rules are unit-testable and so that
 * "can this move happen" is answered in exactly one place per workflow.
 */

/** Expense approval lifecycle. */
export const EXPENSE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: [],
  PAID: [],
};

/** Production task lifecycle (sewing floor). */
export const PRODUCTION_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['ASSIGNED', 'PENDING', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'ASSIGNED', 'PENDING', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'REWORK', 'ASSIGNED', 'CANCELLED'],
  COMPLETED: ['REWORK'],
  REWORK: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED'],
  CANCELLED: [],
};

/** Tailor settlement lifecycle. */
export const SETTLEMENT_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

/** States in which running quality control on a production task is meaningful. */
export const QC_ALLOWED_STATES: readonly string[] = ['IN_PROGRESS', 'REWORK', 'COMPLETED'];

/** True when `to` is a legal target from `from` in the given workflow. */
export function canTransition(
  map: Record<string, readonly string[]>,
  from: string,
  to: string,
): boolean {
  return (map[from] ?? []).includes(to);
}
