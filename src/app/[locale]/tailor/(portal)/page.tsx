import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess } from '@/lib/tailor-principal';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { tailorDashboard, listTailorTasks } from '@/lib/tailor-work';
import { TailorTaskRow } from '@/components/tailor/TailorTaskRow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TailorDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const ar = locale === 'ar';

  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword) redirect(`/${locale}/tailor/password`);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');
  const access = await resolveTailorAccess(requested);
  if (!access) redirect(`/${locale}/tailor/sign-in`);

  const [stats, tasks] = await Promise.all([
    tailorDashboard(access.tailorId),
    listTailorTasks(access.tailorId, { includeCompleted: false }),
  ]);
  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').slice(0, 6);
  const qs = access.supervisor ? `?tailorId=${access.tailorId}` : '';

  const cards = [
    { label: ar ? 'بانتظار القبول' : 'Awaiting acceptance', value: stats.awaitingAcceptance },
    { label: ar ? 'قيد التنفيذ' : 'In progress', value: stats.inProgress },
    { label: ar ? 'أُرسل لفحص الجودة' : 'Submitted for QC', value: stats.submitted },
    { label: ar ? 'إعادة تصحيح' : 'Rework', value: stats.rework },
    { label: ar ? 'متأخر' : 'Overdue', value: stats.overdue, danger: stats.overdue > 0 },
  ];

  return (
    <div className="space-y-10">
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="border border-line p-4">
              <p className="text-caption text-ink-faint">{c.label}</p>
              <p className={`mt-1 text-h3 ${c.danger ? 'text-danger' : 'text-ink'}`}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3">{ar ? 'مهامك الحالية' : 'Current work'}</h2>
          <Link href={`/${locale}/tailor/tasks${qs}`} className="link-underline text-small">
            {ar ? 'عرض الكل' : 'View all'}
          </Link>
        </div>
        {openTasks.length === 0 ? (
          <p className="border border-line p-6 text-center text-ink-muted">
            {ar ? 'لا توجد مهام مفتوحة حاليًا.' : 'No open work right now.'}
          </p>
        ) : (
          <div className="border-t border-line">
            {openTasks.map((task) => (
              <TailorTaskRow key={task.id} task={task} locale={locale} href={`/${locale}/tailor/tasks/${task.id}${qs}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
