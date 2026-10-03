'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface AnnouncementPromo {
  id: string;
  titleEn: string;
  titleAr: string;
  ctaLabelEn: string | null;
  ctaLabelAr: string | null;
  ctaHref: string | null;
}

const DISMISS_KEY = 'att_announce_dismissed';

/**
 * Admin-controlled announcement bar. Promotions with placement `announcement`
 * surface here; a dismissed promotion stays hidden for the session so it never
 * becomes intrusive.
 */
export function AnnouncementBar({ promos, locale }: { promos: AnnouncementPromo[]; locale: 'en' | 'ar' }) {
  const [current, setCurrent] = useState<AnnouncementPromo | null>(null);

  useEffect(() => {
    if (promos.length === 0) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]') as string[];
    } catch {
      seen = [];
    }
    setCurrent(promos.find((p) => !seen.includes(p.id)) ?? null);
  }, [promos]);

  if (!current) return null;

  const title = locale === 'ar' ? current.titleAr : current.titleEn;
  const cta = locale === 'ar' ? current.ctaLabelAr : current.ctaLabelEn;

  function dismiss() {
    if (!current) return;
    try {
      const seen = JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]') as string[];
      if (!seen.includes(current.id)) sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...seen, current.id]));
    } catch {
      /* storage unavailable — still hide for this render */
    }
    setCurrent(null);
  }

  return (
    <div className="relative bg-ink text-paper">
      <div className="shell flex min-h-10 items-center justify-center gap-3 py-2 text-center">
        <p className="text-caption uppercase tracking-[0.16em]">
          {current.ctaHref ? (
            <Link href={current.ctaHref} className="underline-offset-4 hover:underline">
              {title}
              {cta ? <span className="ms-2 opacity-80">{cta}</span> : null}
            </Link>
          ) : (
            title
          )}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={locale === 'ar' ? 'إغلاق' : 'Dismiss'}
          className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-paper/70 transition-colors hover:text-paper"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
