import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

import { Drawer } from '@/components/admin/Filters';
import { SettlementForm } from '@/components/admin/SettlementForm';
import { SettlementRowActions } from '@/components/admin/SettlementRowActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tailor Settlements', robots: { index: false, follow: false } };

export default async function SettlementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('settlements.view', locale);
  const dict = getAdminDict(locale);
  const canManage = admin.permissions.has('settlements.manage');

  const [settlements, tailors] = await Promise.all([
    prisma.tailorSettlement.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { tailor: true } }),
    prisma.tailor.findMany({ where: { status: 'ACTIVE' }, orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true, nameAr: true } }),
  ]);

  const outstanding = settlements
    .filter((s) => s.status === 'PENDING' || s.status === 'APPROVED')
    .reduce((sum, s) => sum + Number(s.netBhd), 0);

  return (
    <>
      <PageHeader
        title={dict.finance.settlements}
        subtitle={dict.finance.subtitle}
        actions={
          tailors.length > 0 ? (
            <Drawer trigger={`+ ${dict.common.create}`} title={dict.finance.settlements} wide>
              <SettlementForm
                tailors={tailors.map((t) => ({ id: t.id, name: locale === 'ar' ? t.nameAr : t.nameEn }))}
                dict={{ common: dict.common }}
              />
            </Drawer>
          ) : undefined
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={dict.finance.outstanding} value={formatBhd(outstanding, locale)} tone="warn" />
        <Kpi label={dict.finance.paid} value={formatBhd(settlements.filter((s) => s.status === 'PAID').reduce((a, s) => a + Number(s.netBhd), 0), locale)} tone="success" />
        <Kpi label={dict.common.total} value={formatNumber(settlements.length, locale)} />
      </div>
      <Panel bodyClassName="p-0">
        {settlements.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.reference}</th>
                  <th>{dict.production.tailor}</th>
                  <th className="text-end">{dict.finance.tasksCompleted}</th>
                  <th className="text-end">{dict.finance.gross}</th>
                  <th className="text-end">{dict.finance.net}</th>
                  <th>{dict.common.status}</th>
                  <th>{locale === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td data-label={dict.common.reference} className="adm-num text-ink">{s.number}</td>
                    <td data-label={dict.production.tailor} className="text-ink-muted">{locale === 'ar' ? s.tailor.nameAr : s.tailor.nameEn}</td>
                    <td data-label={dict.finance.tasksCompleted} className="adm-num text-end">{formatNumber(s.tasksCount, locale)}</td>
                    <td data-label={dict.finance.gross} className="adm-num text-end">{formatBhd(s.grossBhd, locale)}</td>
                    <td data-label={dict.finance.net} className="adm-num text-end text-ink">{formatBhd(s.netBhd, locale)}</td>
                    <td data-label={dict.common.status}><StatusBadge status={s.status} /></td>
                    <td data-label={locale === 'ar' ? 'إجراءات' : 'Actions'}>
                      <SettlementRowActions settlementId={s.id} status={s.status} canManage={canManage} locale={locale} />
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
