import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { PageHeader, Panel, Tabs, AdminEmpty } from '@/components/admin/ui';
import { SettingForm, type SettingField } from '@/components/admin/SettingForm';
import { CurrencyManager } from '@/components/admin/CurrencyManager';
import { PaymentMethodManager } from '@/components/admin/PaymentMethodManager';
import { getPaymentConfigs } from '@/lib/payment-config';
import { maskSecret } from '@/lib/admin/settings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } };

type Json = Record<string, unknown>;

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('settings.view', locale);
  const dict = getAdminDict(locale);
  const s = dict.settings;
  const sp = await searchParams;
  const tab = sp.tab ?? 'general';

  const settings = await prisma.siteSetting.findMany();
  const get = (key: string): Json => {
    const row = settings.find((x) => x.key === key);
    return (row?.value as Json) ?? {};
  };
  const currencies = await prisma.currency.findMany({ orderBy: { sortOrder: 'asc' } });
  const paymentConfigs = await getPaymentConfigs();

  const store = get('store');
  const checkout = get('checkout');
  const bank = get('bank_transfer_details');
  const benefit = get('benefit_details');
  const tapp = get('tapp_config');

  const storeFields: SettingField[] = [
    { key: 'name', label: s.storeName },
    { key: 'nameAr', label: s.storeNameAr },
    { key: 'email', label: s.email, type: 'email' },
    { key: 'phone', label: s.phone },
    { key: 'whatsapp', label: s.whatsapp, type: 'url' },
    { key: 'city', label: s.city },
    { key: 'country', label: s.country },
    { key: 'timezone', label: s.timezone },
    {
      key: 'logoUrl',
      label: locale === 'ar' ? 'الشعار' : 'Logo',
      type: 'image',
      full: true,
      help: locale === 'ar' ? 'اتركه فارغًا لاستخدام شعار النص.' : 'Leave empty to use the typographic wordmark.',
    },
    {
      key: 'faviconUrl',
      label: locale === 'ar' ? 'أيقونة الموقع' : 'Favicon',
      type: 'image',
      full: true,
      help: locale === 'ar' ? 'اتركه فارغًا للأيقونة الافتراضية.' : 'Leave empty for the built-in icon.',
    },
    { key: 'leadTimeEn', label: s.leadTimeEn, type: 'textarea', full: true },
    { key: 'leadTimeAr', label: s.leadTimeAr, type: 'textarea', full: true },
  ];

  const checkoutFields: SettingField[] = [
    { key: 'allowGuestCheckout', label: locale === 'ar' ? 'السماح بالدفع كزائر' : 'Allow guest checkout', type: 'checkbox' },
    { key: 'requirePhone', label: locale === 'ar' ? 'الهاتف مطلوب' : 'Phone required', type: 'checkbox' },
    { key: 'requireTerms', label: locale === 'ar' ? 'الموافقة على الشروط مطلوبة' : 'Terms acceptance required', type: 'checkbox' },
    { key: 'enableCoupons', label: locale === 'ar' ? 'تفعيل الكوبونات' : 'Enable coupons', type: 'checkbox' },
    { key: 'enableOrderNotes', label: locale === 'ar' ? 'تفعيل ملاحظات الطلب' : 'Enable order notes', type: 'checkbox' },
  ];

  const bankFields: SettingField[] = [
    { key: 'bankName', label: dict.system.bankName },
    { key: 'accountName', label: dict.system.accountName },
    { key: 'iban', label: dict.system.iban },
    { key: 'accountNumber', label: dict.system.accountNumber },
    { key: 'instructionsEn', label: s.instructionsEn, type: 'textarea', full: true },
    { key: 'instructionsAr', label: s.instructionsAr, type: 'textarea', full: true },
  ];

  const benefitFields: SettingField[] = [
    { key: 'alias', label: dict.system.alias },
    { key: 'accountNumber', label: dict.system.accountNumber },
    { key: 'accountName', label: dict.system.accountName },
    { key: 'instructionsEn', label: s.instructionsEn, type: 'textarea', full: true },
    { key: 'instructionsAr', label: s.instructionsAr, type: 'textarea', full: true },
  ];

  const tappFields: SettingField[] = [
    { key: 'environment', label: dict.system.environment, placeholder: 'sandbox' },
    { key: 'baseUrl', label: dict.system.baseUrl, type: 'url' },
    { key: 'merchantId', label: dict.system.merchantId },
    { key: 'apiKey', label: dict.system.apiKey, type: 'password', help: dict.system.masked },
    { key: 'webhookSecret', label: dict.system.webhookSecret, type: 'password', help: dict.system.masked },
  ];

  const tabs = [
    { key: 'general', label: s.general, href: `?tab=general` },
    { key: 'payments', label: s.payments, href: `?tab=payments` },
    { key: 'shipping', label: s.shipping, href: `?tab=shipping` },
    { key: 'currencies', label: s.currencies, href: `?tab=currencies` },
  ];

  const canEdit = admin.permissions.has('settings.edit');

  return (
    <>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <Tabs items={tabs} active={tab} />

      {tab === 'general' && (
        <div className="grid gap-6">
          <Panel title={s.store}>
            <SettingForm settingKey="store" initial={store} fields={storeFields} dict={{ common: dict.common, settings: s }} locale={locale} />
          </Panel>
          <Panel title={s.checkout}>
            <SettingForm settingKey="checkout" initial={checkout} fields={checkoutFields} dict={{ common: dict.common, settings: s }} />
          </Panel>
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid gap-6">
          <Panel title={s.methods}>
            <p className="mb-4 text-caption text-ink-faint">{s.methodsHint}</p>
            <PaymentMethodManager
              configs={(['COD', 'BANK_TRANSFER', 'BENEFIT', 'TAPP'] as const).map((m) => paymentConfigs[m])}
              locale={locale}
              labels={{
                methodEnabled: s.methodEnabled,
                methodVisible: s.methodVisible,
                methodLabelEn: s.methodLabelEn,
                methodLabelAr: s.methodLabelAr,
                methodDescEn: s.methodDescEn,
                methodDescAr: s.methodDescAr,
                instructionsEn: s.instructionsEn,
                instructionsAr: s.instructionsAr,
                sortOrder: s.sortOrder,
                minOrder: s.minOrder,
                maxOrder: s.maxOrder,
                saveMethods: s.saveMethods,
                saving: dict.common.saving,
                saved: dict.common.saved,
                testConnection: s.testConnection,
                testSuccess: s.testSuccess,
                testFailed: s.testFailed,
                testHint: s.testHint,
              }}
              canEdit={canEdit}
            />
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={s.bank}>
              <SettingForm settingKey="bank_transfer_details" initial={bank} fields={bankFields} dict={{ common: dict.common, settings: s }} />
            </Panel>
            <Panel title={s.benefit}>
              <SettingForm settingKey="benefit_details" initial={benefit} fields={benefitFields} dict={{ common: dict.common, settings: s }} />
            </Panel>
          </div>
          <Panel title={s.tapp}>
            <p className="mb-4 text-caption text-ink-faint">{s.secretsNote}</p>
            <SettingForm
              settingKey="tapp_config"
              initial={{ ...tapp, apiKey: maskSecret(tapp.apiKey), webhookSecret: maskSecret(tapp.webhookSecret) }}
              fields={tappFields}
              dict={{ common: dict.common, settings: s }}
            />
          </Panel>
        </div>
      )}

      {tab === 'shipping' && (
        <Panel title={s.shipping}>
          <AdminEmpty
            title={dict.common.empty}
            hint={locale === 'ar' ? 'تُدار طرق الشحن من قسم الشحن.' : 'Shipping methods are managed in the Shipping section.'}
            action={
              <Link href={`/${locale}/admin/shipping`} className="adm-btn-outline">
                {dict.nav.shipping}
              </Link>
            }
          />
        </Panel>
      )}

      {tab === 'currencies' && (
        <Panel title={s.currencies} bodyClassName="p-0">
          <CurrencyManager
            currencies={currencies.map((c) => ({
              id: c.id, code: c.code, nameEn: c.nameEn, nameAr: c.nameAr,
              symbolEn: c.symbolEn, symbolAr: c.symbolAr,
              decimals: c.decimals, symbolPosition: c.symbolPosition, rateToBhd: String(c.rateToBhd),
              isActive: c.isActive, isDefault: c.isDefault, sortOrder: c.sortOrder,
            }))}
            locale={locale}
            dict={{ common: dict.common, system: dict.system }}
            canEdit={canEdit}
          />
        </Panel>
      )}
    </>
  );
}
