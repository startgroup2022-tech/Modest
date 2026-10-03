import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage } from '@/lib/site';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { EmptyState } from '@/components/ui/EmptyState';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const page = await getPage(slug);
  if (!page) return { title: 'Not found' };
  const title = locale === 'ar' ? page.titleAr : page.titleEn;
  const body = (locale === 'ar' ? page.bodyAr : page.bodyEn).replace(/<[^>]*>/g, ' ').slice(0, 160);
  return {
    title,
    description: body,
    alternates: {
      canonical: `/${locale}/p/${slug}`,
      languages: { en: `/en/p/${slug}`, ar: `/ar/p/${slug}`, 'x-default': `/en/p/${slug}` },
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const page = await getPage(slug);
  if (!page) notFound();

  const title = locale === 'ar' ? page.titleAr : page.titleEn;
  const body = locale === 'ar' ? page.bodyAr : page.bodyEn;

  return (
    <article className="shell max-w-prose py-12 md:py-20">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-caption uppercase tracking-[0.12em] text-ink-muted">
          <li>
            <Link href={`/${locale}`} className="link-underline">
              {dict.nav.home}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink">{title}</li>
        </ol>
      </nav>

      <header className="mb-8 border-b border-line pb-6">
        <h1 className="text-h1">{title}</h1>
      </header>

      {body ? (
        <div className="prose-luxe" dangerouslySetInnerHTML={{ __html: body }} />
      ) : (
        <EmptyState title={dict.pages.empty} actionLabel={dict.common.goHome} actionHref={`/${locale}`} />
      )}

      <p className="mt-12 border-t border-line pt-6 text-caption text-ink-faint">
        {dict.pages.lastUpdated}: {page.updatedAt.toISOString().slice(0, 10)}
      </p>
    </article>
  );
}
