'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Logo } from './BrandMark';
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from '@/components/ui/icons';
import { useStore } from '@/components/providers/StoreProvider';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

interface NavItem {
  label: string;
  path: string;
}

export function Header({
  locale,
  dict,
  categories,
  collections,
  logoUrl,
}: {
  locale: Locale;
  dict: Dict;
  categories: { slug: string; name: string }[];
  collections: { slug: string; name: string }[];
  logoUrl?: string | null;
}) {
  const { cart, wishlist, setCartOpen, setSearchOpen } = useStore();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const p = (path: string) => `/${locale}${path ? `/${path.replace(/^\//, '')}` : ''}`;

  const primary: NavItem[] = [
    { label: dict.nav.shop, path: p('shop') },
    { label: dict.nav.newArrivals, path: p('shop?sort=newest') },
    { label: dict.nav.collections, path: p('collections') },
    { label: dict.nav.readyToWear, path: p('shop?kind=ready') },
    { label: dict.nav.madeToOrder, path: p('collections/made-to-order') },
    { label: dict.nav.about, path: p('about') },
    { label: dict.nav.sizeGuide, path: p('size-guide') },
  ];

  // Desktop balances the bar around a centred wordmark: the first three links
  // sit on one side, the remaining links plus the utility icons on the other.
  const navLeft = primary.slice(0, 3);
  const navRight = primary.slice(3);

  return (
    <>
      <header
        className={clsx(
          'sticky top-0 z-50 w-full border-b transition-colors duration-300',
          scrolled ? 'border-line bg-paper/95 backdrop-blur-sm' : 'border-transparent bg-paper',
        )}
      >
        <div className="shell relative flex h-[var(--header-h)] items-center justify-between gap-4">
          {/* Mobile: menu */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={dict.util.menu}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          {/* Logo — centred on mobile; absolutely centred on desktop so the two
              nav groups can balance around it. */}
          <div className="flex flex-1 justify-center lg:absolute lg:start-1/2 lg:top-1/2 lg:flex-none lg:-translate-x-1/2 lg:-translate-y-1/2 rtl:lg:translate-x-1/2">
            <Logo href={p('')} logoUrl={logoUrl} />
          </div>

          {/* Desktop: left nav + utilities (start side) */}
          <div className="hidden flex-1 items-center gap-7 lg:flex">
            <nav aria-label="Primary" className="flex items-center gap-7">
              {navLeft.map((item) => (
                <Link
                  key={item.label}
                  href={item.path}
                  className="link-underline text-nav uppercase text-ink transition-opacity hover:opacity-70"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop: right nav + utilities (end side) */}
          <div className="flex flex-1 items-center justify-end gap-7">
            <nav aria-label="Primary secondary" className="hidden items-center gap-7 lg:flex">
              {navRight.map((item) => (
                <Link
                  key={item.label}
                  href={item.path}
                  className="link-underline text-nav uppercase text-ink transition-opacity hover:opacity-70"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label={dict.util.search}
                className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-60"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
              <Link
                href={p('wishlist')}
                aria-label={dict.util.wishlist}
                className="relative hidden h-10 w-10 items-center justify-center transition-opacity hover:opacity-60 sm:flex"
              >
                <HeartIcon className="h-5 w-5" filled={wishlist.length > 0} />
                {wishlist.length > 0 ? (
                  <span className="absolute end-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-medium leading-none text-paper">
                    {wishlist.length}
                  </span>
                ) : null}
              </Link>
              <Link
                href={p('account')}
                aria-label={dict.util.account}
                className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-60"
              >
                <UserIcon className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                aria-label={`${dict.util.cart}${cart.count ? ` (${cart.count})` : ''}`}
                className="relative flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-60"
              >
                <BagIcon className="h-5 w-5" />
                {cart.count > 0 ? (
                  <span className="absolute end-0.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-medium leading-none text-paper">
                    {cart.count}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-[60] lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!menuOpen}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-ink/40 transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dict.util.menu}
          className={clsx(
            'absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col bg-paper transition-transform duration-400 ease-luxe',
            menuOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
          )}
        >
          <div className="flex h-[var(--header-h)] items-center justify-between border-b border-line px-5">
            <Logo href={p('')} logoUrl={logoUrl} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={dict.util.close}
              className="flex h-10 w-10 items-center justify-center"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="space-y-1">
              {primary.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.path}
                    className="block border-b border-line py-4 text-h4 uppercase tracking-[0.1em] text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {categories.length ? (
              <div className="mt-8">
                <p className="eyebrow mb-3">{dict.shop.categories}</p>
                <ul className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link href={p(`shop?category=${c.slug}`)} className="chip">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {collections.length ? (
              <div className="mt-8">
                <p className="eyebrow mb-3">{dict.nav.collections}</p>
                <ul className="space-y-2">
                  {collections.map((c) => (
                    <li key={c.slug}>
                      <Link href={p(`collections/${c.slug}`)} className="text-small text-ink-muted">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </nav>
          <div className="border-t border-line px-5 py-4 text-caption text-ink-muted safe-bottom">
            <Link href={p('contact')} className="link-underline">
              {dict.nav.contact}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
