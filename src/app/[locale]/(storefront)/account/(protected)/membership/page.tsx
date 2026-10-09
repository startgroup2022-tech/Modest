import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCustomerMembership } from '@/lib/membership-db';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { EmptyState } from '@/components/ui/EmptyState';
import { SparkIcon } from '@/components/ui/icons';

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountMembershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const membership = await getCustomerMembership(user.customerId);

  // No tiers configured in Admin — say so plainly rather than inventing levels.
  if (!membership.tiers.length) {
    return (
      <div>
        <h2 className="mb-6 border-b border-line pb-3 text-h3">{dict.account.membership}</h2>
        <p className="text-small text-ink-muted">{dict.account.membershipNoTiers}</p>
      </div>
    );
  }

  const tierName = (tier: { nameEn: string; nameAr: string } | null) =>
    tier ? (locale === 'ar' ? tier.nameAr : tier.nameEn) : null;

  const currentName = tierName(membership.tier);
  const nextName = tierName(membership.nextTier);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="border-b border-line pb-3 text-h3">{dict.account.membership}</h2>
        <p className="mt-4 text-small text-ink-muted">{dict.account.membershipBody}</p>
      </div>

      <section className="border border-line p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">{dict.account.membershipYourTier}</p>
            <p className="text-h2">{currentName ?? dict.account.membershipEmpty}</p>
          </div>
          <div className="text-end">
            <p className="eyebrow mb-2">{dict.account.membershipPieces}</p>
            <p className="text-h2 tabular-nums">{membership.qualifyingCount}</p>
          </div>
        </div>

        {membership.nextTier ? (
          <div className="mt-8">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-caption text-ink-muted">
              <span>
                {dict.account.membershipProgress} — {nextName}
              </span>
              <span className="tabular-nums">{membership.percent}%</span>
            </div>
            <div
              className="h-px w-full bg-line"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={membership.percent}
              aria-label={dict.account.membershipProgress}
            >
              <div className="h-px bg-ink" style={{ width: `${membership.percent}%` }} />
            </div>
            {membership.toNext != null ? (
              <p className="mt-2 text-caption text-ink-faint">
                {membership.toNext} {dict.account.membershipThreshold}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-small text-ink-muted">{dict.account.membershipAtTop}</p>
        )}
      </section>

      {/* Real configured tiers from Admin — never fabricated. Benefits are only
          shown if a tier record actually carries them; the schema does not, so
          none are invented here. */}
      <section>
        <h3 className="mb-5 border-b border-line pb-3 text-h4">{dict.account.membershipTier}</h3>
        <ul className="divide-y divide-line">
          {membership.tiers.map((t) => {
            const isCurrent = membership.tier?.id === t.id;
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className={isCurrent ? 'text-body text-ink' : 'text-body text-ink-muted'}>
                    {locale === 'ar' ? t.nameAr : t.nameEn}
                  </p>
                  <p className="mt-1 text-caption text-ink-faint tabular-nums">
                    {t.minQualifying} {dict.account.membershipThreshold}
                  </p>
                </div>
                {isCurrent ? <span className="eyebrow text-ink">{dict.account.membershipYourTier}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>

      {membership.qualifyingCount === 0 ? (
        <EmptyState
          icon={<SparkIcon className="h-6 w-6" />}
          title={dict.account.membershipEmpty}
          body={dict.account.membershipEmptyBody}
          actionLabel={dict.nav.shop}
          actionHref={`/${locale}/shop`}
        />
      ) : null}
    </div>
  );
}
