import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollections } from '@/lib/catalog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArrowRight } from '@/components/ui/icons';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.collections.title,
    description: dict.collections.lead,
    alternates: {
      canonical: `/${locale}/collections`,
      languages: { en: '/en/collections', ar: '/ar/collections', 'x-default': '/en/collections' },
    },
  };
}

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const collections = await getCollections();

  return (
    <div className="shell pt-10 md:pt-14">
      <header className="mb-10 border-b border-line pb-8 md:mb-14">
        <h1 className="text-h1">{dict.collections.title}</h1>
        <p className="mt-3 max-w-xl text-body text-ink-muted">{dict.collections.lead}</p>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          title={dict.collections.empty}
          actionLabel={dict.shop.title}
          actionHref={`/${locale}/shop`}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const name = locale === 'ar' ? c.nameAr : c.nameEn;
            const tagline = locale === 'ar' ? c.taglineAr : c.taglineEn;
            const count = c._count.products;
            return (
              <Link key={c.id} href={`/${locale}/collections/${c.slug}`} className="group block">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand-100">
                  {c.heroImage ? (
                    <Image
                      src={c.heroImage}
                      alt={name}
                      fill
                      sizes="(max-width: 767px) 100vw, 33vw"
                      className="object-cover transition-transform duration-[1200ms] ease-luxe group-hover:scale-[1.03]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/45 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-paper">
                    <h2 className="text-h3">{name}</h2>
                    {tagline ? <p className="mt-1 text-caption text-paper/80">{tagline}</p> : null}
                    <span className="mt-3 inline-flex items-center gap-2 text-caption uppercase tracking-[0.14em]">
                      {count} {dict.collections.pieces}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
