import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyAddresses } from '@/lib/account';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { AddressManager } from '@/components/account/AddressManager';

export default async function AccountAddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/account/sign-in`);

  const addresses = await getMyAddresses(user.customerId);

  return (
    <div>
      <h2 className="mb-2 border-b border-line pb-3 text-h3">{dict.account.addresses}</h2>
      <p className="mb-6 text-small text-ink-muted">{dict.account.addressBody}</p>
      <AddressManager
        locale={locale}
        dict={dict}
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          fullName: a.fullName,
          phone: a.phone,
          country: a.country,
          city: a.city,
          area: a.area,
          address: a.address,
          building: a.building,
          unit: a.unit,
          notes: a.notes,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
