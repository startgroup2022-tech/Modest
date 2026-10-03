import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyMeasurement } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { MeasurementForm } from '@/components/account/MeasurementForm';

const toStr = (v: unknown) => (v == null ? '' : String(Number(v)));

export default async function AccountMeasurementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const m = await getMyMeasurement(user.customerId);

  return (
    <div>
      <h2 className="mb-2 border-b border-line pb-3 text-h3">{dict.account.measurements}</h2>
      <p className="mb-6 text-small text-ink-muted">{dict.account.measurementsBody}</p>
      <MeasurementForm
        locale={locale}
        dict={dict}
        initial={
          m
            ? {
                unit: m.unit,
                height: toStr(m.height),
                shoulder: toStr(m.shoulder),
                bust: toStr(m.bust),
                waist: toStr(m.waist),
                hip: toStr(m.hip),
                sleeve: toStr(m.sleeve),
                armhole: toStr(m.armhole),
                length: toStr(m.length),
                notes: m.notes ?? '',
              }
            : null
        }
      />
    </div>
  );
}
