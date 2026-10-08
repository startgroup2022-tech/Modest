import Link from 'next/link';
import type { TailorTaskListItem } from '@/lib/tailor-work';

/** Bilingual status labels shared by the list and detail screens. */
export function taskStatusLabel(status: string, locale: 'en' | 'ar'): string {
  const ar = locale === 'ar';
  const map: Record<string, { en: string; ar: string }> = {
    PENDING: { en: 'Pending', ar: 'بالانتظار' },
    ASSIGNED: { en: 'Awaiting your acceptance', ar: 'بانتظار قبولك' },
    ACCEPTED: { en: 'Accepted', ar: 'مقبول' },
    IN_PROGRESS: { en: 'In progress', ar: 'قيد التنفيذ' },
    SUBMITTED_FOR_QC: { en: 'Submitted for QC', ar: 'أُرسل لفحص الجودة' },
    COMPLETED: { en: 'Completed', ar: 'مكتمل' },
    REWORK: { en: 'Rework needed', ar: 'يحتاج إعادة تصحيح' },
    CANCELLED: { en: 'Cancelled', ar: 'ملغى' },
  };
  return map[status]?.[ar ? 'ar' : 'en'] ?? status;
}

export function settlementStatusLabel(status: string, locale: 'en' | 'ar'): string {
  const ar = locale === 'ar';
  const map: Record<string, { en: string; ar: string }> = {
    PENDING: { en: 'Prepared', ar: 'مُعدّة' },
    APPROVED: { en: 'Approved', ar: 'معتمدة' },
    TRANSFERRED: { en: 'Transferred', ar: 'محوّلة' },
    PAID: { en: 'Paid — confirm receipt', ar: 'مدفوعة — أكّد الاستلام' },
    CONFIRMED: { en: 'Confirmed', ar: 'مؤكدة' },
    CANCELLED: { en: 'Cancelled', ar: 'ملغاة' },
  };
  return map[status]?.[ar ? 'ar' : 'en'] ?? status;
}

export function qcStatusLabel(status: string, locale: 'en' | 'ar'): string {
  const ar = locale === 'ar';
  const map: Record<string, { en: string; ar: string }> = {
    PENDING: { en: 'Pending', ar: 'بالانتظار' },
    PASSED: { en: 'Passed', ar: 'اجتاز' },
    FAILED: { en: 'Failed', ar: 'لم يجتز' },
    REWORK_REQUIRED: { en: 'Rework required', ar: 'يتطلب إعادة تصحيح' },
  };
  return map[status]?.[ar ? 'ar' : 'en'] ?? status;
}

export function formatDate(value: Date | string | null, locale: 'en' | 'ar'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** One row in the tailor's work list. Never renders customer money. */
export function TailorTaskRow({
  task,
  locale,
  href,
}: {
  task: TailorTaskListItem;
  locale: 'en' | 'ar';
  href: string;
}) {
  const ar = locale === 'ar';
  const title = ar && task.titleAr ? task.titleAr : task.productName;
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 border-b border-line py-4 transition-colors hover:bg-paper md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-caption text-ink-faint">{task.code}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-caption text-ink-muted">
            {taskStatusLabel(task.status, locale)}
          </span>
          {task.overdue ? (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-caption text-danger">
              {ar ? 'متأخر' : 'Overdue'}
            </span>
          ) : null}
          {task.lastQc && !['PASSED'].includes(task.lastQc.status) && task.status === 'REWORK' ? (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-caption text-danger">
              {qcStatusLabel(task.lastQc.status, locale)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-body">{title}</p>
        <p className="text-caption text-ink-faint">
          {task.orderNumber}
          {task.sizeCode ? ` · ${ar ? 'المقاس' : 'Size'} ${task.sizeCode}` : ''}
          {task.measurementKind === 'CUSTOM' ? ` · ${ar ? 'قياسات خاصة' : 'Custom measurements'}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-6 text-small">
        <div className="text-end">
          <p className="text-caption text-ink-faint">{ar ? 'التسليم' : 'Due'}</p>
          <p className={task.overdue ? 'text-danger' : 'text-ink'}>{formatDate(task.dueDate, locale)}</p>
        </div>
        <div className="text-end">
          <p className="text-caption text-ink-faint">{ar ? 'أجرتك' : 'Your fee'}</p>
          <p className="text-ink">{task.feeBhd != null ? `${task.feeBhd.toFixed(3)} BHD` : '—'}</p>
        </div>
      </div>
    </Link>
  );
}
