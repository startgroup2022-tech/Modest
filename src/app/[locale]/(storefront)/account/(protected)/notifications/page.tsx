import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyNotifications } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { EmptyState } from '@/components/ui/EmptyState';
import { BellIcon } from '@/components/ui/icons';

export default async function AccountNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const notifications = await getMyNotifications(user.customerId);

  if (!notifications.length) {
    return (
      <EmptyState
        icon={<BellIcon className="h-6 w-6" />}
        title={dict.account.noNotifications}
        body={dict.account.noNotificationsBody}
        actionLabel={dict.nav.shop}
        actionHref={`/${locale}/shop`}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-6 border-b border-line pb-3 text-h3">{dict.account.notifications}</h2>
      <ul className="divide-y divide-line">
        {notifications.map((n) => {
          const title = locale === 'ar' ? n.titleAr : n.titleEn;
          const body = locale === 'ar' ? n.bodyAr : n.bodyEn;
          const href = n.href?.startsWith('/') ? `/${locale}${n.href}` : n.href;
          const content = (
            <div className={n.readAt ? 'opacity-70' : ''}>
              <p className="text-body">{title}</p>
              {body ? <p className="mt-1 text-small text-ink-muted">{body}</p> : null}
              <p className="mt-1 text-caption text-ink-faint">{n.createdAt.toISOString().slice(0, 10)}</p>
            </div>
          );
          return (
            <li key={n.id} className="py-4">
              {href ? (
                <Link href={href} className="block transition-opacity hover:opacity-80">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
