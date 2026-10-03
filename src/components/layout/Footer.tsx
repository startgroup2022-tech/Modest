'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/icons';
import { CurrencySwitcher, LocaleSwitcher } from './Switchers';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

interface SocialLinkView {
  platform: string;
  url: string;
  label: string;
}

function SocialIcon({ platform }: { platform: string }) {
  if (platform === 'instagram') return <InstagramIcon className="h-4 w-4" />;
  if (platform === 'tiktok') return <TikTokIcon className="h-4 w-4" />;
  if (platform === 'whatsapp') return <WhatsAppIcon className="h-4 w-4" />;
  return null;
}

export function Footer({
  locale,
  dict,
  store,
  socials,
  currencies,
  categories,
  collections,
}: {
  locale: Locale;
  dict: Dict;
  store: { name: string; email: string; phone: string; cr: string; city: string; country: string };
  socials: SocialLinkView[];
  currencies: { code: string; label: string }[];
  categories: { slug: string; name: string }[];
  collections: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'invalid' | 'alreadySubscribed' | 'sending'>('idle');
  const p = (path: string) => `/${locale}${path ? `/${path.replace(/^\//, '')}` : ''}`;

  useEffect(() => {
    if (status === 'success' || status === 'alreadySubscribed') {
      const t = setTimeout(() => setStatus('idle'), 5000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locale }),
    });
    if (!res.ok) {
      setStatus('invalid');
      return;
    }
    const data = (await res.json()) as { status: string };
    setStatus(data.status === 'alreadySubscribed' ? 'alreadySubscribed' : 'success');
    setEmail('');
  };

  const quickLinks = [
    { label: dict.nav.sizeGuide, href: p('size-guide') },
    { label: locale === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions', href: p('p/terms-and-conditions') },
    { label: locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy', href: p('p/privacy-policy') },
    { label: locale === 'ar' ? 'سياسة الاسترجاع' : 'Return Policy', href: p('p/return-policy') },
  ];

  return (
    <footer className="mt-24 border-t border-line bg-paper-warm md:mt-32 md:pb-0">
      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Newsletter */}
          <div className="md:col-span-5">
            <h2 className="text-h2">{dict.home.joinAttention}</h2>
            <p className="mt-3 max-w-md text-small text-ink-muted">{dict.home.newsletterBody}</p>
            <form onSubmit={subscribe} className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row sm:gap-0">
              <label htmlFor="footer-newsletter" className="sr-only">
                {dict.common.email}
              </label>
              <input
                id="footer-newsletter"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.home.emailPlaceholder}
                className="field sm:border-e-0"
              />
              <button type="submit" disabled={status === 'sending'} className="btn-primary shrink-0">
                {status === 'sending' ? dict.common.loading : dict.home.subscribe}
              </button>
            </form>
            <p
              aria-live="polite"
              className={clsx(
                'mt-2.5 text-caption',
                status === 'invalid' ? 'text-danger' : 'text-ink-muted',
              )}
            >
              {status === 'success'
                ? dict.newsletter.success
                : status === 'invalid'
                  ? dict.newsletter.invalid
                  : status === 'alreadySubscribed'
                    ? dict.newsletter.alreadySubscribed
                    : ''}
            </p>
          </div>

          {/* Shop */}
          <nav aria-label={dict.nav.shop} className="md:col-span-2">
            <h3 className="eyebrow mb-4">{dict.nav.shop}</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href={p('shop')} className="link-underline text-small text-ink-muted">
                  {dict.shop.allCategories}
                </Link>
              </li>
              {categories.slice(0, 4).map((c) => (
                <li key={c.slug}>
                  <Link href={p(`shop?category=${c.slug}`)} className="link-underline text-small text-ink-muted">
                    {c.name}
                  </Link>
                </li>
              ))}
              {collections.slice(0, 2).map((c) => (
                <li key={c.slug}>
                  <Link href={p(`collections/${c.slug}`)} className="link-underline text-small text-ink-muted">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* About */}
          <nav aria-label={dict.nav.about} className="md:col-span-2">
            <h3 className="eyebrow mb-4">{dict.nav.about}</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href={p('about')} className="link-underline text-small text-ink-muted">
                  {dict.nav.about}
                </Link>
              </li>
              <li>
                <Link href={p('collections/made-to-order')} className="link-underline text-small text-ink-muted">
                  {dict.nav.madeToOrder}
                </Link>
              </li>
              <li>
                <Link href={p('contact')} className="link-underline text-small text-ink-muted">
                  {dict.nav.contact}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Quick links */}
          <nav aria-label={dict.common.quickLinks} className="md:col-span-2">
            <h3 className="eyebrow mb-4">{dict.common.quickLinks}</h3>
            <ul className="space-y-2.5">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="link-underline text-small text-ink-muted">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="md:col-span-1">
            <h3 className="eyebrow mb-4">{dict.common.contactUs}</h3>
            <ul className="space-y-2.5">
              <li>
                <a href={`mailto:${store.email}`} className="link-underline text-small text-ink-muted">
                  {dict.common.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${store.phone.replace(/\s/g, '')}`}
                  className="link-underline text-small text-ink-muted"
                >
                  {dict.common.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Social + meta */}
        <div className="mt-14 flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <span className="eyebrow">{dict.common.followUs}</span>
            <ul className="flex items-center gap-4">
              {socials.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="text-ink-muted transition-colors hover:text-ink"
                  >
                    <SocialIcon platform={s.platform} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-6">
            <CurrencySwitcher currencies={currencies} label={dict.common.currency} />
            <LocaleSwitcher locale={locale} label={dict.common.language} />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-caption text-ink-faint md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {store.name}. {dict.common.allRightsReserved}
          </p>
          <p>
            {store.cr} · {store.city}, {store.country}
          </p>
        </div>
      </div>
      {/* Bottom nav clearance on mobile */}
      <div className="h-20 md:hidden" aria-hidden="true" />
    </footer>
  );
}
