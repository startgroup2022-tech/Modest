import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAdminUser } from '@/lib/admin-auth';
import { getAdminNav } from '@/lib/admin/nav';
import { getAdminDict } from '@/i18n/admin-dict';
import { adminHref } from '@/i18n/admin';
import { isLocale, type Locale } from '@/i18n/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { Sidebar, Topbar, MobileNavDrawer } from '@/components/admin/AdminChrome';
import { AdminToast } from '@/components/admin/AdminToast';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const admin = await getAdminUser();
  const h = await headers();
  const pathname = h.get('x-pathname') ?? `/${locale}/admin`;
  if (!admin) {
    redirect(`/${locale}/account/sign-in?redirect=${encodeURIComponent(pathname)}`);
  }

  const dict = getAdminDict(locale);
  const nav = await getAdminNav(locale as Locale, admin.permissions, admin.id);
  const adminRoot = adminHref(locale);

  const displayName =
    [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email.split('@')[0];

  const labels = {
    name: dict.app.name,
    suffix: dict.app.suffix,
    signedInAs: dict.app.signedInAs,
    signOut: dict.app.signOut,
    viewStore: dict.app.viewStore,
    search: dict.app.search,
    settings: dict.system.settings,
    closeMenu: dict.common.close,
    language: dict.common.language,
  };

  return (
    <AdminShell
      navItems={nav.commandItems}
      labels={{
        title: dict.app.commandTitle,
        hint: dict.app.commandHint,
        placeholder: dict.app.searchHint,
        noResults: dict.app.noResults,
        sections: dict.common.filters === 'Filters' ? 'Sections' : 'الأقسام',
        records: dict.common.filters === 'Filters' ? 'Records' : 'السجلات',
        searchPath: '/api/admin/search',
      }}
    >
      <div className="flex min-h-screen bg-paper-warm">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-line bg-paper lg:block">
          <Sidebar adminRoot={adminRoot} groups={nav.groups} labels={labels} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={{ name: displayName, email: admin.email, role: admin.role }}
            labels={labels}
            locale={locale}
            storeUrl={`/${locale}`}
            signOutUrl="/api/auth/signout"
            settingsUrl={`${adminRoot}/settings`}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      <MobileNavDrawer adminRoot={adminRoot} groups={nav.groups} labels={labels} />
      <AdminToast />
    </AdminShell>
  );
}
