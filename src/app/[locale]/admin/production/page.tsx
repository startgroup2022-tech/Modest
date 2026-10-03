import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Production', robots: { index: false, follow: false } };

const PRIORITY_TONE: Record<string, string> = { URGENT: 'adm-badge-danger', HIGH: 'adm-badge-warn', NORMAL: 'adm-badge-info', LOW: 'adm-badge-neutral' };

export default async function ProductionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('production.view', locale);
  const dict = getAdminDict(locale);

  const [tasks, tailors, counts] = await Promise.all([
    prisma.productionTask.findMany({
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 100,
      include: { order: { select: { orderNumber: true } }, tailor: true },
    }),
    prisma.tailor.findMany({ where: { status: 'ACTIVE' }, orderBy: { nameEn: 'asc' } }),
    prisma.productionTask.groupBy({ by: ['status'], _count: true }),
  ]);

  const countOf = (statuses: string[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

  return (
    <>
      <PageHeader title={dict.production.title} subtitle={dict.production.subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={dict.production.queue} value={formatNumber(countOf(['PENDING', 'ASSIGNED']), locale)} tone="warn" />
        <Kpi label={locale === 'ar' ? 'قيد التنفيذ' : 'In progress'} value={formatNumber(countOf(['IN_PROGRESS']), locale)} />
        <Kpi label={dict.production.rework} value={formatNumber(countOf(['REWORK']), locale)} tone="danger" />
        <Kpi label={dict.production.complete} value={formatNumber(countOf(['COMPLETED']), locale)} tone="success" />
      </div>
      <Panel bodyClassName="p-0">
        {tasks.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.production.taskCode}</th>
                  <th>{dict.common.order}</th>
                  <th>{dict.production.tailor}</th>
                  <th>{dict.production.priority}</th>
                  <th>{dict.production.dueDate}</th>
                  <th>{dict.common.status}</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const overdue = t.dueDate && t.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(t.status);
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
                      <td data-label={dict.production.priority}>
                        <span className={PRIORITY_TONE[t.priority] ?? 'adm-badge-neutral'}>{label(t.priority, locale)}</span>
                      </td>
                      <td data-label={dict.production.dueDate} className={overdue ? 'text-danger' : 'text-caption text-ink-faint'}>
                        {t.dueDate ? formatDate(t.dueDate, locale) : '\u2014'}
                      </td>
                      <td data-label={dict.common.status}><StatusBadge status={t.status} /></td>
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
