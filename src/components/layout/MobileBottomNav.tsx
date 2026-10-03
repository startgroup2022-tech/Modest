'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { BagIcon, GridIcon, HeartIcon, HomeIcon, SearchIcon, UserIcon } from '@/components/ui/icons';
import { useStore } from '@/components/providers/StoreProvider';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

/**
 * Thumb-reachable bottom navigation for small screens. Mirrors the five
 * primary destinations; hidden from md upward where the header carries them.
 */
export function MobileBottomNav({ locale, dict }: { locale: Locale; dict: Dict }) {
  const pathname = usePathname();
  const { cart, wishlist, setCartOpen, setSearchOpen } = useStore();
  const p = (path: string) => `/${locale}${path ? `/${path.replace(/^\//, '')}` : ''}`;

  const items = [
    { key: 'home', label: dict.nav.home, href: p(''), icon: HomeIcon },
    { key: 'shop', label: dict.nav.shop, href: p('shop'), icon: GridIcon },
    { key: 'search', label: dict.util.search, action: () => setSearchOpen(true), icon: SearchIcon },
    { key: 'wishlist', label: dict.util.wishlist, href: p('wishlist'), icon: HeartIcon, badge: wishlist.length },
    { key: 'account', label: dict.util.account, href: p('account'), icon: UserIcon },
  ] as const;

  const isActive = (href: string) =>
    href === p('') ? pathname === p('') : pathname.startsWith(href);

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/97 backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = 'href' in item ? isActive(item.href) : false;
          const content = (
            <>
              <span className="relative">
                <item.icon className="h-[20px] w-[20px]" filled={item.key === 'wishlist' && wishlist.length > 0} />
                {'badge' in item && item.badge ? (
                  <span className="absolute -end-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-ink px-0.5 text-[8px] font-medium leading-none text-paper">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className={clsx('text-[10px] tracking-[0.08em]', active ? 'text-ink' : 'text-ink-muted')}>
                {item.label}
              </span>
            </>
          );
          return (
            <li key={item.key}>
              {'href' in item ? (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                    active ? 'text-ink' : 'text-ink-muted',
                  )}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.action}
                  className="flex w-full flex-col items-center justify-center gap-1 py-2.5 text-ink-muted transition-colors"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="safe-bottom" />
      {/* Floating bag button — always within thumb reach */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        aria-label={`${dict.util.cart}${cart.count ? ` (${cart.count})` : ''}`}
        className="absolute -top-14 end-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper shadow-lg"
      >
        <BagIcon className="h-5 w-5" />
        {cart.count > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-sand-500 px-1 text-[9px] font-semibold leading-none text-ink">
            {cart.count}
          </span>
        ) : null}
      </button>
    </nav>
  );
}
