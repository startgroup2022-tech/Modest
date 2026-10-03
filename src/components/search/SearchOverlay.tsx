'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useStore } from '@/components/providers/StoreProvider';
import { Price } from '@/components/ui/Price';
import { CloseIcon, SearchIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

interface SearchProduct {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  priceBhd: number;
  image: string | null;
}

interface SearchResponse {
  products: SearchProduct[];
  categories: { slug: string; nameEn: string; nameAr: string }[];
  collections: { slug: string; nameEn: string; nameAr: string }[];
  total: number;
}

const EMPTY: SearchResponse = { products: [], categories: [], collections: [], total: 0 };

export function SearchOverlay({ locale, dict }: { locale: Locale; dict: Dict }) {
  const { searchOpen, setSearchOpen } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const p = (path: string) => `/${locale}${path ? `/${path.replace(/^\//, '')}` : ''}`;

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setResults((await res.json()) as SearchResponse);
          setTouched(true);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, searchOpen, locale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchOpen(false);
    router.push(p(`search?q=${encodeURIComponent(query.trim())}`));
  };

  const showEmpty = touched && !loading && query.trim().length >= 2 && results.products.length === 0 && results.categories.length === 0;

  return (
    <div
      className={clsx('fixed inset-0 z-[80]', searchOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden={!searchOpen}
    >
      <div
        className={clsx('absolute inset-0 bg-ink/50 transition-opacity duration-300', searchOpen ? 'opacity-100' : 'opacity-0')}
        onClick={() => setSearchOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dict.util.search}
        className={clsx(
          'absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto bg-paper transition-transform duration-400 ease-luxe',
          searchOpen ? 'translate-y-0' : '-translate-y-full',
        )}
      >
        <div className="shell py-5">
          <form onSubmit={submit} className="flex items-center gap-3 border-b border-line pb-4">
            <SearchIcon className="h-5 w-5 text-ink-muted" />
            <label htmlFor="search-input" className="sr-only">
              {dict.util.search}
            </label>
            <input
              id="search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTouched(false);
              }}
              placeholder={dict.util.search}
              autoComplete="off"
              className="w-full bg-transparent text-h4 text-ink outline-none placeholder:text-ink-faint"
            />
            {loading ? <Spinner className="text-ink-muted" /> : null}
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label={dict.util.close}
              className="flex h-9 w-9 shrink-0 items-center justify-center"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </form>

          {query.trim().length < 2 ? (
            <div className="py-8">
              <p className="eyebrow mb-3">{dict.shop.categories}</p>
              <ul className="flex flex-wrap gap-2">
                {['ss25', 'fw25', 'ec26', 'essn'].map((slug) => (
                  <li key={slug}>
                    <Link href={p(`shop?category=${slug}`)} onClick={() => setSearchOpen(false)} className="chip">
                      {slug.toUpperCase()}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {results.categories.length > 0 || results.collections.length > 0 ? (
            <div className="flex flex-wrap gap-2 py-5">
              {results.categories.map((c) => (
                <Link
                  key={c.slug}
                  href={p(`shop?category=${c.slug}`)}
                  onClick={() => setSearchOpen(false)}
                  className="chip"
                >
                  {locale === 'ar' ? c.nameAr : c.nameEn}
                </Link>
              ))}
              {results.collections.map((c) => (
                <Link
                  key={c.slug}
                  href={p(`collections/${c.slug}`)}
                  onClick={() => setSearchOpen(false)}
                  className="chip"
                >
                  {locale === 'ar' ? c.nameAr : c.nameEn}
                </Link>
              ))}
            </div>
          ) : null}

          {results.products.length > 0 ? (
            <ul className="divide-y divide-line">
              {results.products.map((prod) => (
                <li key={prod.id}>
                  <Link
                    href={p(`product/${prod.slug}`)}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center gap-4 py-4"
                  >
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-sand-50">
                      {prod.image ? (
                        <Image src={prod.image} alt={locale === 'ar' ? prod.nameAr : prod.nameEn} fill sizes="64px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className="text-small text-ink">{locale === 'ar' ? prod.nameAr : prod.nameEn}</p>
                      <Price amountBhd={prod.priceBhd} locale={locale} className="mt-1 text-caption text-ink-muted" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {showEmpty ? (
            <div className="py-10 text-center">
              <p className="text-h4">{dict.shop.noResults}</p>
              <p className="mt-2 text-small text-ink-muted">{dict.shop.noResultsBody}</p>
              <Link href={p('shop')} onClick={() => setSearchOpen(false)} className="btn-outline mt-6">
                {dict.shop.allCategories}
              </Link>
            </div>
          ) : null}

          {results.products.length > 0 && results.total > results.products.length ? (
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                router.push(p(`search?q=${encodeURIComponent(query.trim())}`));
              }}
              className="btn-outline btn-block mt-4"
            >
              {dict.shop.showing} {results.products.length} {dict.shop.of} {results.total}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
