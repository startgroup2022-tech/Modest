import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';
import { ExpenseRowActions } from '@/components/admin/ExpenseRowActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Expenses', robots: { index: false, follow: false } };

export default async function ExpensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('expenses.view', locale);
  const dict = getAdminDict(locale);
  const canApprove = admin.permissions.has('expenses.approve');

  const [expenses, categories, totals] = await Promise.all([
    prisma.expense.findMany({
      orderBy: { expenseDate: 'desc' },
      take: 100,
      include: { category: true },
    }),
    prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { nameEn: 'asc' } }),
    prisma.expense.groupBy({ by: ['status'], _sum: { amountBhd: true } }),
  ]);

  const sumFor = (statuses: string[]) =>
    totals.filter((t) => statuses.includes(t.status)).reduce((s, t) => s + Number(t._sum.amountBhd ?? 0), 0);

  const fields = (): FieldDef[] => [
    { key: 'description', label: dict.common.notes, full: true },
    { key: 'amountBhd', label: `${dict.common.amount} (BHD)`, type: 'number', step: '0.001' },
    { key: 'currencyCode', label: dict.common.currency },
    {
      key: 'categoryId',
      label: dict.finance.category,
      type: 'select',
      options: [{ value: '', label: dict.common.none }, ...categories.map((c) => ({ value: c.id, label: locale === 'ar' ? c.nameAr : c.nameEn }))],
    },
    { key: 'vendor', label: dict.finance.vendor },
    { key: 'expenseDate', label: dict.common.date, type: 'date' },
    { key: 'notes', label: dict.common.notes, type: 'textarea', full: true },
  ];
  const blank = { description: '', amountBhd: '', currencyCode: 'BHD', categoryId: '', vendor: '', expenseDate: new Date().toISOString().slice(0, 10), notes: '' };

  return (
    <>
      <PageHeader
        title={dict.finance.expenses}
        subtitle={dict.finance.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.finance.expenses} wide>
            <ResourceForm endpoint="/api/admin/expenses" initial={blank} fields={fields()} dict={{ common: dict.common }} transformKey="expenses" />
          </Drawer>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label={dict.finance.approvals} value={formatBhd(sumFor(['SUBMITTED']), locale)} tone="warn" />
        <Kpi label={dict.finance.approvals} value={formatBhd(sumFor(['APPROVED']), locale)} />
        <Kpi label={dict.finance.paid} value={formatBhd(sumFor(['PAID']), locale)} tone="success" />
      </div>
      <Panel bodyClassName="p-0">
        {expenses.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.reference}</th>
                  <th>{dict.finance.category}</th>
                  <th className="text-end">{dict.common.amount}</th>
                  <th>{dict.common.date}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td data-label={dict.common.reference} className="text-ink">
                      <span className="block">{e.description}</span>
                      <span className="block text-caption text-ink-faint">
                        {e.number}
                        {e.vendor ? ` · ${e.vendor}` : ''}
                      </span>
                    </td>
                    <td data-label={dict.finance.category} className="text-ink-muted">
                      {e.category ? (locale === 'ar' ? e.category.nameAr : e.category.nameEn) : '—'}
                    </td>
                    <td data-label={dict.common.amount} className="adm-num text-end">{formatBhd(e.amountBhd, locale)}</td>
                    <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDate(e.expenseDate, locale)}</td>
                    <td data-label={dict.common.status}><StatusBadge status={e.status} /></td>
                    <td data-label={dict.common.actions}>
                      <ExpenseRowActions id={e.id} status={e.status} canApprove={canApprove} locale={locale} dict={{ finance: dict.finance, common: dict.common }} />
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
