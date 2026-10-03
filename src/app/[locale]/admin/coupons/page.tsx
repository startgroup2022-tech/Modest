import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDate, formatNumber, label } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer, ActionButton } from '@/components/admin/Filters';
import { ResourceForm, type FieldDef } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Coupons', robots: { index: false, follow: false } };

export default async function CouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('promotions.view', locale);
  const dict = getAdminDict(locale);
  const p = dict.promotions;

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });

  const fields = (initial: Record<string, unknown>): FieldDef[] => [
    { key: 'code', label: p.code },
    { key: 'discountType', label: p.discountType, type: 'select', options: [
      { value: 'PERCENTAGE', label: p.percentage },
      { value: 'FIXED', label: p.fixed },
      { value: 'FREE_SHIPPING', label: p.freeShipping },
    ] },
    { key: 'valueBhd', label: p.value, type: 'number', step: '0.001' },
    { key: 'minOrderBhd', label: p.minOrder, type: 'number', step: '0.001' },
    { key: 'maxDiscountBhd', label: p.maxDiscount, type: 'number', step: '0.001' },
    { key: 'usageLimit', label: p.usageLimit, type: 'number' },
    { key: 'perCustomerLimit', label: p.perCustomer, type: 'number' },
    { key: 'startsAt', label: p.startsAt, type: 'date' },
    { key: 'expiresAt', label: p.expiresAt, type: 'date' },
    { key: 'descriptionEn', label: `${dict.common.notes} (EN)`, type: 'textarea', full: true },
    { key: 'descriptionAr', label: `${dict.common.notes} (AR)`, type: 'textarea', full: true },
    { key: 'isActive', label: dict.common.enabled, type: 'checkbox' },
  ];


  const blank = {
    code: '', discountType: 'PERCENTAGE', valueBhd: '', minOrderBhd: '', maxDiscountBhd: '',
    usageLimit: '', perCustomerLimit: '', startsAt: '', expiresAt: '', descriptionEn: '', descriptionAr: '', isActive: true,
  };

  return (
    <>
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        actions={
          <Drawer trigger={`+ ${p.newCoupon}`} title={p.newCoupon} wide>
            <ResourceForm endpoint="/api/admin/coupons" initial={blank} fields={fields(blank)} dict={{ common: dict.common }} transformKey="coupons" />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {coupons.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{p.code}</th>
                  <th>{p.discountType}</th>
                  <th className="text-end">{p.value}</th>
                  <th className="text-end">{p.used}</th>
                  <th>{p.expiresAt}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const initial = {
                    id: c.id, code: c.code, discountType: c.discountType,
                    valueBhd: String(c.valueBhd), minOrderBhd: c.minOrderBhd == null ? '' : String(c.minOrderBhd),
                    maxDiscountBhd: c.maxDiscountBhd == null ? '' : String(c.maxDiscountBhd),
                    usageLimit: c.usageLimit == null ? '' : String(c.usageLimit),
                    perCustomerLimit: c.perCustomerLimit == null ? '' : String(c.perCustomerLimit),
                    startsAt: c.startsAt ? c.startsAt.toISOString().slice(0, 10) : '',
                    expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : '',
                    descriptionEn: c.descriptionEn ?? '', descriptionAr: c.descriptionAr ?? '', isActive: c.isActive,
                  };
                  return (
                    <tr key={c.id}>
                      <td data-label={p.code} className="adm-num text-ink">{c.code}</td>
                      <td data-label={p.discountType} className="text-ink-muted">{label(c.discountType, locale)}</td>
                      <td data-label={p.value} className="adm-num text-end">
                        {c.discountType === 'PERCENTAGE' ? `${formatNumber(c.valueBhd, locale)}%` : formatBhd(c.valueBhd, locale)}
                      </td>
                      <td data-label={p.used} className="adm-num text-end">
                        {formatNumber(c.usedCount, locale)}
                        {c.usageLimit ? ` / ${formatNumber(c.usageLimit, locale)}` : ''}
                      </td>
                      <td data-label={p.expiresAt} className="text-caption text-ink-muted">{c.expiresAt ? formatDate(c.expiresAt, locale) : '—'}</td>
                      <td data-label={dict.common.status}>
                        <StatusBadge status={c.isActive ? 'ACTIVE' : 'ARCHIVED'} label={c.isActive ? dict.common.enabled : dict.common.disabled} />
                      </td>
                      <td data-label={dict.common.actions}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Drawer trigger={dict.common.edit} title={dict.common.edit}>
                            <ResourceForm endpoint="/api/admin/coupons" initial={initial} fields={fields(initial)} dict={{ common: dict.common }} transformKey="coupons" />
                          </Drawer>
                          <ActionButton endpoint={`/api/admin/coupons/${c.id}`} method="DELETE" variant="ghost" className="adm-btn-sm" confirm={`${dict.common.delete}? ${dict.common.irreversible}`}>
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
