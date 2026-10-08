import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/config';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { TailorSignInForm } from '@/components/tailor/TailorSignInForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tailor Portal', robots: { index: false, follow: false } };

export default async function TailorSignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const tailor = await getCurrentTailor();
  // Already signed in: send straight to the portal, or to the password screen
  // if the temporary password has not been replaced yet.
  if (tailor) redirect(`/${locale}/tailor${tailor.mustChangePassword ? '/password' : ''}`);

  return (
    <div className="shell py-16 md:py-24">
      <TailorSignInForm locale={locale} />
    </div>
  );
}
