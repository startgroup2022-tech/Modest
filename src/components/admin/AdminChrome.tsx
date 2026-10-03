'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAdminShell } from './AdminShell';
import type { CommandNavItem } from './CommandPalette';

export interface ChromeNavItem {
  path: string;
  key: string;
  label: string;
  href: string;
  badge?: number;
}
export interface ChromeNavGroup {
  key: string;
  label: string;
  items: ChromeNavItem[];
}

export interface ChromeLabels {
  name: string;
  suffix: string;
  signedInAs: string;
  signOut: string;
  viewStore: string;
  search: string;
  settings: string;
  closeMenu: string;
  language: string;
}

function useActivePath(adminRoot: string) {
  const pathname = usePathname();
  return (href: string) => {
    if (href === adminRoot) return pathname === adminRoot || pathname === `${adminRoot}/`;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

export function Sidebar({
  adminRoot,
  groups,
  labels,
  mobile = false,
}: {
  adminRoot: string;
  groups: ChromeNavGroup[];
  labels: ChromeLabels;
  mobile?: boolean;
}) {
  const isActive = useActivePath(adminRoot);
  const { closeNav } = useAdminShell();

  return (
    <nav className="flex h-full flex-col" aria-label={labels.name}>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-5">
        <Link href={adminRoot} className="flex items-baseline gap-1.5" onClick={mobile ? closeNav : undefined}>
          <span className="text-[1.0625rem] font-medium tracking-[0.14em] text-ink">{labels.name.toUpperCase()}</span>
          <span className="text-[0.625rem] uppercase tracking-[0.18em] text-ink-faint">{labels.suffix}</span>
        </Link>
        {mobile && (
          <button onClick={closeNav} className="ms-auto p-2 text-ink-muted hover:text-ink" aria-label={labels.closeMenu}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="adm-scroll flex-1 overflow-y-auto py-3">
        {groups.map((g) => (
          <div key={g.key} className="mb-4">
            <p className="px-5 pb-1.5 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
              {g.label}
            </p>
            <ul>
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.path || 'dashboard'}>
                    <Link
                      href={item.href}
                      onClick={mobile ? closeNav : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn('adm-nav-item', active && 'adm-nav-item-active')}
                    >
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="adm-num min-w-[1.25rem] rounded-full bg-ink px-1.5 py-0.5 text-center text-[0.5625rem] font-medium text-paper">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function Topbar({
  user,
  labels,
  locale,
  storeUrl,
  signOutUrl,
  settingsUrl,
}: {
  user: { name: string; email: string; role: string };
  labels: ChromeLabels;
  locale: string;
  storeUrl: string;
  signOutUrl: string;
  settingsUrl: string;
}) {
  const { openNav, openCommand } = useAdminShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  const pathname = usePathname();
  const altPath = pathname.replace(`/${locale}/`, `/${otherLocale}/`);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-6">
      <button onClick={openNav} className="p-2 text-ink lg:hidden" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <button
        onClick={openCommand}
        className="flex h-9 flex-1 items-center gap-2.5 border border-line px-3 text-start text-small text-ink-faint transition-colors hover:border-ink sm:max-w-md"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="flex-1 truncate">{labels.search}</span>
        <kbd className="hidden border border-line px-1.5 py-0.5 text-[0.625rem] sm:block">⌘K</kbd>
      </button>

      <div className="ms-auto flex items-center gap-1">
        <Link
          href={storeUrl}
          className="hidden px-3 py-2 text-[0.6875rem] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink md:block"
        >
          {labels.viewStore}
        </Link>
        <Link
          href={altPath}
          className="px-3 py-2 text-[0.6875rem] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
          aria-label={labels.language}
        >
          {otherLocale === 'ar' ? 'العربية' : 'EN'}
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 text-start"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center border border-line bg-sand-50 text-[0.6875rem] font-medium uppercase text-ink">
              {user.name.slice(0, 1)}
            </span>
            <span className="hidden text-[0.6875rem] leading-tight lg:block">
              <span className="block font-medium text-ink">{user.name}</span>
              <span className="block text-ink-faint">{user.role}</span>
            </span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute end-0 z-20 mt-2 w-60 border border-line bg-paper py-1 shadow-xl">
                <div className="border-b border-line px-4 py-3">
                  <p className="text-caption text-ink-faint">{labels.signedInAs}</p>
                  <p className="truncate text-small text-ink">{user.email}</p>
                </div>
                <Link
                  href={settingsUrl}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-small text-ink-muted hover:bg-sand-50 hover:text-ink"
                >
                  {labels.settings}
                </Link>
                <form action={signOutUrl} method="post">
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 text-start text-small text-danger hover:bg-sand-50"
                  >
                    {labels.signOut}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNavDrawer({
  adminRoot,
  groups,
  labels,
}: {
  adminRoot: string;
  groups: ChromeNavGroup[];
  labels: ChromeLabels;
}) {
  const { navOpen, closeNav } = useAdminShell();
  if (!navOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] lg:hidden">
      <div className="absolute inset-0 bg-ink/40" onClick={closeNav} aria-hidden />
      <div className="absolute inset-y-0 start-0 w-[84%] max-w-xs animate-fade-in border-e border-line bg-paper">
        <Sidebar adminRoot={adminRoot} groups={groups} labels={labels} mobile />
      </div>
    </div>
  );
}
