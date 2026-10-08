'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface TailorNotificationItem {
  id: string;
  eventKey: string | null;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Tailor notification feed. Marking read is a write, so it is hidden entirely
 * for a read-only supervisor.
 */
export function TailorNotificationList({
  items,
  locale,
  readOnly,
}: {
  items: TailorNotificationItem[];
  locale: 'en' | 'ar';
  readOnly: boolean;
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const unread = items.filter((i) => !i.readAt).length;

  async function markAll() {
    setBusy(true);
    try {
      await fetch('/api/tailor/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="border border-line p-6 text-center text-ink-muted">
        {ar ? 'لا توجد إشعارات.' : 'No notifications.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && unread > 0 ? (
        <div className="flex justify-end">
          <button type="button" onClick={markAll} disabled={busy} className="link-underline text-small text-ink-muted">
            {ar ? 'تعليم الكل كمقروء' : 'Mark all read'}
          </button>
        </div>
      ) : null}
      <ul className="border-t border-line">
        {items.map((n) => {
          const title = ar ? n.titleAr : n.titleEn;
          const body = ar ? n.bodyAr : n.bodyEn;
          const href = n.href ? `/${locale}${n.href}` : null;
          const content = (
            <div className={cn('py-4', n.readAt ? 'opacity-70' : '')}>
              <div className="flex items-center gap-2">
                {!n.readAt ? <span className="h-2 w-2 rounded-full bg-ink" aria-hidden /> : null}
                <p className="text-body">{title}</p>
              </div>
              {body ? <p className="mt-1 text-small text-ink-muted">{body}</p> : null}
            </div>
          );
          return (
            <li key={n.id} className="border-b border-line">
              {href ? (
                <Link href={href} className="block hover:bg-paper">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
