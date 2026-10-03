'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CommandPalette, type CommandNavItem } from './CommandPalette';

interface ShellContextValue {
  openNav: () => void;
  closeNav: () => void;
  navOpen: boolean;
  openCommand: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useAdminShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useAdminShell must be used within AdminShell');
  return ctx;
}

export function AdminShell({
  children,
  navItems,
  labels,
}: {
  children: React.ReactNode;
  navItems: CommandNavItem[];
  labels: {
    title: string;
    hint: string;
    placeholder: string;
    noResults: string;
    sections: string;
    records: string;
    searchPath: string;
  };
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = usePathname();

  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const openCommand = useCallback(() => setCommandOpen(true), []);

  useEffect(() => {
    setNavOpen(false);
    setCommandOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
        setNavOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ShellContext.Provider value={{ openNav, closeNav, navOpen, openCommand }}>
      {children}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        navItems={navItems}
        labels={labels}
      />
    </ShellContext.Provider>
  );
}
