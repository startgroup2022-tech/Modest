'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function AccountNav({ locale, dict }: { locale: Locale; dict: Dict }) {
  const pathname = usePathname();
  const base = `/${locale}/account`;
  const items = [
    { href: base, label: dict.account.overview },
    { href: `${base}/orders`, label: dict.account.orders },
    { href: `${base}/wishlist`, label: dict.account.wishlist },
    { href: `${base}/addresses`, label: dict.account.addresses },
    { href: `${base}/measurements`, label: dict.account.measurements },
    { href: `${base}/notifications`, label: dict.account.notifications },
    { href: `${base}/profile`, label: dict.account.profile },
    { href: `${base}/settings`, label: dict.account.settings },
  ];

  return (
    <nav aria-label={dict.account.title} className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'block whitespace-nowrap px-3 py-2.5 text-small transition-colors lg:whitespace-normal',
                  active ? 'text-ink underline decoration-1 underline-offset-4' : 'text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
