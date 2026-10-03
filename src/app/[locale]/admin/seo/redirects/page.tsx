import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Redirects', robots: { index: false, follow: false } };

export default async function RedirectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('seo.view', locale);
  const dict = getAdminDict(locale);

  const redirects = await prisma.redirect.findMany({ orderBy: { createdAt: 'desc' } });

  const fields = (): FieldDef[] => [
    { key: 'fromPath', label: dict.seo.fromPath },
    { key: 'toPath', label: dict.seo.toPath },
    { key: 'statusCode', label: dict.seo.statusCode, type: 'number' },
    { key: 'isEnabled', label: dict.common.enabled, type: 'checkbox' },
  ];
  const blank = { fromPath: '', toPath: '', statusCode: 301, isEnabled: true };

  return (
    <>
      <PageHeader
        title={dict.seo.redirects}
        subtitle={dict.seo.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.seo.addRedirect}`} title={dict.seo.addRedirect}>
            <ResourceForm endpoint="/api/admin/redirects" initial={blank} fields={fields()} dict={{ common: dict.common }} transformKey="redirects" />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {redirects.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.seo.fromPath}</th>
                  <th>{dict.seo.toPath}</th>
                  <th className="text-end">{dict.seo.statusCode}</th>
                  <th className="text-end">{dict.common.total}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {redirects.map((r) => (
                  <tr key={r.id}>
                    <td data-label={dict.seo.fromPath} className="adm-num text-ink">{r.fromPath}</td>
                    <td data-label={dict.seo.toPath} className="adm-num text-ink-muted">{r.toPath}</td>
                    <td data-label={dict.seo.statusCode} className="adm-num text-end">{r.statusCode}</td>
                    <td data-label={dict.common.total} className="adm-num text-end text-ink-faint">{formatNumber(r.hits, locale)}</td>
                    <td data-label={dict.common.status}>
                      <StatusBadge status={r.isEnabled ? 'ACTIVE' : 'ARCHIVED'} label={r.isEnabled ? dict.common.enabled : dict.common.disabled} />
                    </td>
                    <td data-label={dict.common.actions}>
                      <span className="flex flex-wrap items-center gap-2">
                        <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                          <ResourceForm
                            endpoint="/api/admin/redirects"
                            initial={{ id: r.id, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, isEnabled: r.isEnabled }}
                            fields={fields()}
                            dict={{ common: dict.common }}
                            transformKey="redirects"
                          />
                        </Drawer>
                        <ActionButton endpoint={`/api/admin/redirects/${r.id}`} method="DELETE" variant="ghost" className="adm-btn-sm" confirm={`${dict.common.delete}? ${dict.common.irreversible}`}>
                          {dict.common.delete}
                        </ActionButton>
                      </span>
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
