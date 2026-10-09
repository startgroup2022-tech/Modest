import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { safeRedirect } from '@/lib/redirect-safety';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { AuthForm } from '@/components/account/AuthForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).account.signIn, robots: { index: false, follow: false } };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { redirect: redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    const target = safeRedirect(redirectTo);
    if (target) redirect(target);
    redirect(user.role === 'CUSTOMER' ? `/${locale}/account` : `/${locale}/admin`);
  }

  return (
    <div className="shell py-16 md:py-24">
      <Suspense fallback={null}>
        <AuthForm locale={locale} dict={dict} mode="signin" />
      </Suspense>
    </div>
  );
}
