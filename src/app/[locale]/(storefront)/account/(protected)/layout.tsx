import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { AccountNav } from '@/components/account/AccountNav';
import { SignOutButton } from '@/components/account/SignOutButton';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).account.title, robots: { index: false, follow: false } };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/account/sign-in`);

  return (
    <div className="shell pt-10 md:pt-14">
      <header className="mb-8 border-b border-line pb-6">
        <p className="eyebrow mb-2">{dict.account.signedInAs}</p>
        <h1 className="text-h1">{user.firstName ? user.firstName : dict.account.title}</h1>
        <p className="mt-1 text-small text-ink-muted">{user.email}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <AccountNav locale={locale} dict={dict} />
          <div className="mt-6 hidden border-t border-line pt-6 lg:block">
            <SignOutButton locale={locale} dict={dict} className="link-underline text-small text-ink-muted" />
          </div>
          <div className="mt-6 lg:hidden">
            <Link href={`/${locale}/shop`} className="link-underline text-small text-ink-muted">
              {dict.nav.shop}
            </Link>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
