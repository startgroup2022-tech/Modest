import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDate, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { ProductionTaskActions } from '@/components/admin/ProductionTaskActions';
import { SearchFilter, SelectFilter, ClearFilters } from '@/components/admin/Filters';
import { listProductionTasks, productionCounts, tailorWorkload } from '@/lib/admin/production';
import { PRODUCTION_TRANSITIONS } from '@/lib/workflow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Production', robots: { index: false, follow: false } };

const PRIORITY_TONE: Record<string, string> = { URGENT: 'adm-badge-danger', HIGH: 'adm-badge-warn', NORMAL: 'adm-badge-info', LOW: 'adm-badge-neutral' };
const ACTION_TARGETS = ['IN_PROGRESS', 'COMPLETED', 'REWORK', 'CANCELLED'];
const TASK_STATUSES = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED_FOR_QC', 'COMPLETED', 'REWORK', 'CANCELLED'];

export default async function ProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('production.view', locale);
  const dict = getAdminDict(locale);
  const sp = await searchParams;
  const canManage = admin.permissions.has('production.manage');
  const canAssign = admin.permissions.has('orders.assign');
  const ar = locale === 'ar';

  const scope = sp.scope && ['unassigned', 'assigned', 'overdue', 'paid_unassigned'].includes(sp.scope) ? sp.scope : undefined;

  const [tasks, counts, workload] = await Promise.all([
    listProductionTasks({ q: sp.q, status: sp.status, priority: sp.priority, tailorId: sp.tailor, scope }),
    productionCounts(),
    tailorWorkload(),
  ]);

  const tailors = workload.map((t) => ({ id: t.id, name: ar ? t.nameAr : t.nameEn }));
  const href = (p: string) => adminHref(locale, p);
  const scopes = [
    { key: '', en: 'All tasks', ar: 'كل المهام' },
    { key: 'paid_unassigned', en: 'Paid, unassigned', ar: 'مدفوع، غير مُعيّن' },
    { key: 'unassigned', en: 'Unassigned', ar: 'غير مُعيّن' },
    { key: 'assigned', en: 'Assigned', ar: 'مُعيّن' },
    { key: 'overdue', en: 'Overdue', ar: 'متأخر' },
  ];

  return (
    <>
      <PageHeader
        title={dict.production.title}
        subtitle={dict.production.subtitle}
        actions={
          <Link href={href('production/qc')} className="adm-btn-outline">
            {dict.qc.title}
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label={ar ? 'مدفوع، غير مُعيّن' : 'Paid, unassigned'} value={formatNumber(counts.paidUnassigned, locale)} tone="warn" />
        <Kpi label={dict.production.queue} value={formatNumber(counts.unassigned, locale)} tone="warn" />
        <Kpi label={ar ? 'قيد التنفيذ' : 'In progress'} value={formatNumber(counts.inProgress, locale)} />
        <Kpi label={ar ? 'بانتظار الفحص' : 'Awaiting QC'} value={formatNumber(counts.awaitingQc, locale)} tone="warn" />
        <Kpi label={dict.production.rework} value={formatNumber(counts.rework, locale)} tone="danger" />
        <Kpi label={dict.production.overdue} value={formatNumber(counts.overdue, locale)} tone="danger" />
        <Kpi label={dict.production.complete} value={formatNumber(counts.completed, locale)} tone="success" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {scopes.map((s) => (
          <Link
            key={s.key || 'all'}
            href={s.key ? `${href('production')}?scope=${s.key}` : href('production')}
            className={scope === (s.key || undefined) || (!scope && !s.key) ? 'adm-btn-primary adm-btn-sm' : 'adm-btn-outline adm-btn-sm'}
          >
            {ar ? s.ar : s.en}
          </Link>
        ))}
      </div>

      <Panel bodyClassName="p-0" className="mb-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchFilter placeholder={ar ? 'ابحث برمز المهمة أو الطلب…' : 'Search task or order…'} />
          <SelectFilter
            name="status"
            label={dict.common.status}
            value={sp.status ?? 'all'}
            options={[{ value: 'all', label: dict.common.all }, ...TASK_STATUSES.map((s) => ({ value: s, label: label(s, locale) }))]}
          />
          <SelectFilter
            name="priority"
            label={dict.production.priority}
            value={sp.priority ?? 'all'}
            options={[
              { value: 'all', label: dict.common.all },
              ...['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => ({ value: p, label: label(p, locale) })),
            ]}
          />
          <SelectFilter
            name="tailor"
            label={dict.production.tailor}
            value={sp.tailor ?? ''}
            options={[{ value: '', label: dict.common.all }, { value: 'unassigned', label: dict.production.unassigned }, ...tailors.map((t) => ({ value: t.id, label: t.name }))]}
          />
          <ClearFilters label={dict.common.clear} />
        </div>

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
                  <th>{dict.qc.title}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const overdue = t.dueDate && t.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(t.status);
                  const lastQc = t.qcRecords[0];
                  return (
                    <tr key={t.id}>
                      <td data-label={dict.production.taskCode} className="text-ink">
                        <span className="block">{ar ? t.titleAr ?? t.titleEn : t.titleEn}</span>
                        <span className="adm-num block text-caption text-ink-faint">{t.code}</span>
                      </td>
                      <td data-label={dict.common.order} className="adm-num text-ink-muted">{t.order.orderNumber}</td>
                      <td data-label={dict.production.tailor} className="text-ink-muted">
                        {t.tailor ? (ar ? t.tailor.nameAr : t.tailor.nameEn) : dict.production.unassigned}
                      </td>
                      <td data-label={dict.production.priority}>
                        <span className={PRIORITY_TONE[t.priority] ?? 'adm-badge-neutral'}>{label(t.priority, locale)}</span>
                      </td>
                      <td data-label={dict.production.dueDate} className={overdue ? 'text-danger' : 'text-caption text-ink-faint'}>
                        {t.dueDate ? formatDate(t.dueDate, locale) : '—'}
                      </td>
                      <td data-label={dict.common.status}><StatusBadge status={t.status} /></td>
                      <td data-label={dict.qc.title} className="text-caption text-ink-faint">
                        {lastQc ? `#${lastQc.attempt} · ${lastQc.status}` : '—'}
                      </td>
                      <td data-label={dict.common.actions}>
                        <ProductionTaskActions
                          taskId={t.id}
                          tailorId={t.tailorId}
                          priority={t.priority}
                          dueDate={t.dueDate ? t.dueDate.toISOString() : null}
                          taskStatus={t.status}
                          tailors={tailors}
                          transitions={(PRODUCTION_TRANSITIONS[t.status] ?? []).filter((to) => ACTION_TARGETS.includes(to))}
                          canAssign={canAssign}
                          canManage={canManage}
                          locale={locale}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={ar ? 'عبء العمل' : 'Tailor workload'} bodyClassName="p-0">
        {workload.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.production.tailor}</th>
                  <th>{dict.production.activeTasks}</th>
                  <th>{dict.production.capacity}</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((w) => (
                  <tr key={w.id}>
                    <td data-label={dict.production.tailor} className="text-ink">{ar ? w.nameAr : w.nameEn}</td>
                    <td data-label={dict.production.activeTasks} className="adm-num">
                      <span className={w.openPieces > w.capacity ? 'text-danger' : 'text-ink-muted'}>
                        {w.openPieces} / {w.capacity}
                      </span>
                    </td>
                    <td data-label={dict.production.capacity} className="text-caption text-ink-faint">
                      {w.openPieces > w.capacity ? (ar ? 'فوق الطاقة' : 'Over capacity') : ar ? 'متاح' : 'Available'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}