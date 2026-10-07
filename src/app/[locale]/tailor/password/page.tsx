import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/config';
import { getCurrentTailor } from '@/lib/tailor-auth';
import { TailorPasswordForm } from '@/components/tailor/TailorPasswordForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tailor Portal', robots: { index: false, follow: false } };

/**
 * First-login (and subsequent) password change. A tailor with a temporary
 * password is held here until they set their own; the portal itself is not
 * built yet, so this is the only authenticated tailor page for now.
 */
export default async function TailorPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const tailor = await getCurrentTailor();
  if (!tailor) redirect(`/${locale}/tailor/sign-in`);

  return (
    <div className="shell py-16 md:py-24">
      <TailorPasswordForm
        locale={locale}
        name={locale === 'ar' ? tailor.nameAr : tailor.nameEn}
        mustChange={tailor.mustChangePassword}
      />
    </div>
  );
}
