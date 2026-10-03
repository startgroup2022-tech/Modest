'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

/**
 * URL-driven filter controls. Every list in the admin shares these so filtering
 * is always shareable, back-button friendly and server-rendered.
 */

function useParamSync() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      next.delete('page');
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  return { setParams, params, pending };
}

export function SearchFilter({ placeholder, className }: { placeholder: string; className?: string }) {
  const { setParams, params } = useParamSync();
  const [value, setValue] = useState(params.get('q') ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setParams({ q: value });
      }}
      className={cn('relative', className)}
      role="search"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="adm-input ps-9"
      />
    </form>
  );
}

export function SelectFilter({
  name,
  label,
  value,
  options,
  className,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { setParams } = useParamSync();
  return (
    <label className={cn('block', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => setParams({ [name]: e.target.value })}
        aria-label={label}
        className="adm-select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateRangeFilter({
  range,
  from,
  to,
  options,
  labels,
}: {
  range: string;
  from?: string;
  to?: string;
  options: { value: string; label: string }[];
  labels: { from: string; to: string; custom: string };
}) {
  const { setParams } = useParamSync();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={range}
        onChange={(e) => setParams({ range: e.target.value, from: null, to: null })}
        className="adm-select w-auto"
        aria-label={labels.custom}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {range === 'custom' && (
        <>
          <input
            type="date"
            defaultValue={from}
            onChange={(e) => setParams({ from: e.target.value })}
            className="adm-input w-auto"
            aria-label={labels.from}
          />
          <input
            type="date"
            defaultValue={to}
            onChange={(e) => setParams({ to: e.target.value })}
            className="adm-input w-auto"
            aria-label={labels.to}
          />
        </>
      )}
    </div>
  );
}

export function ClearFilters({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button onClick={() => router.push(pathname)} className="adm-btn-ghost adm-btn-sm">
      {label}
    </button>
  );
}

/** Compact period selector for dashboard + reports. Locale derived from path. */
export function RangeFilter() {
  const { setParams, params } = useParamSync();
  const pathname = usePathname();
  const isAr = pathname.includes('/ar/');
  const range = params.get('range') ?? 'last30';
  const options = [
    { value: 'today', label: isAr ? 'اليوم' : 'Today' },
    { value: 'yesterday', label: isAr ? 'أمس' : 'Yesterday' },
    { value: 'last7', label: isAr ? 'آخر 7 أيام' : 'Last 7 days' },
    { value: 'last30', label: isAr ? 'آخر 30 يومًا' : 'Last 30 days' },
    { value: 'thisMonth', label: isAr ? 'هذا الشهر' : 'This month' },
    { value: 'lastMonth', label: isAr ? 'الشهر الماضي' : 'Last month' },
    { value: 'all', label: isAr ? 'الكل' : 'All time' },
  ];
  return (
    <select
      value={range}
      onChange={(e) => setParams({ range: e.target.value })}
      className="adm-select w-auto"
      aria-label={isAr ? 'الفترة' : 'Period'}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ── Action button: posts to an admin API then refreshes ─── */

export function ActionButton({
  endpoint,
  method = 'POST',
  body,
  children,
  variant = 'outline',
  confirm,
  className,
  disabled,
  successMessage,
}: {
  endpoint: string;
  method?: 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  confirm?: string;
  className?: string;
  disabled?: boolean;
  successMessage?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Action failed');
        setBusy(false);
        return;
      }
      if (successMessage) window.dispatchEvent(new CustomEvent('att:toast', { detail: successMessage }));
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const cls = {
    primary: 'adm-btn-primary',
    outline: 'adm-btn-outline',
    ghost: 'adm-btn-ghost',
    danger: 'adm-btn-danger',
  }[variant];

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={busy || disabled} className={cn(cls, className)}>
        {busy ? '…' : children}
      </button>
      {error && <span className="text-caption text-danger">{error}</span>}
    </span>
  );
}

/* ── Drawer / modal ──────────────────────────────────────── */

export function Drawer({
  trigger,
  title,
  children,
  wide,
}: {
  trigger: string;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="adm-btn-outline">
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-[160] flex justify-end">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              'relative flex h-full w-full flex-col border-s border-line bg-paper shadow-2xl',
              wide ? 'max-w-2xl' : 'max-w-md',
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="adm-title">{title}</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 text-ink-muted hover:text-ink" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div className="adm-scroll flex-1 overflow-y-auto p-5">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Form: posts JSON to an admin API ────────────────────── */

export function JsonForm({
  endpoint,
  method = 'POST',
  fields,
  submitLabel,
  onDoneRedirect,
  children,
}: {
  endpoint: string;
  method?: 'POST' | 'PATCH';
  fields: Record<string, unknown>;
  submitLabel: string;
  onDoneRedirect?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setBusy(false);
        return;
      }
      setDone(true);
      if (onDoneRedirect) router.push(onDoneRedirect);
      else router.refresh();
    } catch {
      setError('Network error');
      setBusy(false);
    }
  }

  if (done && !onDoneRedirect) return <p className="text-small text-success">Saved.</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {children}
      {error && <p className="text-caption text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="adm-btn-primary">
        {busy ? '…' : submitLabel}
      </button>
    </form>
  );
}
