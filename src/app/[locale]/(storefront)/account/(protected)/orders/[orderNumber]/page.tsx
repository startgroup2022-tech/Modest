import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyOrder } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { OrderPrice } from '@/components/ui/OrderPrice';
import { OrderTimeline } from '@/components/account/OrderTimeline';
import { customerPaymentStatusKey, toCustomerTimeline } from '@/lib/order-status';
import type { Dict } from '@/i18n/dictionaries';

/** Localised label for a payment method using the checkout dictionary keys. */
const PAYMENT_METHOD_KEY: Record<string, keyof Dict['checkout']> = {
  COD: 'cod',
  BANK_TRANSFER: 'bankTransfer',
  BENEFIT: 'benefit',
  TAPP: 'tapp',
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale: raw, orderNumber } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const order = await getMyOrder(user.customerId, orderNumber);
  if (!order) notFound();

  const payment = order.payments[0];
  const money = { code: order.presentmentCode, rate: Number(order.presentmentRate) };

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/${locale}/account/orders`} className="link-underline text-caption uppercase tracking-[0.14em] text-ink-muted">
          ← {dict.account.backToOrders}
        </Link>
        <h2 className="mt-4 text-h2">{dict.account.orderDetails}</h2>
        <p className="mt-1 text-small text-ink-muted">
          {order.orderNumber} · {order.createdAt.toISOString().slice(0, 10)}
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_300px] lg:gap-16">
        <div className="space-y-10">
          {/* Items */}
          <section>
            <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.order.items}</h3>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-sand-50">
                    {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body">{item.productName}</p>
                    {item.variantLabel ? <p className="text-caption text-ink-muted">{item.variantLabel}</p> : null}
                    {item.sku ? <p className="text-caption text-ink-faint">{item.sku}</p> : null}
                    <p className="mt-1 text-caption text-ink-muted">
                      {dict.cart.quantity}: {item.quantity}
                    </p>
                  </div>
                  <OrderPrice amountBhd={Number(item.lineTotalBhd)} code={money.code} rate={money.rate} locale={locale} className="text-small" />
                </li>
              ))}
            </ul>
          </section>

          {/* Totals */}
          <section>
            <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.cart.orderSummary}</h3>
            <dl className="space-y-3 text-small">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{dict.cart.subtotal}</dt>
                <dd className="tabular-nums">
                  <OrderPrice amountBhd={Number(order.subtotalBhd)} code={money.code} rate={money.rate} locale={locale} />
                </dd>
              </div>
              {Number(order.discountBhd) > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>
                    {dict.cart.discount}
                    {order.couponCode ? ` (${order.couponCode})` : ''}
                  </dt>
                  <dd className="tabular-nums">
                    − <OrderPrice amountBhd={Number(order.discountBhd)} code={money.code} rate={money.rate} locale={locale} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-muted">{dict.cart.shipping}</dt>
                <dd className="tabular-nums">
                  {Number(order.shippingBhd) === 0 ? (
                    dict.cart.free
                  ) : (
                    <OrderPrice amountBhd={Number(order.shippingBhd)} code={money.code} rate={money.rate} locale={locale} />
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-h4">
                <dt>{dict.cart.total}</dt>
                <dd className="tabular-nums">
                  <OrderPrice amountBhd={Number(order.totalBhd)} code={money.code} rate={money.rate} locale={locale} />
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-caption text-ink-faint">
              {dict.cart.taxIncluded} · {Number(order.totalBhd).toFixed(3)} BHD
            </p>
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.order.timeline}</h3>
            <OrderTimeline currentStatus={order.status} dict={dict} events={toCustomerTimeline(order.events)} />
          </section>

          <section>
            <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.checkout.payment}</h3>
            <dl className="space-y-2 text-small">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{dict.order.paymentMethod}</dt>
                <dd>{payment ? dict.checkout[PAYMENT_METHOD_KEY[payment.method] ?? 'paymentMethod'] : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{dict.order.paymentStatus}</dt>
                <dd>
                  {payment
                    ? dict.order[customerPaymentStatusKey(payment.status) as keyof Dict['order']]
                    : dict.order.paymentPending}
                </dd>
              </div>
              {payment?.providerRef ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{dict.order.paymentReference}</dt>
                  <dd className="truncate text-end">{payment.providerRef}</dd>
                </div>
              ) : null}
            </dl>
            {payment?.paymentUrl && payment.status !== 'PAID' ? (
              <a href={payment.paymentUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 w-full">
                {dict.checkout.payNow}
              </a>
            ) : null}
          </section>

          {order.refunds.length > 0 ? (
            <section>
              <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.order.amountRefunded}</h3>
              <ul className="space-y-2 text-small">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-4">
                    <span className="text-ink-muted">{r.createdAt.toISOString().slice(0, 10)}</span>
                    <OrderPrice
                      amountBhd={Number(r.amountBhd)}
                      code={money.code}
                      rate={money.rate}
                      locale={locale}
                      className="tabular-nums"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.order.shippingAddress}</h3>
            <address className="text-small not-italic text-ink-muted">
              <p className="text-ink">{order.shippingName}</p>
              <p>{order.shippingAddress}</p>
              {order.shippingBuilding ? <p>{dict.checkout.building}: {order.shippingBuilding}</p> : null}
              {order.shippingUnit ? <p>{dict.checkout.unit}: {order.shippingUnit}</p> : null}
              {order.shippingArea ? <p>{order.shippingArea}</p> : null}
              <p>
                {order.shippingCity}, {order.shippingCountry}
              </p>
              <p className="mt-2 tabular-nums">{order.phone}</p>
              <p>{order.email}</p>
            </address>
          </section>

          {order.notes ? (
            <section>
              <h3 className="eyebrow mb-4 border-b border-line pb-3">{dict.checkout.notes}</h3>
              <p className="text-small text-ink-muted">{order.notes}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
