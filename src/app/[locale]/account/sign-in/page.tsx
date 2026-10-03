import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { AuthForm } from '@/components/account/AuthForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).account.signIn, robots: { index: false, follow: false } };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}/account`);

  return (
    <div className="shell py-16 md:py-24">
      <Suspense fallback={null}>
        <AuthForm locale={locale} dict={dict} mode="signin" />
      </Suspense>
    </div>
  );
}
