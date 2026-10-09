export interface HeaderNavItem {
  label: string;
  path: string;
}

/**
 * Split the primary navigation for the desktop header that balances items
 * around a centred wordmark: `leftCount` items on the start side (`left`) and
 * the remainder on the end side (`right`), rendered next to the utility icons.
 *
 * Order is preserved and every item appears exactly once, so no navigation
 * destination is ever dropped when the layout changes.
 */
export function splitCenteredNav<T>(items: readonly T[], leftCount = 3): { left: T[]; right: T[] } {
  const count = Math.max(0, Math.min(leftCount, items.length));
  return { left: items.slice(0, count), right: items.slice(count) };
}
