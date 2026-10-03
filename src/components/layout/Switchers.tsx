'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import { GlobeIcon } from '@/components/ui/icons';
import { useStore } from '@/components/providers/StoreProvider';
import type { Locale } from '@/i18n/config';

interface CurrencyOption {
  code: string;
  label: string;
}

export function CurrencySwitcher({
  currencies,
  label,
}: {
  currencies: CurrencyOption[];
  label: string;
}) {
  const { currency, setCurrency } = useStore();
  const [open, setOpen] = useState(false);
  const current = currencies.find((c) => c.code === currency) ?? currencies[0];
  if (!current) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex items-center gap-1.5 text-caption uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        {current.code}
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute bottom-full end-0 z-50 mb-2 min-w-[8rem] border border-line bg-paper py-1 shadow-sm"
        >
          {currencies.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={c.code === currency}
                onClick={() => {
                  setOpen(false);
                  if (c.code !== currency) void setCurrency(c.code);
                }}
                className={clsx(
                  'block w-full px-4 py-2 text-start text-caption uppercase tracking-[0.1em] transition-colors hover:bg-sand-50',
                  c.code === currency ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const other: Locale = locale === 'en' ? 'ar' : 'en';

  const switchLocale = () => {
    const path = window.location.pathname;
    const search = window.location.search;
    const next = path.replace(/^\/(en|ar)(?=\/|$)/, `/${other}`);
    document.cookie = `att_locale=${other}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(`${next === path ? `/${other}${path}` : next}${search}`);
  };

  return (
    <button
      type="button"
      onClick={switchLocale}
      aria-label={label}
      className="text-caption uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
    >
      {other === 'ar' ? 'العربية' : 'EN'}
    </button>
  );
}
