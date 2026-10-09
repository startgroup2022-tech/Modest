import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/config';
import { resolveTailorAccess, SUPERVISOR_PERMISSION } from '@/lib/tailor-principal';
import { getAdminUser } from '@/lib/admin-auth';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { prisma } from '@/lib/prisma';
import { TailorNav } from '@/components/tailor/TailorNav';
import { TailorSignOutButton } from '@/components/tailor/TailorSignOutButton';

export const dynamic = 'force-dynamic';

/** The portal is private — keep it out of search indexes entirely. */
export const metadata: Metadata = {
  title: 'Tailor Portal',
  robots: { index: false, follow: false, nocache: true },
};

function dict(locale: Locale) {
  const ar = locale === 'ar';
  return {
    dashboard: ar ? 'لوحة العمل' : 'Dashboard',
    tasks: ar ? 'المهام' : 'My work',
    settlements: ar ? 'التسويات' : 'Settlements',
    notifications: ar ? 'الإشعارات' : 'Notifications',
    signOut: ar ? 'تسجيل الخروج' : 'Sign out',
    portal: ar ? 'بوابة الخياطين' : 'Tailor Portal',
    supervisor: ar ? 'عرض للقراءة فقط' : 'Read-only supervisor view',
    viewing: ar ? 'تعرض بيانات' : 'Viewing',
    selectTailor: ar ? 'اختر خياطًا لعرض بوابته' : 'Choose a tailor to view',
    noTailors: ar ? 'لا يوجد خياطون.' : 'No tailors found.',
    open: ar ? 'فتح البوابة' : 'Open portal',
  };
}

export default async function TailorPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = dict(locale);

  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/tailor`;
  const requested = new URL(`http://x${pathname}`).searchParams.get('tailorId');

  // A tailor still holding a temporary password must set their own first. The
  // password page is the destination, so it must not bounce to itself.
  const onPasswordPage = pathname.split('?')[0].endsWith('/tailor/password');
  const tailor = await getCurrentTailor();
  if (tailor?.mustChangePassword && !onPasswordPage) redirect(`/${locale}/tailor/password`);

  const access = await resolveTailorAccess(requested);

  if (!access) {
    const admin = await getAdminUser();
    if (!admin) redirect(`/${locale}/tailor/sign-in`);

    // Staff without the supervisor permission, or a supervisor who has not yet
    // chosen a tailor, sees a picker rather than someone else's data.
    if (!admin.permissions.has(SUPERVISOR_PERMISSION)) redirect(`/${locale}/admin?denied=${SUPERVISOR_PERMISSION}`);

    const tailors = await prisma.tailor.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { nameEn: 'asc' },
      select: { id: true, nameEn: true, nameAr: true, code: true },
    });

    return (
      <div className="shell py-12 md:py-16">
        <header className="mb-8 border-b border-line pb-6">
          <p className="eyebrow mb-2">{t.supervisor}</p>
          <h1 className="text-h2">{t.selectTailor}</h1>
        </header>
        {tailors.length === 0 ? (
          <p className="text-ink-muted">{t.noTailors}</p>
        ) : (
          <ul className="divide-y divide-line">
            {tailors.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-body">{locale === 'ar' ? row.nameAr : row.nameEn}</p>
                  {row.code ? <p className="text-caption text-ink-faint">{row.code}</p> : null}
                </div>
                <Link href={`/${locale}/tailor?tailorId=${row.id}`} className="link-underline text-small">
                  {t.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const displayName = locale === 'ar' ? access.nameAr : access.nameEn;

  return (
    <div className="shell py-8 md:py-12">
      <header className="mb-6 border-b border-line pb-6">
        <p className="eyebrow mb-2">{t.portal}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-h1">{displayName}</h1>
            {access.code ? <p className="mt-1 text-small text-ink-muted">{access.code}</p> : null}
          </div>
          {access.supervisor ? (
            <p className="rounded-full border border-line px-3 py-1 text-caption text-ink-muted">{t.supervisor}</p>
          ) : (
            <TailorSignOutButton locale={locale} label={t.signOut} />
          )}
        </div>
      </header>

      <div className="mb-8">
        <TailorNav
          locale={locale}
          tailorId={access.supervisor ? access.tailorId : null}
          labels={{ dashboard: t.dashboard, tasks: t.tasks, settlements: t.settlements, notifications: t.notifications }}
        />
      </div>

      {access.supervisor ? (
        <p className="mb-6 rounded border border-line bg-paper px-4 py-3 text-caption text-ink-muted">
          {t.viewing} {displayName}
        </p>
      ) : null}

      <div className="min-w-0">{children}</div>
    </div>
  );
}
