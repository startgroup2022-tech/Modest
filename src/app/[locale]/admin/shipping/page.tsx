import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatNumber } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shipping', robots: { index: false, follow: false } };

export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('shipping.view', locale);
  const dict = getAdminDict(locale);
  const nameLabel = locale === 'ar' ? 'الاسم' : 'Name';

  const methods = await prisma.shippingMethod.findMany({ orderBy: { sortOrder: 'asc' } });

  const fields = (): FieldDef[] => [
    { key: 'code', label: 'Code' },
    { key: 'nameEn', label: `${nameLabel} (EN)` },
    { key: 'nameAr', label: `${nameLabel} (AR)` },
    { key: 'priceBhd', label: `${dict.common.amount} (BHD)`, type: 'number', step: '0.001' },
    { key: 'freeOverBhd', label: 'Free over (BHD)', type: 'number', step: '0.001' },
    { key: 'courier', label: 'Courier' },
    { key: 'etaMinDays', label: 'ETA min (days)', type: 'number' },
    { key: 'etaMaxDays', label: 'ETA max (days)', type: 'number' },
    { key: 'sortOrder', label: 'Sort order', type: 'number' },
    { key: 'descriptionEn', label: `${dict.common.notes} (EN)`, type: 'textarea', full: true },
    { key: 'descriptionAr', label: `${dict.common.notes} (AR)`, type: 'textarea', full: true },
    { key: 'isActive', label: dict.common.enabled, type: 'checkbox' },
  ];
  const blank = { code: '', nameEn: '', nameAr: '', priceBhd: 0, freeOverBhd: '', courier: '', etaMinDays: 2, etaMaxDays: 5, sortOrder: 0, descriptionEn: '', descriptionAr: '', isActive: true };

  return (
    <>
      <PageHeader
        title={dict.system.shippingMethods}
        subtitle={dict.inventory.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.common.create}`} title={dict.system.shippingMethods} wide>
            <ResourceForm endpoint="/api/admin/shipping" initial={blank} fields={fields()} dict={{ common: dict.common }} transformKey="shipping" />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {methods.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.system.shippingMethods}</th>
                  <th>Courier</th>
                  <th className="text-end">{dict.common.amount}</th>
                  <th>ETA</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => {
                  const initial = {
                    id: m.id, code: m.code, nameEn: m.nameEn, nameAr: m.nameAr, priceBhd: String(m.priceBhd),
                    freeOverBhd: m.freeOverBhd == null ? '' : String(m.freeOverBhd), courier: m.courier ?? '',
                    etaMinDays: m.etaMinDays, etaMaxDays: m.etaMaxDays, sortOrder: m.sortOrder,
                    descriptionEn: m.descriptionEn ?? '', descriptionAr: m.descriptionAr ?? '', isActive: m.isActive,
                  };
                  return (
                    <tr key={m.id}>
                      <td data-label={dict.system.shippingMethods} className="text-ink">
                        <span className="block">{locale === 'ar' ? m.nameAr : m.nameEn}</span>
                        <span className="block text-caption text-ink-faint">{m.code}</span>
                      </td>
                      <td data-label="Courier" className="text-ink-muted">{m.courier ?? '—'}</td>
                      <td data-label={dict.common.amount} className="adm-num text-end">{formatBhd(m.priceBhd, locale)}</td>
                      <td data-label="ETA" className="text-caption text-ink-muted">{m.etaMinDays}–{m.etaMaxDays} {locale === 'ar' ? 'يوم' : 'days'}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={m.isActive ? 'ACTIVE' : 'ARCHIVED'} label={m.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <ResourceForm endpoint="/api/admin/shipping" initial={initial} fields={fields()} dict={{ common: dict.common }} transformKey="shipping" />
                          </Drawer>
                          <ActionButton endpoint={`/api/admin/shipping/${m.id}`} method="DELETE" variant="ghost" className="adm-btn-sm">
                            {dict.common.disabled}
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
