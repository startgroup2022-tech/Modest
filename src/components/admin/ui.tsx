import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ── Page header ─────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.375rem] font-medium tracking-tight text-ink sm:text-[1.625rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-small text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Card / panel ────────────────────────────────────────── */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('adm-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="adm-title">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ── KPI tile ────────────────────────────────────────────── */
export function Kpi({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: 'default' | 'warn' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'warn' ? 'text-[#8A6B2B]' : tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink';
  const body = (
    <>
      <span className="adm-kpi-label">{label}</span>
      <span className={cn('adm-kpi-value mt-2 block', toneClass)}>{value}</span>
      {hint && <span className="mt-1.5 block text-caption text-ink-faint">{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="adm-card block p-5 transition-colors duration-200 hover:border-ink">
      {body}
    </Link>
  ) : (
    <div className="adm-card p-5">{body}</div>
  );
}

/* ── Status badge ────────────────────────────────────────── */
type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent';

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  PENDING: 'warn',
  CONFIRMED: 'info',
  PREPARING: 'info',
  IN_PRODUCTION: 'info',
  QUALITY_CHECK: 'info',
  READY: 'success',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUND_REQUESTED: 'warn',
  REFUNDED: 'danger',
  INITIATED: 'neutral',
  PAID: 'success',
  FAILED: 'danger',
  PARTIALLY_REFUNDED: 'warn',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  REWORK: 'warn',
  PASSED: 'success',
  REWORK_REQUIRED: 'warn',
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ON_LEAVE: 'warn',
  SUSPENDED: 'danger',
  ARCHIVED: 'neutral',
  LOW_STOCK: 'warn',
  OUT_OF_STOCK: 'danger',
  IN_STOCK: 'success',
  PRE_ORDER: 'info',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE_BY_STATUS[status] ?? 'neutral';
  const cls = {
    neutral: 'adm-badge-neutral',
    info: 'adm-badge-info',
    success: 'adm-badge-success',
    warn: 'adm-badge-warn',
    danger: 'adm-badge-danger',
    accent: 'adm-badge-accent',
  }[tone];
  return <span className={cls}>{label ?? status.replace(/_/g, ' ')}</span>;
}

/* ── Empty state ─────────────────────────────────────────── */
export function AdminEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 h-10 w-10 border border-line" aria-hidden />
      <p className="adm-title">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-small text-ink-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Pagination ──────────────────────────────────────────── */
export function AdminPagination({
  page,
  pageCount,
  total,
  perPage,
  buildHref,
  labels,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  buildHref: (page: number) => string;
  labels: { previous: string; next: string; showing: string; of: string; results: string };
}) {
  if (pageCount <= 1) {
    return (
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-caption text-ink-faint">
        <span>
          {total} {labels.results}
        </span>
      </div>
    );
  }
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
      <span className="text-caption text-ink-faint">
        {labels.showing} {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} {labels.of} {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="adm-btn-outline adm-btn-sm">
            {labels.previous}
          </Link>
        ) : (
          <span className="adm-btn-outline adm-btn-sm opacity-40">{labels.previous}</span>
        )}
        <span className="adm-num px-2 text-caption text-ink-muted">
          {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={buildHref(page + 1)} className="adm-btn-outline adm-btn-sm">
            {labels.next}
          </Link>
        ) : (
          <span className="adm-btn-outline adm-btn-sm opacity-40">{labels.next}</span>
        )}
      </div>
    </nav>
  );
}

/* ── Section tabs (server-rendered links) ────────────────── */
export function Tabs({
  items,
  active,
}: {
  items: { key: string; label: string; href?: string }[];
  active: string;
}) {
  return (
    <div className="adm-scroll -mx-5 mb-5 flex gap-1 overflow-x-auto border-b border-line px-5 sm:mx-0 sm:px-0">
      {items.map((it) =>
        it.href ? (
          <Link
            key={it.key}
            href={it.href}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[0.8125rem] transition-colors duration-150',
              it.key === active ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {it.label}
          </Link>
        ) : null,
      )}
    </div>
  );
}
