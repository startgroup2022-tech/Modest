import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyMeasurements } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { MeasurementsManager } from '@/components/account/MeasurementsManager';

const toStr = (v: unknown) => (v == null ? '' : String(Number(v)));

export default async function AccountMeasurementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const rows = await getMyMeasurements(user.customerId);
  const profiles = rows.map((m) => ({
    id: m.id,
    name: m.name,
    isDefault: m.isDefault,
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
    updatedAt: m.updatedAt.toISOString().slice(0, 10),
  }));

  return (
    <div>
      <h2 className="mb-2 border-b border-line pb-3 text-h3">{dict.account.measurements}</h2>
      <p className="mb-6 text-small text-ink-muted">{dict.account.measurementsBody}</p>
      <MeasurementsManager locale={locale} dict={dict} profiles={profiles} />
    </div>
  );
}
