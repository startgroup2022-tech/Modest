import Link from 'next/link';
import { headers } from 'next/headers';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';

export default async function NotFound() {
  const h = await headers();
  const headerLocale = h.get('x-locale') ?? undefined;
  const locale = isLocale(headerLocale) ? headerLocale : 'en';
  const dict = getDictionary(locale);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="text-h1">{dict.common.notFound}</h1>
      <p className="mt-4 max-w-md text-body text-ink-muted">{dict.common.notFoundBody}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={`/${locale}`} className="btn-primary">
          {dict.common.goHome}
        </Link>
        <Link href={`/${locale}/shop`} className="btn-outline">
          {dict.nav.shop}
        </Link>
      </div>
    </div>
  );
}
