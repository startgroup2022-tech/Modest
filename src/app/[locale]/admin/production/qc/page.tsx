import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quality Control', robots: { index: false, follow: false } };

export default async function QcPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('qc.view', locale);
  const dict = getAdminDict(locale);

  const [records, pending] = await Promise.all([
    prisma.qcRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { task: { select: { code: true, titleEn: true, titleAr: true } }, checkedBy: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.productionTask.count({ where: { status: { in: ['IN_PROGRESS', 'REWORK'] } } }),
  ]);

  return (
    <>
      <PageHeader title={dict.qc.title} subtitle={dict.qc.subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={dict.qc.title} value={formatNumber(records.length, locale)} />
        <Kpi label={locale === 'ar' ? 'بانتظار الفحص' : 'Awaiting inspection'} value={formatNumber(pending, locale)} tone="warn" />
        <Kpi label={dict.qc.pass} value={formatNumber(records.filter((r) => r.status === 'PASSED').length, locale)} tone="success" />
      </div>
      <Panel bodyClassName="p-0">
        {records.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.production.taskCode}</th>
                  <th>{dict.qc.checklist}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.qc.checkedBy}</th>
                  <th>{dict.qc.checkedAt}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const checks = [r.measurementsOk, r.stitchingOk, r.fabricOk, r.finishingOk, r.accessoriesOk, r.packagingOk];
                  const passed = checks.filter(Boolean).length;
                  return (
                    <tr key={r.id}>
                      <td data-label={dict.production.taskCode} className="text-ink">
                        <span className="block">{locale === 'ar' ? r.task.titleAr ?? r.task.titleEn : r.task.titleEn}</span>
                        <span className="adm-num block text-caption text-ink-faint">{r.task.code}</span>
                      </td>
                      <td data-label={dict.qc.checklist} className="adm-num text-ink-muted">{passed} / {checks.length}</td>
                      <td data-label={dict.common.status}><StatusBadge status={r.status} /></td>
                      <td data-label={dict.qc.checkedBy} className="text-caption text-ink-faint">
                        {r.checkedBy ? [r.checkedBy.firstName, r.checkedBy.lastName].filter(Boolean).join(' ') || r.checkedBy.email : '\u2014'}
                      </td>
                      <td data-label={dict.qc.checkedAt} className="text-caption text-ink-faint">{r.checkedAt ? formatDateTime(r.checkedAt, locale) : '\u2014'}</td>
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
