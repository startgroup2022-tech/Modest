import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** Sortable columns map to a server sort key. */
  sortKey?: string;
  align?: 'start' | 'end';
  width?: string;
  render: (row: T) => ReactNode;
  /** Label shown in the mobile card fallback. Defaults to header. */
  mobileLabel?: string;
}

function buildSortHref(
  pathname: string,
  query: Record<string, string | undefined> | undefined,
  sortKey: string,
  dir: 'asc' | 'desc',
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v) next.set(k, v);
  }
  next.set('sort', `${sortKey}:${dir}`);
  next.delete('page');
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Dense, sortable admin data table. Columns are declarative so every module
 * renders consistent rows, and the whole table degrades to labelled cards on
 * small screens (see `.adm-table-responsive`).
 *
 * Server-rendered: sorting is expressed as links so the table needs no client
 * JavaScript and stays streamable.
 */
export function AdminTable<T extends { id: string }>({
  rows,
  columns,
  hrefFor,
  sort,
  empty,
  rowKey,
  pathname,
  query,
}: {
  rows: T[];
  columns: Column<T>[];
  hrefFor?: (row: T) => string;
  sort?: string | null;
  empty: ReactNode;
  rowKey?: (row: T) => string;
  /** Admin list path, used to build sort links. */
  pathname?: string;
  /** Current search params, preserved when a sort link is followed. */
  query?: Record<string, string | undefined>;
}) {
  if (rows.length === 0) return <>{empty}</>;

  const currentSort = sort ?? '';
  const [activeKey, activeDir] = currentSort.split(':');

  return (
    <div className="overflow-x-auto">
      <table className="adm-table adm-table-responsive">
        <thead>
          <tr>
            {columns.map((c) => {
              const active = activeKey === c.sortKey;
              const nextDir: 'asc' | 'desc' = active && activeDir !== 'desc' ? 'desc' : 'asc';
              const sortable = Boolean(c.sortKey && pathname);
              return (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(c.align === 'end' && 'text-end')}
                  aria-sort={active ? (activeDir === 'desc' ? 'descending' : 'ascending') : undefined}
                >
                  {sortable ? (
                    <Link
                      href={buildSortHref(pathname!, query, c.sortKey!, nextDir)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {c.header}
                      <span aria-hidden className={cn('text-[0.5rem]', active ? 'text-ink' : 'text-ink-faint/60')}>
                        {active && activeDir === 'desc' ? '▼' : '▲'}
                      </span>
                    </Link>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = hrefFor?.(row);
            return (
              <tr key={rowKey ? rowKey(row) : row.id} className={href ? 'cursor-pointer' : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} data-label={c.mobileLabel ?? c.header} className={cn(c.align === 'end' && 'text-end')}>
                    {href && i === 0 ? (
                      <Link href={href} className="block focus-visible:outline-none">
                        {c.render(row)}
                      </Link>
                    ) : (
                      c.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
