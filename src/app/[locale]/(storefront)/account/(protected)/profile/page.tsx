import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { ProfileForm } from '@/components/account/ProfileForm';

export default async function AccountProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/account/sign-in`);

  return (
    <div>
      <h2 className="mb-2 border-b border-line pb-3 text-h3">{dict.account.profile}</h2>
      <p className="mb-6 text-small text-ink-muted">{dict.account.profileBody}</p>
      <ProfileForm
        locale={locale}
        dict={dict}
        initial={{
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          phone: user.phone ?? '',
          locale: user.locale,
          email: user.email,
        }}
      />
    </div>
  );
}
