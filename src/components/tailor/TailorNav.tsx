'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Tailor Portal navigation. `tailorId` is passed from the server layout (which
 * resolved the supervisor's target from the request) rather than read from the
 * query string here, so no Suspense boundary is required and a tailor never
 * carries an id in the URL.
 */
export function TailorNav({
  locale,
  tailorId,
  labels,
}: {
  locale: 'en' | 'ar';
  tailorId?: string | null;
  labels: { dashboard: string; tasks: string; settlements: string; notifications: string };
}) {
  const pathname = usePathname();
  const qs = tailorId ? `?tailorId=${encodeURIComponent(tailorId)}` : '';

  const items = [
    { href: `/${locale}/tailor`, label: labels.dashboard, exact: true },
    { href: `/${locale}/tailor/tasks`, label: labels.tasks, exact: false },
    { href: `/${locale}/tailor/settlements`, label: labels.settlements, exact: false },
    { href: `/${locale}/tailor/notifications`, label: labels.notifications, exact: false },
  ];

  return (
    <nav aria-label="Tailor portal" className="-mx-1 flex flex-wrap gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={`${item.href}${qs}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-2 text-small transition-colors',
              active ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-paper hover:text-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
