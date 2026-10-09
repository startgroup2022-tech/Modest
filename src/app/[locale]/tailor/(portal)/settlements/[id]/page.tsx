import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess } from '@/lib/tailor-principal';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { getTailorSettlement } from '@/lib/settlements';
import { TailorActionButton } from '@/components/tailor/TailorActionButton';
import { formatDate, settlementStatusLabel } from '@/components/tailor/TailorTaskRow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TailorSettlementDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const ar = locale === 'ar';

  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword) redirect(`/${locale}/tailor/password`);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor/settlements/${id}`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');
  const access = await resolveTailorAccess(requested);
  if (!access) redirect(`/${locale}/tailor/sign-in`);

  const settlement = await getTailorSettlement(access.tailorId, id);
  if (!settlement) notFound();

  const qs = access.supervisor ? `?tailorId=${access.tailorId}` : '';
  const canConfirm = access.canWrite && settlement.status === 'PAID' && !settlement.confirmedByTailorAt;

  const rows: { label: string; value: string }[] = [
    { label: ar ? 'الحالة' : 'Status', value: settlementStatusLabel(settlement.status, locale) },
    { label: ar ? 'عدد القطع' : 'Pieces', value: String(settlement.items.length) },
    { label: ar ? 'الإجمالي' : 'Gross', value: `${settlement.grossBhd.toFixed(3)} BHD` },
    { label: ar ? 'التعديلات' : 'Adjustments', value: `${settlement.adjustmentsBhd.toFixed(3)} BHD` },
    { label: ar ? 'الصافي' : 'Net', value: `${settlement.netBhd.toFixed(3)} BHD` },
    { label: ar ? 'المدفوع' : 'Paid', value: `${settlement.paidBhd.toFixed(3)} BHD` },
  ];
  if (settlement.transferReference) rows.push({ label: ar ? 'مرجع التحويل' : 'Transfer reference', value: settlement.transferReference });
  if (settlement.transferredAt) rows.push({ label: ar ? 'تاريخ التحويل' : 'Transferred', value: formatDate(settlement.transferredAt, locale) });
  if (settlement.paidAt) rows.push({ label: ar ? 'تاريخ الدفع' : 'Paid on', value: formatDate(settlement.paidAt, locale) });
  if (settlement.confirmedByTailorAt) rows.push({ label: ar ? 'أكّدت الاستلام' : 'Confirmed', value: formatDate(settlement.confirmedByTailorAt, locale) });

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/${locale}/tailor/settlements${qs}`} className="link-underline text-small text-ink-muted">
          {ar ? '→ كل التسويات' : '← All settlements'}
        </Link>
        <h1 className="mt-3 text-h2">{settlement.number}</h1>
      </div>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="border border-line p-5">
          <h2 className="mb-4 text-h4">{ar ? 'الملخص' : 'Summary'}</h2>
          <dl className="space-y-2 text-small">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 border-b border-line/60 pb-2">
                <dt className="text-ink-faint">{r.label}</dt>
                <dd className="text-end text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border border-line p-5">
          <h2 className="mb-4 text-h4">{ar ? 'القطع' : 'Pieces'}</h2>
          <ul className="space-y-2 text-small">
            {settlement.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 border-b border-line/60 pb-2">
                <span className="text-ink">
                  {item.productName}
                  {item.variantLabel ? ` · ${item.variantLabel}` : ''}
                </span>
                <span className="shrink-0 text-ink-muted">{item.feeBhd.toFixed(3)} BHD</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {settlement.notes ? (
        <section className="border border-line p-5">
          <h2 className="mb-2 text-h4">{ar ? 'ملاحظات' : 'Notes'}</h2>
          <p className="whitespace-pre-line text-small text-ink-muted">{settlement.notes}</p>
        </section>
      ) : null}

      {canConfirm ? (
        <section className="border-t border-line pt-6">
          <p className="mb-3 text-small text-ink-muted">
            {ar ? 'تأكيد الاستلام يغلق هذه التسوية.' : 'Confirming receipt closes this settlement.'}
          </p>
          <TailorActionButton
            endpoint={`/api/tailor/settlements/${settlement.id}/confirm`}
            variant="primary"
            confirm={ar ? 'هل تؤكد استلام هذا المبلغ؟' : 'Confirm you have received this payment?'}
          >
            {ar ? 'تأكيد الاستلام' : 'Confirm receipt'}
          </TailorActionButton>
        </section>
      ) : settlement.status === 'PAID' && settlement.confirmedByTailorAt ? (
        <p className="border border-line bg-paper px-4 py-3 text-caption text-ink-muted">
          {ar ? 'تم تأكيد استلامك لهذه التسوية.' : 'You have confirmed receipt of this settlement.'}
        </p>
      ) : null}
    </div>
  );
}
