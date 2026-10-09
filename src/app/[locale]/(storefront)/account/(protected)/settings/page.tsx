import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { SignOutButton } from '@/components/account/SignOutButton';
import { PasswordForm } from '@/components/account/PasswordForm';
import { CurrencySwitcher, LocaleSwitcher } from '@/components/layout/Switchers';
import { getActiveCurrencies } from '@/lib/currency';

export default async function AccountSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/account/sign-in`);
  const currencies = await getActiveCurrencies();

  const links = [
    { label: dict.footer.sizeGuide, href: `/${locale}/size-guide` },
    { label: dict.footer.returnPolicy, href: `/${locale}/p/return-policy` },
    { label: dict.footer.terms, href: `/${locale}/p/terms-and-conditions` },
    { label: dict.footer.privacy, href: `/${locale}/p/privacy-policy` },
    { label: dict.nav.contact, href: `/${locale}/contact` },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="mb-2 border-b border-line pb-3 text-h3">{dict.account.settings}</h2>
        <p className="text-small text-ink-muted">{dict.account.settingsBody}</p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line p-5">
          <div>
            <p className="text-body">{dict.account.preferredLocale}</p>
            <p className="text-small text-ink-muted">
              {locale === 'ar' ? 'العربية' : 'English'}
            </p>
          </div>
          <LocaleSwitcher locale={locale} label={dict.common.language} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line p-5">
          <div>
            <p className="text-body">{dict.common.currency}</p>
          </div>
          <CurrencySwitcher
            currencies={currencies.map((c) => ({ code: c.code, label: `${c.code} — ${locale === 'ar' ? c.nameAr : c.nameEn}` }))}
            label={dict.common.currency}
          />
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-4">{dict.account.changePassword}</h3>
        <p className="mb-5 text-small text-ink-muted">{dict.account.changePasswordBody}</p>
        <PasswordForm dict={dict} />
      </section>

      <section>
        <h3 className="eyebrow mb-4">{dict.common.quickLinks}</h3>
        <ul className="divide-y divide-line border-y border-line">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center justify-between py-3.5 text-small text-ink-muted transition-colors hover:text-ink">
                {l.label}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line pt-6">
        <SignOutButton locale={locale} dict={dict} className="btn-outline" />
      </section>
    </div>
  );
}
