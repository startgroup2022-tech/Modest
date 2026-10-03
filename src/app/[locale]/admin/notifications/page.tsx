import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatRelative } from '@/lib/admin-format';
import { PageHeader, Panel, AdminEmpty } from '@/components/admin/ui';
import { MarkAllRead } from '@/components/admin/MarkAllRead';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notifications', robots: { index: false, follow: false } };

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('notifications.view', locale);
  const dict = getAdminDict(locale);

  const notifications = await prisma.staffNotification.findMany({
    where: { OR: [{ userId: admin.id }, { userId: null }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title={dict.system.notifications}
        subtitle={`${unread} ${dict.system.unread}`}
        actions={unread > 0 ? <MarkAllRead label={dict.system.markAllRead} /> : undefined}
      />
      <Panel bodyClassName="p-0">
        {notifications.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className={n.readAt ? '' : 'bg-paper-warm'}>
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <span
                    className={
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' + (n.readAt ? 'bg-transparent' : 'bg-ink')
                    }
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-small text-ink">{locale === 'ar' ? n.titleAr : n.titleEn}</p>
                    {(locale === 'ar' ? n.bodyAr : n.bodyEn) && (
                      <p className="mt-0.5 text-caption text-ink-muted">{locale === 'ar' ? n.bodyAr : n.bodyEn}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-caption text-ink-faint">{formatRelative(n.createdAt, locale)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
