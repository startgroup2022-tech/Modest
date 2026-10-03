'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CommandNavItem {
  label: string;
  href: string;
  group: string;
}

interface SearchResults {
  orders: { id: string; label: string; sub: string; href: string }[];
  customers: { id: string; label: string; sub: string; href: string }[];
  products: { id: string; label: string; sub: string; href: string }[];
}

const EMPTY: SearchResults = { orders: [], customers: [], products: [] };

export function CommandPalette({
  open,
  onClose,
  navItems,
  labels,
}: {
  open: boolean;
  onClose: () => void;
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
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(EMPTY);
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Debounced live search against real records.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`${labels.searchPath}?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) setResults((await res.json()) as SearchResults);
      } catch {
        /* aborted or offline — leave previous results */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open, labels.searchPath]);

  const matchedNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems.slice(0, 8);
    return navItems.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6);
  }, [navItems, query]);

  const flat = useMemo(() => {
    const items: { href: string }[] = [];
    for (const n of matchedNav) items.push({ href: n.href });
    for (const r of results.orders) items.push({ href: r.href });
    for (const r of results.customers) items.push({ href: r.href });
    for (const r of results.products) items.push({ href: r.href });
    return items;
  }, [matchedNav, results]);

  useEffect(() => setActive(0), [query, results]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flat[active];
      if (target) go(target.href);
    }
  }

  let idx = -1;
  const nextIdx = () => ++idx;
  const hasRecords = results.orders.length + results.customers.length + results.products.length > 0;
  const showEmpty = query.trim().length >= 2 && !loading && !hasRecords && matchedNav.length === 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-ink/40 px-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <div
        className="w-full max-w-2xl animate-fade-up border border-line bg-paper shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-faint" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={labels.placeholder}
            className="h-14 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            aria-label={labels.placeholder}
          />
          <kbd className="hidden border border-line px-1.5 py-0.5 text-[0.625rem] text-ink-faint sm:block">ESC</kbd>
        </div>

        <div className="adm-scroll max-h-[60vh] overflow-y-auto">
          {matchedNav.length > 0 && (
            <div className="px-2 py-2">
              <p className="px-3 py-1.5 adm-label">{labels.sections}</p>
              {matchedNav.map((n) => {
                const i = nextIdx();
                return (
                  <button
                    key={n.href}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(n.href)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-start text-small transition-colors ${
                      active === i ? 'bg-sand-100 text-ink' : 'text-ink-muted hover:bg-sand-50'
                    }`}
                  >
                    <span>{n.label}</span>
                    <span className="adm-label">{n.group}</span>
                  </button>
                );
              })}
            </div>
          )}

          {hasRecords && (
            <div className="border-t border-line px-2 py-2">
              <p className="px-3 py-1.5 adm-label">{labels.records}</p>
              {[
                { key: 'orders', rows: results.orders },
                { key: 'customers', rows: results.customers },
                { key: 'products', rows: results.products },
              ].map(({ key, rows }) =>
                rows.map((r) => {
                  const i = nextIdx();
                  return (
                    <button
                      key={`${key}-${r.id}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.href)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-small transition-colors ${
                        active === i ? 'bg-sand-100 text-ink' : 'text-ink-muted hover:bg-sand-50'
                      }`}
                    >
                      <span className="truncate font-medium text-ink">{r.label}</span>
                      <span className="shrink-0 truncate text-caption text-ink-faint">{r.sub}</span>
                    </button>
                  );
                }),
              )}
            </div>
          )}

          {showEmpty && <p className="px-5 py-10 text-center text-small text-ink-muted">{labels.noResults}</p>}
          {!query && <p className="px-5 py-4 text-center text-caption text-ink-faint">{labels.hint}</p>}
        </div>
      </div>
    </div>
  );
}
