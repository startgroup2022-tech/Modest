import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess } from '@/lib/tailor-principal';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { getTailorTask, type TailorTaskAction } from '@/lib/tailor-work';
import { TailorActionButton } from '@/components/tailor/TailorActionButton';
import { taskStatusLabel, qcStatusLabel, formatDate } from '@/components/tailor/TailorTaskRow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

function actionLabel(action: TailorTaskAction, locale: 'en' | 'ar'): string {
  const ar = locale === 'ar';
  const map: Record<TailorTaskAction, { en: string; ar: string }> = {
    accept: { en: 'Accept work', ar: 'قبول العمل' },
    start: { en: 'Start work', ar: 'بدء العمل' },
    submit_for_qc: { en: 'Submit for QC', ar: 'إرسال لفحص الجودة' },
  };
  return map[action][ar ? 'ar' : 'en'];
}

export default async function TailorTaskDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const ar = locale === 'ar';

  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword) redirect(`/${locale}/tailor/password`);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor/tasks/${id}`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');
  const access = await resolveTailorAccess(requested);
  if (!access) redirect(`/${locale}/tailor/sign-in`);

  // Scoped to the tailor: a task belonging to another tailor is a 404 here,
  // exactly like one that does not exist.
  const task = await getTailorTask(access.tailorId, id);
  if (!task) notFound();

  const qs = access.supervisor ? `?tailorId=${access.tailorId}` : '';
  const title = ar && task.titleAr ? task.titleAr : task.productName;
  const readOnly = !access.canWrite;

  const meta: { label: string; value: string }[] = [
    { label: ar ? 'رقم الطلب' : 'Order', value: task.orderNumber },
    { label: ar ? 'الرمز' : 'Code', value: task.code },
    { label: ar ? 'الحالة' : 'Status', value: taskStatusLabel(task.status, locale) },
    { label: ar ? 'الأولوية' : 'Priority', value: task.priority },
    { label: ar ? 'التسليم' : 'Due', value: formatDate(task.dueDate, locale) },
    { label: ar ? 'أجرتك' : 'Your fee', value: task.feeBhd != null ? `${task.feeBhd.toFixed(3)} BHD` : '—' },
    { label: ar ? 'المنتج' : 'Product', value: task.productName },
  ];
  if (task.variantLabel) meta.push({ label: ar ? 'الخيار' : 'Variant', value: task.variantLabel });
  if (task.sku) meta.push({ label: 'SKU', value: task.sku });

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/${locale}/tailor/tasks${qs}`} className="link-underline text-small text-ink-muted">
          {ar ? '→ كل المهام' : '← All work'}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-h2">{title}</h1>
          {task.overdue ? (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-caption text-danger">
              {ar ? 'متأخر' : 'Overdue'}
            </span>
          ) : null}
        </div>
      </div>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="border border-line p-5">
          <h2 className="mb-4 text-h4">{ar ? 'تفاصيل القطعة' : 'Piece details'}</h2>
          <dl className="space-y-2 text-small">
            {meta.map((m) => (
              <div key={m.label} className="flex justify-between gap-4 border-b border-line/60 pb-2">
                <dt className="text-ink-faint">{m.label}</dt>
                <dd className="text-end text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border border-line p-5">
          <h2 className="mb-4 text-h4">
            {ar ? 'القياسات' : 'Measurements'}
            {task.measurement ? (
              <span className="ms-2 text-caption text-ink-faint">
                {task.measurement.kind === 'CUSTOM'
                  ? ar
                    ? 'قياسات خاصة'
                    : 'Custom'
                  : ar
                    ? `مقاس جاهز ${task.measurement.sizeCode ?? ''}`
                    : `Ready size ${task.measurement.sizeCode ?? ''}`}
              </span>
            ) : null}
          </h2>
          {task.measurement ? (
            <dl className="space-y-2 text-small">
              {task.measurement.fields.length === 0 ? (
                <p className="text-ink-muted">{ar ? 'لا توجد قيم مسجّلة.' : 'No recorded values.'}</p>
              ) : (
                task.measurement.fields.map((f) => (
                  <div key={f.key} className="flex justify-between gap-4 border-b border-line/60 pb-2">
                    <dt className="text-ink-faint">{ar ? f.labelAr : f.labelEn}</dt>
                    <dd className="text-end text-ink">
                      {f.value} {task.measurement!.unit}
                    </dd>
                  </div>
                ))
              )}
            </dl>
          ) : (
            <p className="text-ink-muted">{ar ? 'لا توجد قياسات لهذه القطعة.' : 'No measurements for this piece.'}</p>
          )}
        </div>
      </section>

      {task.notes ? (
        <section className="border border-line p-5">
          <h2 className="mb-2 text-h4">{ar ? 'ملاحظات' : 'Notes'}</h2>
          <p className="whitespace-pre-line text-small text-ink-muted">{task.notes}</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-h4">{ar ? 'سجل فحص الجودة' : 'Quality control history'}</h2>
        {task.qcHistory.length === 0 ? (
          <p className="text-ink-muted">{ar ? 'لم يتم فحص هذه القطعة بعد.' : 'This piece has not been checked yet.'}</p>
        ) : (
          <ul className="space-y-3">
            {task.qcHistory.map((qc) => (
              <li key={qc.id} className="border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-small">
                    {ar ? 'محاولة' : 'Attempt'} {qc.attempt} — {qcStatusLabel(qc.status, locale)}
                  </span>
                  <span className="text-caption text-ink-faint">{formatDate(qc.checkedAt, locale)}</span>
                </div>
                {qc.rejectionReason ? (
                  <p className="mt-2 border-s-2 border-danger ps-3 text-small text-danger">{qc.rejectionReason}</p>
                ) : null}
                {qc.notes ? <p className="mt-2 text-small text-ink-muted">{qc.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {readOnly ? (
        <p className="border border-line bg-paper px-4 py-3 text-caption text-ink-muted">
          {ar ? 'أنت تعرض هذه البوابة للقراءة فقط.' : 'You are viewing this portal read-only.'}
        </p>
      ) : task.actions.length > 0 ? (
        <section className="flex flex-wrap gap-3 border-t border-line pt-6">
          {task.actions.map((action) => (
            <TailorActionButton
              key={action}
              endpoint={`/api/tailor/tasks/${task.id}/actions`}
              body={{ action }}
              variant={action === 'submit_for_qc' ? 'primary' : 'outline'}
            >
              {actionLabel(action, locale)}
            </TailorActionButton>
          ))}
        </section>
      ) : null}
    </div>
  );
}
