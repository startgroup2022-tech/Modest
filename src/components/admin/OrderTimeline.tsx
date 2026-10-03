import { cn } from '@/lib/utils';

export interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  createdAt: string;
}

const TONE: Record<string, string> = {
  CANCELLED: 'bg-danger',
  REFUNDED: 'bg-danger',
  REFUND_REQUESTED: 'bg-[#B8860B]',
  DELIVERED: 'bg-success',
};

/** Server-rendered order timeline. Newest event first. */
export function OrderTimeline({ events, locale }: { events: TimelineEvent[]; locale: 'en' | 'ar' }) {
  if (events.length === 0) return null;
  const ordered = [...events].reverse();
  return (
    <ol className="relative space-y-0">
      {ordered.map((e, i) => {
        const tone = TONE[e.status] ?? 'bg-ink';
        return (
          <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < ordered.length - 1 && (
              <span className="absolute start-[5px] top-4 h-full w-px bg-line" aria-hidden />
            )}
            <span className={cn('relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full', tone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-small text-ink">{e.message || e.status.replace(/_/g, ' ')}</p>
              <p className="adm-num mt-0.5 text-caption text-ink-faint">
                {new Date(e.createdAt).toLocaleString(locale === 'ar' ? 'ar-BH' : 'en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  numberingSystem: 'latn',
                })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
