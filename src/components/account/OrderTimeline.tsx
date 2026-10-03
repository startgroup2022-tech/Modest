import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';

const ORDER: { status: string; key: string }[] = [
  { status: 'PENDING', key: 'placed' },
  { status: 'CONFIRMED', key: 'confirmed' },
  { status: 'PREPARING', key: 'preparing' },
  { status: 'IN_PRODUCTION', key: 'inProduction' },
  { status: 'QUALITY_CHECK', key: 'qualityCheck' },
  { status: 'READY', key: 'ready' },
  { status: 'SHIPPED', key: 'shipped' },
  { status: 'DELIVERED', key: 'delivered' },
];

const TERMINAL: Record<string, string> = { CANCELLED: 'cancelled', REFUNDED: 'refunded' };

export function OrderTimeline({
  currentStatus,
  dict,
  events,
}: {
  currentStatus: string;
  dict: Dict;
  events: { status: string; messageEn: string | null; messageAr: string | null; createdAt: Date }[];
}) {
  const terminal = TERMINAL[currentStatus];
  const currentIndex = ORDER.findIndex((s) => s.status === currentStatus);

  if (terminal) {
    return (
      <ol className="space-y-0">
        <li className="flex gap-4">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ink" />
          <div>
            <p className="text-body">{dict.order[terminal as keyof Dict['order']]}</p>
            <p className="text-caption text-ink-faint">
              {events.find((e) => e.status === currentStatus)?.createdAt.toISOString().slice(0, 10) ?? ''}
            </p>
          </div>
        </li>
      </ol>
    );
  }

  return (
    <ol>
      {ORDER.map((step, i) => {
        const done = i <= currentIndex;
        const event = events.find((e) => e.status === step.status);
        return (
          <li key={step.status} className="relative flex gap-4 pb-6 last:pb-0">
            {i < ORDER.length - 1 ? (
              <span
                aria-hidden="true"
                className={clsx('absolute start-[4.5px] top-3 h-full w-px', done ? 'bg-ink' : 'bg-line')}
              />
            ) : null}
            <span
              className={clsx(
                'relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border',
                done ? 'border-ink bg-ink' : 'border-line-strong bg-paper',
              )}
            />
            <div>
              <p className={clsx('text-body', done ? 'text-ink' : 'text-ink-faint')}>
                {dict.order[step.key as keyof Dict['order']]}
              </p>
              {event ? <p className="text-caption text-ink-faint">{event.createdAt.toISOString().slice(0, 10)}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
