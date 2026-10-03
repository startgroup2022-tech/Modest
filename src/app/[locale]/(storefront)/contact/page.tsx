import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreInfo } from '@/lib/site';
import { ContactForm } from '@/components/contact/ContactForm';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { MailIcon, PhoneIcon, MapPinIcon, WhatsAppIcon } from '@/components/ui/icons';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const path = `/${locale}/contact`;
  return {
    title: dict.contact.title,
    description: dict.contact.lead,
    alternates: { canonical: path, languages: { en: '/en/contact', ar: '/ar/contact', 'x-default': '/en/contact' } },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const store = await getStoreInfo();

  return (
    <div className="shell py-12 md:py-20">
      <header className="mb-10 max-w-2xl border-b border-line pb-8">
        <h1 className="text-h1">{dict.contact.title}</h1>
        <p className="mt-3 text-body text-ink-muted">{dict.contact.lead}</p>
      </header>

      <div className="grid gap-12 md:grid-cols-2 md:gap-20">
        <ContactForm locale={locale} dict={dict} />

        <aside className="space-y-8">
          <div>
            <h2 className="eyebrow mb-4">{dict.contact.visitTitle}</h2>
            <ul className="space-y-4 text-small">
              <li className="flex items-start gap-3">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                <span className="text-ink-muted">
                  {store.city}, {store.country}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                <a href={`mailto:${store.email}`} className="link-underline">
                  {store.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                <a href={`tel:${store.phone.replace(/\s/g, '')}`} className="link-underline tabular-nums">
                  {store.phone}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="eyebrow mb-4">{dict.contact.hoursTitle}</h2>
            <p className="text-small text-ink-muted">{dict.contact.hours}</p>
          </div>

          <a
            href={store.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline inline-flex items-center gap-2"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {dict.contact.whatsappCta}
          </a>
        </aside>
      </div>
    </div>
  );
}
