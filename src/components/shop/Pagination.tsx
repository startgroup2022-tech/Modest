'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (totalPages <= 1) return null;

  const hrefFor = (n: number) => {
    const next = new URLSearchParams(params.toString());
    next.set('page', String(n));
    return `${pathname}?${next.toString()}`;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1,
  );

  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={clsx(
          'flex h-10 w-10 items-center justify-center border border-line transition-colors',
          page === 1 ? 'pointer-events-none opacity-40' : 'hover:border-ink',
        )}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      </Link>
      {pages.map((n, i) => {
        const gap = i > 0 && n - pages[i - 1] > 1;
        return (
          <span key={n} className="flex items-center gap-2">
            {gap ? <span className="px-1 text-ink-faint">…</span> : null}
            <Link
              href={hrefFor(n)}
              aria-current={n === page ? 'page' : undefined}
              className={clsx(
                'flex h-10 w-10 items-center justify-center border text-caption tabular-nums transition-colors',
                n === page ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink',
              )}
            >
              {n}
            </Link>
          </span>
        );
      })}
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={clsx(
          'flex h-10 w-10 items-center justify-center border border-line transition-colors',
          page === totalPages ? 'pointer-events-none opacity-40' : 'hover:border-ink',
        )}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
    </nav>
  );
}
