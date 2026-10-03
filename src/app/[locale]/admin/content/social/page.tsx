import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatDateTime, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, Kpi, StatusBadge, AdminEmpty } from '@/components/admin/ui';

import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Social Links', robots: { index: false, follow: false } };

export default async function SocialPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('content.view', locale);
  const dict = getAdminDict(locale);
  const labelTitle = locale === 'ar' ? 'التسمية' : 'Label';

  const links = await prisma.socialLink.findMany({ orderBy: { sortOrder: 'asc' } });

  const fields = (): FieldDef[] => [
    { key: 'platform', label: dict.content.platform },
    { key: 'url', label: dict.content.url, type: 'url' },
    { key: 'labelEn', label: `${labelTitle} (EN)` },
    { key: 'labelAr', label: `${labelTitle} (AR)` },
    { key: 'sortOrder', label: dict.content.sortOrder, type: 'number' },
    { key: 'isActive', label: dict.common.enabled, type: 'checkbox' },
  ];
  const blank = { platform: '', url: '', labelEn: '', labelAr: '', sortOrder: 0, isActive: true };

  return (
    <>
      <PageHeader
        title={dict.content.social}
        subtitle={dict.content.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.content.social}>
            <ResourceForm endpoint="/api/admin/content/social" initial={blank} fields={fields()} dict={{ common: dict.common }} transformKey="social" />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {links.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.content.platform}</th>
                  <th>{dict.content.url}</th>
                  <th className="text-end">{dict.content.sortOrder}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const initial = { id: l.id, platform: l.platform, url: l.url, labelEn: l.labelEn ?? '', labelAr: l.labelAr ?? '', sortOrder: l.sortOrder, isActive: l.isActive };
                  return (
                    <tr key={l.id}>
                      <td data-label={dict.content.platform} className="text-ink">{l.platform}</td>
                      <td data-label={dict.content.url} className="text-caption text-ink-muted">{l.url}</td>
                      <td data-label={dict.content.sortOrder} className="adm-num text-end">{l.sortOrder}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={l.isActive ? 'ACTIVE' : 'ARCHIVED'} label={l.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <ResourceForm endpoint="/api/admin/content/social" initial={initial} fields={fields()} dict={{ common: dict.common }} transformKey="social" />
                          </Drawer>
                          <ActionButton endpoint={`/api/admin/content/social/${l.id}`} method="DELETE" variant="ghost" className="adm-btn-sm" confirm={`${dict.common.delete}? ${dict.common.irreversible}`}>
                            {dict.common.delete}
                          </ActionButton>
                        </span>
                      </td>
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
