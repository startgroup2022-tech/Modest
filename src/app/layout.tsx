import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Montserrat, Cairo } from 'next/font/google';
import { dir, isLocale, type Locale } from '@/i18n/config';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-en',
  weight: ['300', '400', '500', '600'],
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-ar',
  weight: ['300', '400', '500', '600'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Attention Modest Fashion — Modern Modesty',
    template: '%s | Attention Modest Fashion',
  },
  description:
    'Attention Modest Fashion is a Bahraini atelier creating modern modest womenswear — ready-to-wear abayas and made-to-order pieces, cut and finished by hand.',
  applicationName: 'Attention Modest Fashion',
  authors: [{ name: 'Attention Modest Fashion' }],
  creator: 'Attention Modest Fashion',
  publisher: 'Attention Modest Fashion',
  formatDetection: { telephone: true, address: false, email: true },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A0A',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const headerLocale = h.get('x-locale') ?? undefined;
  const locale: Locale = isLocale(headerLocale) ? headerLocale : 'en';

  return (
    <html lang={locale} dir={dir(locale)} className={`${montserrat.variable} ${cairo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
