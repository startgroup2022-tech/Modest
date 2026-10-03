import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { CheckIcon, PackageIcon, WhatsAppIcon } from '@/components/ui/icons';
import { getStoreInfo } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.checkout.success, robots: { index: false, follow: false } };
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const orderNumber = typeof sp.order === 'string' ? sp.order : '';

  const [order, store] = await Promise.all([
    orderNumber
      ? prisma.order.findUnique({
          where: { orderNumber },
          include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        })
      : null,
    getStoreInfo(),
  ]);

  const payment = order?.payments[0];
  const instructions =
    payment && (payment.method === 'BANK_TRANSFER' || payment.method === 'BENEFIT')
      ? await (async () => {
          const key = payment.method === 'BANK_TRANSFER' ? 'bank_transfer_details' : 'benefit_details';
          const row = await prisma.siteSetting.findUnique({ where: { key } });
          return (row?.value ?? {}) as Record<string, string>;
        })()
      : null;

  return (
    <div className="shell flex min-h-[70vh] max-w-2xl flex-col items-center justify-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-ink">
        <CheckIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-h1">{dict.checkout.success}</h1>
      <p className="mt-3 text-body text-ink-muted">{dict.checkout.successBody}</p>

      {order ? (
        <dl className="mt-8 w-full space-y-3 border-y border-line py-6 text-start text-small">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.checkout.orderNumber}</dt>
            <dd className="font-medium tabular-nums">{order.orderNumber}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.order.paymentMethod}</dt>
            <dd>{payment?.method.replace('_', ' ') ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.order.paymentStatus}</dt>
            <dd>{payment?.status ?? 'PENDING'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">{dict.order.items}</dt>
            <dd>{order.items.length}</dd>
          </div>
          <div className="flex items-center justify-between text-h4">
            <dt>{dict.cart.total}</dt>
            <dd className="tabular-nums">
              {Number(order.totalBhd).toFixed(3)} {order.presentmentCode}
            </dd>
          </div>
        </dl>
      ) : null}

      {instructions && (instructions.iban || instructions.alias || instructions.accountNumber) ? (
        <div className="mt-6 w-full border border-line bg-paper-warm p-5 text-start text-small text-ink-muted">
          <p className="eyebrow mb-3">{payment?.method === 'BANK_TRANSFER' ? dict.checkout.bankTransfer : dict.checkout.benefit}</p>
          {instructions.bankName ? <p>{instructions.bankName}</p> : null}
          {instructions.accountName ? <p>{instructions.accountName}</p> : null}
          {instructions.iban ? <p className="tabular-nums">IBAN: {instructions.iban}</p> : null}
          {instructions.alias ? <p>Alias: {instructions.alias}</p> : null}
          {instructions.accountNumber ? <p className="tabular-nums">{instructions.accountNumber}</p> : null}
          <p className="mt-2 text-caption text-ink-faint">
            {locale === 'ar' ? 'اذكري رقم الطلب في المرجع.' : 'Please include your order number as the reference.'}
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {order ? (
          <Link href={`/${locale}/account/orders/${order.orderNumber}`} className="btn-primary">
            {dict.checkout.viewOrder}
          </Link>
        ) : null}
        <Link href={`/${locale}/shop`} className="btn-outline">
          {dict.checkout.continueShopping}
        </Link>
      </div>

      <a
        href={store.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex items-center gap-2 text-small text-ink-muted transition-colors hover:text-ink"
      >
        <WhatsAppIcon className="h-4 w-4" />
        {dict.product.whatsappHelp}
      </a>

      <span className="sr-only">
        <PackageIcon />
      </span>
    </div>
  );
}
