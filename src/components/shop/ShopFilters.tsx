'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { CloseIcon, FilterIcon } from '@/components/ui/icons';
import type { Dict } from '@/i18n/dictionaries';

interface FilterOption {
  slug: string;
  name: string;
  count: number;
}

export function ShopFilters({
  dict,
  categories,
  collections,
  bounds,
  resultCount,
}: {
  dict: Dict;
  categories: FilterOption[];
  collections: FilterOption[];
  bounds: { min: number; max: number };
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const current = {
    category: params.getAll('category'),
    collection: params.get('collection') ?? '',
    sort: params.get('sort') ?? 'newest',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
    kind: params.get('kind') ?? '',
    stock: params.get('stock') ?? '',
    q: params.get('q') ?? '',
  };

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete('page');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const toggleMulti = (key: string, value: string) =>
    update((p) => {
      const values = p.getAll(key);
      p.delete(key);
      const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
      next.forEach((v) => p.append(key, v));
    });

  const setSingle = (key: string, value: string) =>
    update((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });

  const activeCount =
    current.category.length +
    (current.collection ? 1 : 0) +
    (current.min ? 1 : 0) +
    (current.max ? 1 : 0) +
    (current.kind ? 1 : 0) +
    (current.stock ? 1 : 0) +
    (current.q ? 1 : 0);

  const clearAll = () => router.push(pathname, { scroll: false });

  const sortOptions: { value: string; label: string }[] = [
    { value: 'newest', label: dict.shop.newest },
    { value: 'featured', label: dict.shop.featured },
    { value: 'price_asc', label: dict.shop.priceLowHigh },
    { value: 'price_desc', label: dict.shop.priceHighLow },
    { value: 'oldest', label: dict.shop.oldest },
  ];

  const Checkbox = ({
    checked,
    label,
    count,
    onChange,
  }: {
    checked: boolean;
    label: string;
    count?: number;
    onChange: () => void;
  }) => (
    <label className="flex cursor-pointer items-center gap-3 text-small text-ink-muted">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
          checked ? 'border-ink bg-ink' : 'border-line-strong',
        )}
        aria-hidden="true"
      >
        {checked ? <span className="h-1.5 w-1.5 bg-paper" /> : null}
      </span>
      <span className={checked ? 'text-ink' : undefined}>{label}</span>
      {count != null ? <span className="ms-auto text-caption text-ink-faint">{count}</span> : null}
    </label>
  );

  const panel = (
    <div className="space-y-8">
      <fieldset>
        <legend className="eyebrow mb-3">{dict.search.title}</legend>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
            update((p) => {
              if (value) p.set('q', value);
              else p.delete('q');
            });
          }}
        >
          <input
            name="q"
            type="search"
            defaultValue={current.q}
            placeholder={dict.search.placeholder}
            aria-label={dict.search.title}
            className="field py-2.5"
          />
        </form>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">{dict.shop.categories}</legend>
        <ul className="space-y-2.5">
          {categories.map((c) => (
            <li key={c.slug}>
              <Checkbox
                checked={current.category.includes(c.slug)}
                label={c.name}
                count={c.count}
                onChange={() => toggleMulti('category', c.slug)}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {collections.length ? (
        <fieldset>
          <legend className="eyebrow mb-3">{dict.nav.collections}</legend>
          <ul className="space-y-2.5">
            <li>
              <button
                type="button"
                onClick={() => setSingle('collection', '')}
                className={clsx('text-small', !current.collection ? 'text-ink' : 'text-ink-muted')}
              >
                {dict.shop.allCategories}
              </button>
            </li>
            {collections.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => setSingle('collection', c.slug)}
                  className={clsx('text-small', current.collection === c.slug ? 'text-ink' : 'text-ink-muted')}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="eyebrow mb-3">{dict.shop.filters}</legend>
        <ul className="space-y-2.5">
          <li>
            <Checkbox
              checked={current.stock === 'in'}
              label={dict.product.inStock}
              onChange={() => setSingle('stock', current.stock === 'in' ? '' : 'in')}
            />
          </li>
          <li>
            <Checkbox
              checked={current.kind === 'mto'}
              label={dict.product.madeToOrderInfo}
              onChange={() => setSingle('kind', current.kind === 'mto' ? '' : 'mto')}
            />
          </li>
        </ul>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">{dict.shop.price}</legend>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const min = (form.elements.namedItem('min') as HTMLInputElement).value;
            const max = (form.elements.namedItem('max') as HTMLInputElement).value;
            update((p) => {
              if (min) p.set('min', min);
              else p.delete('min');
              if (max) p.set('max', max);
              else p.delete('max');
            });
          }}
          className="flex items-center gap-2"
        >
          <input
            name="min"
            type="number"
            inputMode="decimal"
            min={0}
            defaultValue={current.min}
            placeholder={String(Math.floor(bounds.min))}
            aria-label={`${dict.shop.price} min`}
            className="field py-2.5"
          />
          <span className="text-ink-faint">—</span>
          <input
            name="max"
            type="number"
            inputMode="decimal"
            min={0}
            defaultValue={current.max}
            placeholder={String(Math.ceil(bounds.max))}
            aria-label={`${dict.shop.price} max`}
            className="field py-2.5"
          />
          <button type="submit" className="btn-quiet shrink-0 px-4 py-2.5">
            {dict.shop.apply}
          </button>
        </form>
      </fieldset>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          className="link-underline text-caption uppercase tracking-[0.14em] text-ink-muted"
        >
          {dict.shop.clear}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block" aria-label={dict.shop.filters}>
        <div className="sticky top-28">{panel}</div>
      </aside>

      <div className="lg:hidden">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setOpen(true)} className="btn-quiet gap-2 px-5 py-3" aria-haspopup="dialog">
            <FilterIcon className="h-4 w-4" />
            {dict.shop.filters}
            {activeCount > 0 ? <span className="text-ink-muted">({activeCount})</span> : null}
          </button>
          <label className="relative flex items-center">
            <span className="sr-only">{dict.shop.sortBy}</span>
            <select
              value={current.sort}
              onChange={(e) => setSingle('sort', e.target.value)}
              className="appearance-none border border-line bg-paper py-3 ps-4 pe-9 text-caption uppercase tracking-[0.1em] text-ink"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={clsx('fixed inset-0 z-[65]', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
          <div
            className={clsx('absolute inset-0 bg-ink/40 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dict.shop.filters}
            className={clsx(
              'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-paper transition-transform duration-400 ease-luxe',
              open ? 'translate-y-0' : 'translate-y-full',
            )}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper px-5 py-4">
              <h2 className="text-h4 uppercase tracking-[0.12em]">{dict.shop.filters}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.util.close}
                className="flex h-9 w-9 items-center justify-center"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-6">{panel}</div>
            <div className="sticky bottom-0 border-t border-line bg-paper px-5 py-4 safe-bottom">
              <button type="button" onClick={() => setOpen(false)} className="btn-primary btn-block">
                {dict.shop.apply} · {resultCount}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SortSelect({ dict }: { dict: Dict }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get('sort') ?? 'newest';
  return (
    <label className="relative hidden items-center lg:flex">
      <span className="sr-only">{dict.shop.sortBy}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('sort', e.target.value);
          next.delete('page');
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className="appearance-none border border-line bg-paper py-3 ps-4 pe-9 text-caption uppercase tracking-[0.1em] text-ink"
      >
        <option value="newest">{dict.shop.newest}</option>
        <option value="featured">{dict.shop.featured}</option>
        <option value="price_asc">{dict.shop.priceLowHigh}</option>
        <option value="price_desc">{dict.shop.priceHighLow}</option>
        <option value="oldest">{dict.shop.oldest}</option>
      </select>
    </label>
  );
}
