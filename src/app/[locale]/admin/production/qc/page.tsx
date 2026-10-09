import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDateTime, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { QcInspectionForm } from '@/components/admin/QcInspectionForm';
import { QC_ALLOWED_STATES } from '@/lib/workflow';
import type { TaskStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quality Control', robots: { index: false, follow: false } };

/** States where an inspection is meaningful (mirrors `QC_ALLOWED_STATES`). */
const QUEUE_STATUSES: TaskStatus[] = ['SUBMITTED_FOR_QC', 'IN_PROGRESS', 'REWORK'];

export default async function QcPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('qc.view', locale);
  const dict = getAdminDict(locale);
  const canManage = admin.permissions.has('qc.manage');

  const [queue, history, passedCount] = await Promise.all([
    prisma.productionTask.findMany({
      where: { status: { in: QUEUE_STATUSES } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'asc' }],
      take: 100,
      include: {
        order: { select: { orderNumber: true } },
        tailor: { select: { nameEn: true, nameAr: true } },
        qcRecords: { orderBy: { attempt: 'desc' }, take: 1 },
      },
    }),
    prisma.qcRecord.findMany({
      orderBy: { checkedAt: 'desc' },
      take: 50,
      include: {
        task: { select: { code: true, titleEn: true, titleAr: true } },
        checkedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.qcRecord.count({ where: { status: 'PASSED' } }),
  ]);

  return (
    <>
      <PageHeader title={dict.qc.title} subtitle={dict.qc.subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={locale === 'ar' ? 'بانتظار الفحص' : 'Awaiting inspection'} value={formatNumber(queue.length, locale)} tone="warn" />
        <Kpi label={locale === 'ar' ? 'سجل الفحوصات' : 'Inspections recorded'} value={formatNumber(history.length, locale)} />
        <Kpi label={dict.qc.pass} value={formatNumber(passedCount, locale)} tone="success" />
      </div>

      <Panel title={locale === 'ar' ? 'بانتظار الفحص' : 'Pending inspection'} bodyClassName="p-0" className="mb-6">
        {queue.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.production.taskCode}</th>
                  <th>{dict.common.order}</th>
                  <th>{dict.production.tailor}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.qc.checklist}</th>
                  <th>{locale === 'ar' ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((t) => {
                  const last = t.qcRecords[0];
                  const canInspect = canManage && QC_ALLOWED_STATES.includes(t.status);
                  return (
                    <tr key={t.id}>
                      <td data-label={dict.production.taskCode} className="text-ink">
                        <span className="block">{locale === 'ar' ? t.titleAr ?? t.titleEn : t.titleEn}</span>
                        <span className="adm-num block text-caption text-ink-faint">{t.code}</span>
                      </td>
                      <td data-label={dict.common.order} className="adm-num text-ink-muted">{t.order.orderNumber}</td>
                      <td data-label={dict.production.tailor} className="text-ink-muted">
                        {t.tailor ? (locale === 'ar' ? t.tailor.nameAr : t.tailor.nameEn) : dict.production.unassigned}
                      </td>
                      <td data-label={dict.common.status}><StatusBadge status={t.status} /></td>
                      <td data-label={dict.qc.checklist} className="text-caption text-ink-faint">
                        {last
                          ? `${locale === 'ar' ? 'المحاولة' : 'Attempt'} ${last.attempt} · ${last.status}`
                          : locale === 'ar'
                            ? 'لم يُفحص بعد'
                            : 'Not yet inspected'}
                      </td>
                      <td data-label={locale === 'ar' ? 'إجراء' : 'Action'}>
                        {canInspect ? (
                          <QcInspectionForm taskId={t.id} taskStatus={t.status} locale={locale} />
                        ) : (
                          <span className="text-caption text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={locale === 'ar' ? 'سجل الفحوصات' : 'Inspection history'} bodyClassName="p-0">
        {history.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.production.taskCode}</th>
                  <th>{locale === 'ar' ? 'المحاولة' : 'Attempt'}</th>
                  <th>{dict.qc.checklist}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.reason}</th>
                  <th>{dict.qc.checkedBy}</th>
                  <th>{dict.qc.checkedAt}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => {
                  const checks = [r.measurementsOk, r.stitchingOk, r.fabricOk, r.finishingOk, r.accessoriesOk, r.packagingOk];
                  const passed = checks.filter(Boolean).length;
                  return (
                    <tr key={r.id}>
                      <td data-label={dict.production.taskCode} className="text-ink">
                        <span className="block">{locale === 'ar' ? r.task.titleAr ?? r.task.titleEn : r.task.titleEn}</span>
                        <span className="adm-num block text-caption text-ink-faint">{r.task.code}</span>
                      </td>
                      <td data-label={locale === 'ar' ? 'المحاولة' : 'Attempt'} className="adm-num text-ink-muted">{r.attempt}</td>
                      <td data-label={dict.qc.checklist} className="adm-num text-ink-muted">{passed} / {checks.length}</td>
                      <td data-label={dict.common.status}><StatusBadge status={r.status} /></td>
                      <td data-label={dict.common.reason} className="text-caption text-ink-faint">{r.rejectionReason ?? '—'}</td>
                      <td data-label={dict.qc.checkedBy} className="text-caption text-ink-faint">
                        {r.checkedBy ? [r.checkedBy.firstName, r.checkedBy.lastName].filter(Boolean).join(' ') || r.checkedBy.email : '—'}
                      </td>
                      <td data-label={dict.qc.checkedAt} className="text-caption text-ink-faint">{r.checkedAt ? formatDateTime(r.checkedAt, locale) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}