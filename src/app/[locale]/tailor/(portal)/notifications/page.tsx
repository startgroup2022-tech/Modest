import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess } from '@/lib/tailor-principal';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { prisma } from '@/lib/prisma';
import { TailorNotificationList } from '@/components/tailor/TailorNotificationList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TailorNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const ar = locale === 'ar';

  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword) redirect(`/${locale}/tailor/password`);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor/notifications`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');
  const access = await resolveTailorAccess(requested);
  if (!access) redirect(`/${locale}/tailor/sign-in`);

  const rows = await prisma.tailorNotification.findMany({
    where: { tailorId: access.tailorId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const items = rows.map((n) => ({
    id: n.id,
    eventKey: n.eventKey,
    titleEn: n.titleEn,
    titleAr: n.titleAr,
    bodyEn: n.bodyEn,
    bodyAr: n.bodyAr,
    href: n.href,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-h3">{ar ? 'الإشعارات' : 'Notifications'}</h2>
      <TailorNotificationList items={items} locale={locale} readOnly={!access.canWrite} />
    </div>
  );
}
