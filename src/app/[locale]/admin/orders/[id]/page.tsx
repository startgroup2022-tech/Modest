import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { getOrderDetail } from '@/lib/admin/queries';
import { allowedTransitions } from '@/lib/admin/orders';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { formatBhd, formatDateTime, label } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/Filters';
import { OrderTimeline } from '@/components/admin/OrderTimeline';
import { OrderStatusActions } from '@/components/admin/OrderStatusActions';
import type { OrderStatus } from '@prisma/client';
import { RefundForm } from '@/components/admin/RefundForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order', robots: { index: false, follow: false } };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('orders.view', locale);
  const dict = getAdminDict(locale);
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const href = (p: string) => adminHref(locale, p);
  const transitions = allowedTransitions(order.status as OrderStatus);
  const canUpdate = admin.permissions.has('orders.edit');
  const paid = order.payments.find((p) => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED');
  const refunded = order.refunds.reduce((s, r) => s + Number(r.amountBhd), 0);

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${order.shippingName} · ${formatDateTime(order.createdAt, locale)}`}
        actions={
          <>
            <Link href={href('orders')} className="adm-btn-ghost">
              ← {dict.common.back}
            </Link>
            <StatusBadge status={order.status} label={label(order.status, locale)} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <Panel title={dict.orders.items} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="adm-table adm-table-responsive">
                <thead>
                  <tr>
                    <th>{dict.common.product}</th>
                    <th>{dict.common.sku}</th>
                    <th className="text-end">{dict.common.quantity}</th>
                    <th className="text-end">{dict.common.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td data-label={dict.common.product}>
                        <div className="flex items-center gap-3">
                          {it.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.imageUrl} alt="" className="h-12 w-10 object-cover" />
                          ) : (
                            <span className="h-12 w-10 bg-sand-100" aria-hidden />
                          )}
                          <span>
                            <span className="block text-ink">{it.productName}</span>
                            {it.variantLabel && <span className="block text-caption text-ink-faint">{it.variantLabel}</span>}
                          </span>
                        </div>
                      </td>
                      <td data-label={dict.common.sku} className="text-caption text-ink-muted">{it.sku ?? '—'}</td>
                      <td data-label={dict.common.quantity} className="adm-num text-end">{it.quantity}</td>
                      <td data-label={dict.common.amount} className="adm-num text-end">{formatBhd(it.unitPriceBhd, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-line px-5 py-4 text-small">
              <Row label={dict.quickOrders.subtotal} value={formatBhd(order.subtotalBhd, locale)} />
              {Number(order.discountBhd) > 0 && (
                <Row
                  label={`${dict.quickOrders.discount}${order.couponCode ? ` (${order.couponCode})` : ''}`}
                  value={`− ${formatBhd(order.discountBhd, locale)}`}
                />
              )}
              <Row label={dict.quickOrders.shipping} value={formatBhd(order.shippingBhd, locale)} />
              <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
                <span>{dict.quickOrders.total}</span>
                <span className="adm-num">{formatBhd(order.totalBhd, locale)}</span>
              </div>
              {order.presentmentCode !== 'BHD' && (
                <p className="text-caption text-ink-faint">
                  {dict.common.bhdEquivalent} · {order.presentmentCode} {Number(order.presentmentTotal).toFixed(3)} @ {Number(order.presentmentRate).toFixed(6)} ({formatDateTime(order.rateCapturedAt, locale)})
                </p>
              )}
            </div>
          </Panel>

          {/* Timeline */}
          <Panel title={dict.orders.timeline}>
            <OrderTimeline
              events={order.events.map((e) => ({
                id: e.id,
                status: e.status,
                message: locale === 'ar' ? e.messageAr ?? e.messageEn ?? '' : e.messageEn ?? e.messageAr ?? '',
                createdAt: e.createdAt.toISOString(),
              }))}
              locale={locale}
            />
          </Panel>

          {/* Payments */}
          <Panel title={dict.orders.payment} bodyClassName="p-0">
            {order.payments.length === 0 ? (
              <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
            ) : (
              <div className="overflow-x-auto">
                <table className="adm-table adm-table-responsive">
                  <thead>
                    <tr>
                      <th>{dict.common.method}</th>
                      <th>{dict.common.status}</th>
                      <th>{dict.common.reference}</th>
                      <th className="text-end">{dict.common.amount}</th>
                      <th>{dict.common.date}</th>
                      {canUpdate && <th>{dict.common.actions}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map((p) => (
                      <tr key={p.id}>
                        <td data-label={dict.common.method} className="text-ink">{label(p.method, locale)}</td>
                        <td data-label={dict.common.status}>
                          <StatusBadge status={p.status} label={label(p.status, locale)} />
                        </td>
                        <td data-label={dict.common.reference} className="text-caption text-ink-muted">{p.providerRef ?? '—'}</td>
                        <td data-label={dict.common.amount} className="adm-num text-end">{formatBhd(p.amountBhd, locale)}</td>
                        <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDateTime(p.createdAt, locale)}</td>
                        {canUpdate && (
                          <td data-label={dict.common.actions}>
                            <div className="flex flex-wrap gap-2">
                              {p.status !== 'PAID' && (p.status === 'INITIATED' || p.status === 'PENDING') && (
                                <ActionButton
                                  endpoint={`/api/admin/payments/${p.id}`}
                                  method="PATCH"
                                  body={{ status: 'PAID' }}
                                  variant="primary"
                                  className="adm-btn-sm"
                                  successMessage={locale === 'ar' ? 'تم تأكيد الدفع' : 'Payment confirmed'}
                                >
                                  {dict.finance.confirm}
                                </ActionButton>
                              )}
                              {p.status !== 'FAILED' && p.status !== 'PAID' && (
                                <ActionButton
                                  endpoint={`/api/admin/payments/${p.id}`}
                                  method="PATCH"
                                  body={{ status: 'FAILED' }}
                                  variant="ghost"
                                  className="adm-btn-sm"
                                  successMessage={locale === 'ar' ? 'تم التحديث' : 'Updated'}
                                >
                                  {dict.finance.markFailed}
                                </ActionButton>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Refunds */}
          {order.refunds.length > 0 && (
            <Panel title={dict.finance.refunds} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="adm-table adm-table-responsive">
                  <thead>
                    <tr>
                      <th>{dict.common.amount}</th>
                      <th>{dict.common.method}</th>
                      <th>{dict.common.reason}</th>
                      <th>{dict.common.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.refunds.map((r) => (
                      <tr key={r.id}>
                        <td data-label={dict.common.amount} className="adm-num">{formatBhd(r.amountBhd, locale)}</td>
                        <td data-label={dict.common.method} className="text-ink-muted">{label(r.method, locale)}</td>
                        <td data-label={dict.common.reason} className="text-ink-muted">{r.reason ?? '—'}</td>
                        <td data-label={dict.common.date} className="text-caption text-ink-faint">{formatDateTime(r.createdAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Panel title={dict.orders.updateStatus}>
            <OrderStatusActions
              orderId={order.id}
              current={order.status as OrderStatus}
              transitions={transitions}
              locale={locale}
              labels={{
                update: dict.orders.updateStatus,
                advance: dict.orders.advance,
                cancel: dict.orders.cancelOrder,
                cancelReason: dict.orders.cancelReason,
                markShipped: dict.orders.markShipped,
                markDelivered: dict.orders.markDelivered,
                trackingNumber: dict.orders.trackingNumber,
                carrier: dict.orders.carrier,
                blocked: dict.orders.transitionBlocked,
                confirmCancel: dict.orders.confirmCancel,
                note: dict.common.notes,
                apply: dict.common.apply,
                canUpdate,
              }}
            />
          </Panel>

          <Panel title={dict.common.customer}>
            <dl className="space-y-2 text-small">
              <Row label={dict.common.customer} value={order.shippingName} />
              <Row label="Email" value={order.email} />
              <Row label="Phone" value={order.phone} />
              {order.customer && (
                <div className="pt-1">
                  <Link href={href(`customers/${order.customer.id}`)} className="link-underline text-small text-ink">
                    {locale === 'ar' ? 'عرض ملف العميل' : 'View customer profile'}
                  </Link>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title={dict.orders.shipping}>
            <address className="text-small not-italic leading-relaxed text-ink-muted">
              <span className="block text-ink">{order.shippingName}</span>
              {order.shippingBuilding && <span className="block">{order.shippingBuilding}</span>}
              {order.shippingUnit && <span className="block">{order.shippingUnit}</span>}
              <span className="block">{order.shippingAddress}</span>
              {order.shippingArea && <span className="block">{order.shippingArea}</span>}
              <span className="block">
                {order.shippingCity}, {order.shippingCountry}
              </span>
            </address>
            {order.trackingNumber && (
              <div className="mt-3 border-t border-line pt-3 text-small">
                <Row label={dict.orders.carrier} value={order.carrier ?? '—'} />
                <Row label={dict.orders.trackingNumber} value={order.trackingNumber} />
              </div>
            )}
          </Panel>

          <Panel title={dict.common.notes}>
            <div className="space-y-3 text-small">
              <div>
                <p className="adm-kpi-label">{dict.orders.customerNotes}</p>
                <p className="mt-1 text-ink-muted">{order.notes || '—'}</p>
              </div>
              <div>
                <p className="adm-kpi-label">{dict.orders.internalNotes}</p>
                <p className="mt-1 text-ink-muted">{order.internalNotes || '—'}</p>
              </div>
            </div>
          </Panel>

          <Panel title={dict.common.amount}>
            <dl className="space-y-2 text-small">
              <Row label={dict.common.channel} value={label(order.channel, locale)} />
              <Row label={dict.common.total} value={formatBhd(order.totalBhd, locale)} />
              {paid && <Row label={dict.finance.paid} value={formatBhd(paid.amountBhd, locale)} />}
              {refunded > 0 && <Row label={dict.finance.refunds} value={formatBhd(refunded, locale)} />}
              {order.createdBy && (
                <Row
                  label={dict.orders.createdBy}
                  value={[order.createdBy.firstName, order.createdBy.lastName].filter(Boolean).join(' ') || order.createdBy.email}
                />
              )}
            </dl>
          </Panel>

          {admin.permissions.has('orders.refund') && paid && (
            <Panel title={dict.finance.issueRefund}>
              <RefundForm orderId={order.id} max={Number(order.totalBhd) - refunded} locale={locale} dict={dict} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-faint">{label}</dt>
      <dd className="text-end text-ink">{value}</dd>
    </div>
  );
}

