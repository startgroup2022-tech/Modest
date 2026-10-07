import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveQuickOrderLink, toQuickOrderProduct, recordQuickOrderLinkOpen } from '@/lib/quick-order-db';
import { isValidTokenFormat } from '@/lib/quick-order';
import { getShippingMethods } from '@/lib/site';
import { listEnabledPaymentMethods } from '@/lib/payments';
import { getCurrentUser } from '@/lib/auth';
import { getMyMeasurements } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuickOrderForm } from '@/components/quick-order/QuickOrderForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // Private, shareable link — never indexed.
  return { title: getDictionary(locale).quickOrder.title, robots: { index: false, follow: false } };
}

export default async function QuickOrderPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: raw, token } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const t = dict.quickOrder;

  if (!isValidTokenFormat(token)) {
    return <Message title={t.invalidTitle} body={t.invalidBody} actionLabel={dict.cart.startShopping} actionHref={`/${locale}/shop`} />;
  }

  const resolved = await resolveQuickOrderLink(token);
  if (!resolved.ok) {
    if (resolved.reason === 'REVOKED') {
      return <Message title={t.revokedTitle} body={t.revokedBody} actionLabel={dict.common.contactUs} actionHref={`/${locale}/contact`} />;
    }
    if (resolved.reason === 'EXPIRED') {
      return <Message title={t.expiredTitle} body={t.expiredBody} actionLabel={dict.common.contactUs} actionHref={`/${locale}/contact`} />;
    }
    if (resolved.reason === 'UNAVAILABLE') {
      return <Message title={t.unavailableTitle} body={t.unavailableBody} actionLabel={dict.cart.startShopping} actionHref={`/${locale}/shop`} />;
    }
    return <Message title={t.invalidTitle} body={t.invalidBody} actionLabel={dict.cart.startShopping} actionHref={`/${locale}/shop`} />;
  }

  // A used link shows the existing order rather than opening a second checkout.
  if (resolved.data.link.orderId) {
    return (
      <Message
        title={t.usedTitle}
        body={t.usedBody}
        actionLabel={t.viewOrder}
        actionHref={`/${locale}/account/orders`}
      />
    );
  }

  const [product, shipping, methods] = await Promise.all([
    toQuickOrderProduct(resolved.data.product, locale),
    getShippingMethods(),
    listEnabledPaymentMethods(),
  ]);

  // Signed-in customers can seed a piece from one of their own saved profiles.
  // Ownership is re-verified server-side at submit time; here we only offer the
  // profiles that actually belong to the signed-in customer.
  const user = await getCurrentUser();
  const profiles = user?.customerId
    ? (await getMyMeasurements(user.customerId))
        .filter((m) => m.values && typeof m.values === 'object')
        .map((m) => ({
          id: m.id,
          name: m.name,
          cutId: m.cutId ?? null,
          values: m.values as Record<string, number>,
        }))
    : [];

  // Stamp the open so the staff console reflects real usage. Best-effort: a
  // failed write must never block the page the customer is trying to reach.
  await recordQuickOrderLinkOpen(resolved.data.link.id).catch(() => {});

  return (
    <div className="shell pt-10 md:pt-14">
      <header className="mb-8 border-b border-line pb-6">
        <p className="eyebrow text-ink-faint">{t.selectedFor}</p>
        <h1 className="mt-3 text-h1">{t.title}</h1>
        <p className="mt-3 max-w-prose text-small text-ink-muted">{t.lead}</p>
      </header>

      <QuickOrderForm
        locale={locale}
        dict={dict}
        token={token}
        product={product}
        profiles={profiles}
        showMeasurementsNote={product.madeToOrder}
        shipping={shipping.map((s) => ({
          code: s.code,
          name: locale === 'ar' ? s.nameAr : s.nameEn,
          priceBhd: Number(s.priceBhd),
          etaMin: s.etaMinDays,
          etaMax: s.etaMaxDays,
        }))}
        methods={methods.map((m) => ({
          method: m.method,
          label: locale === 'ar' ? m.labelAr : m.labelEn,
          description: locale === 'ar' ? m.descriptionAr : m.descriptionEn,
        }))}
      />
    </div>
  );
}

function Message({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="shell pt-16">
      <EmptyState title={title} body={body} actionLabel={actionLabel} actionHref={actionHref} />
    </div>
  );
}
