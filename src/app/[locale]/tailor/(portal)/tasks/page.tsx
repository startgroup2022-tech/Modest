import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess } from '@/lib/tailor-principal';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { listTailorTasks } from '@/lib/tailor-work';
import { TailorTaskRow } from '@/components/tailor/TailorTaskRow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

const OPEN = new Set(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED_FOR_QC', 'REWORK']);

export default async function TailorTasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const ar = locale === 'ar';

  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword) redirect(`/${locale}/tailor/password`);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor/tasks`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');
  const access = await resolveTailorAccess(requested);
  if (!access) redirect(`/${locale}/tailor/sign-in`);

  const tasks = await listTailorTasks(access.tailorId, { includeCompleted: true });
  const open = tasks.filter((t) => OPEN.has(t.status));
  const done = tasks.filter((t) => !OPEN.has(t.status));
  const qs = access.supervisor ? `?tailorId=${access.tailorId}` : '';

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-h3">{ar ? 'مهام مفتوحة' : 'Open work'}</h2>
        {open.length === 0 ? (
          <p className="border border-line p-6 text-center text-ink-muted">
            {ar ? 'لا توجد مهام مفتوحة.' : 'No open work.'}
          </p>
        ) : (
          <div className="border-t border-line">
            {open.map((task) => (
              <TailorTaskRow key={task.id} task={task} locale={locale} href={`/${locale}/tailor/tasks/${task.id}${qs}`} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 ? (
        <section>
          <h2 className="mb-4 text-h3">{ar ? 'منتهية' : 'Finished'}</h2>
          <div className="border-t border-line opacity-80">
            {done.map((task) => (
              <TailorTaskRow key={task.id} task={task} locale={locale} href={`/${locale}/tailor/tasks/${task.id}${qs}`} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
