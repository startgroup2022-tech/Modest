import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess } from '@/lib/tailor-principal';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { listTailorSettlements } from '@/lib/settlements';
import { formatDate, settlementStatusLabel } from '@/components/tailor/TailorTaskRow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TailorSettlementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const ar = locale === 'ar';

  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword) redirect(`/${locale}/tailor/password`);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor/settlements`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');
  const access = await resolveTailorAccess(requested);
  if (!access) redirect(`/${locale}/tailor/sign-in`);

  const settlements = await listTailorSettlements(access.tailorId);
  const qs = access.supervisor ? `?tailorId=${access.tailorId}` : '';

  return (
    <div className="space-y-6">
      <h2 className="text-h3">{ar ? 'تسوياتك' : 'Your settlements'}</h2>
      {settlements.length === 0 ? (
        <p className="border border-line p-6 text-center text-ink-muted">
          {ar ? 'لا توجد تسويات بعد.' : 'No settlements yet.'}
        </p>
      ) : (
        <ul className="border-t border-line">
          {settlements.map((s) => (
            <li key={s.id}>
              <Link
                href={`/${locale}/tailor/settlements/${s.id}${qs}`}
                className="flex flex-col gap-2 border-b border-line py-4 hover:bg-paper md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <span className="font-mono text-caption text-ink-faint">{s.number}</span>
                  <p className="text-body">
                    {s.itemsCount} {ar ? 'قطعة' : s.itemsCount === 1 ? 'piece' : 'pieces'} ·{' '}
                    {settlementStatusLabel(s.status, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-small">
                  <div className="text-end">
                    <p className="text-caption text-ink-faint">{ar ? 'التاريخ' : 'Date'}</p>
                    <p>{formatDate(s.createdAt, locale)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-caption text-ink-faint">{ar ? 'الصافي' : 'Net'}</p>
                    <p className="text-ink">{s.netBhd.toFixed(3)} BHD</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
