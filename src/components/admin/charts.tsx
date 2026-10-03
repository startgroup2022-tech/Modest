'use client';

import { useMemo, useState } from 'react';

/**
 * Lightweight dependency-free charts. Deliberately restrained to match the
 * editorial design language — hairline axes, no gradients or drop shadows.
 */

export interface SeriesPoint {
  label: string;
  value: number;
}

/** Client-safe BHD formatter (the server-only money helper cannot cross the boundary). */
function formatBhdClient(value: number, locale: 'en' | 'ar'): string {
  const formatted = value.toLocaleString(locale === 'ar' ? 'ar-BH' : 'en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    numberingSystem: 'latn',
  });
  return `${locale === 'ar' ? 'د.ب' : 'BHD'} ${formatted}`;
}

export function BarSeries({
  data,
  locale = 'en',
  height = 180,
  ariaLabel,
}: {
  data: SeriesPoint[];
  locale?: 'en' | 'ar';
  height?: number;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);

  if (!data.length) return null;

  return (
    <figure className="w-full">
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              className="group relative flex flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap border border-line bg-ink px-2.5 py-1.5 text-[0.625rem] text-paper rtl:translate-x-1/2">
                  <span className="block text-ink-faint">{d.label}</span>
                  <span className="adm-num block font-medium">{formatBhdClient(d.value, locale)}</span>
                </div>
              )}
              <div
                className={`w-full transition-colors duration-150 ${
                  hover === i ? 'bg-ink' : 'bg-ink/25 group-hover:bg-ink/60'
                }`}
                style={{ height: `${Math.max(pct, d.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 flex justify-between border-t border-line pt-2 text-[0.625rem] text-ink-faint">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
      <span className="sr-only">{ariaLabel}</span>
    </figure>
  );
}

export function StatusBars({
  data,
  total,
}: {
  data: { status: string; label: string; count: number }[];
  total: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return null;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.status} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-caption text-ink-muted">{d.label}</span>
          <span className="h-2 flex-1 bg-sand-100">
            <span
              className="block h-full bg-ink"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </span>
          <span className="adm-num w-10 shrink-0 text-end text-caption text-ink">{d.count}</span>
          <span className="adm-num w-12 shrink-0 text-end text-caption text-ink-faint">
            {total ? `${Math.round((d.count / total) * 100)}%` : '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}
