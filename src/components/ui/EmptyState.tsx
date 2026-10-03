import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight } from './icons';

interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, body, actionLabel, actionHref, icon, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-20 text-center', className)}>
      {icon ? <div className="mb-6 text-ink-faint">{icon}</div> : null}
      <h3 className="text-h3 text-ink">{title}</h3>
      {body ? <p className="mt-3 max-w-sm text-small text-ink-muted">{body}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-outline mt-8">
          {actionLabel}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  );
}
