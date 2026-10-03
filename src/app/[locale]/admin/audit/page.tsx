import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDate, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, AdminEmpty } from '@/components/admin/ui';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { SearchFilter, ClearFilters } from '@/components/admin/Filters';
import { adminHref } from '@/i18n/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Audit Logs', robots: { index: false, follow: false } };

type Row = Awaited<ReturnType<typeof loadLogs>>[0][number];

async function loadLogs(where: { action?: { contains: string } }, skip: number, take: number) {
  return Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('audit.view', locale);
  const dict = getAdminDict(locale);
  const sp = await searchParams;

  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const perPage = 40;
  const where = q ? { action: { contains: q } } : {};
  const [rows, total] = await loadLogs(where, (page - 1) * perPage, perPage);

  const columns: Column<Row>[] = [
    {
      key: 'actor',
      header: dict.system.actor,
      render: (l) => (
        <span className="block">
          <span className="block truncate text-ink">
            {l.user ? [l.user.firstName, l.user.lastName].filter(Boolean).join(' ') || l.user.email : '—'}
          </span>
          <span className="block text-caption text-ink-faint">{l.user?.email ?? ''}</span>
        </span>
      ),
    },
    { key: 'action', header: dict.system.action, render: (l) => <span className="adm-num text-ink-muted">{l.action}</span> },
    { key: 'entity', header: dict.system.entity, render: (l) => <span className="text-ink-muted">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}</span> },
    { key: 'ip', header: dict.system.ip, render: (l) => <span className="adm-num text-caption text-ink-faint">{l.ip ?? '—'}</span> },
    { key: 'at', header: dict.system.timestamp, render: (l) => <span className="text-caption text-ink-faint">{formatDate(l.createdAt, locale)}</span> },
  ];

  return (
    <>
      <PageHeader title={dict.audit.title} subtitle={dict.audit.subtitle} />
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <SearchFilter placeholder={`${dict.common.search}…`} className="w-full sm:w-64" />
          {q && <ClearFilters label={dict.common.clear} />}
          <span className="ms-auto text-caption text-ink-faint">{formatNumber(total, locale)} {dict.common.results}</span>
        </div>
        <AdminTable
          rows={rows}
          columns={columns}
          pathname={adminHref(locale, 'audit')}
          query={sp}
          empty={<AdminEmpty title={dict.audit.noLogs} />}
        />
      </Panel>
    </>
  );
}
