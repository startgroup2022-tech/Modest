import Image from 'next/image';
import Link from 'next/link';
import { getCollections } from '@/lib/catalog';
import { getDictionary } from '@/i18n/dictionaries';
import { ArrowRight } from '@/components/ui/icons';
import type { Locale } from '@/i18n/config';

/**
 * Editorial collection composition — deliberately uneven so it reads like a
 * magazine spread rather than a grid of identical tiles.
 */
export async function FeaturedCollections({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const collections = await getCollections();
  if (!collections.length) return null;

  const [lead, ...rest] = collections;
  const leadName = locale === 'ar' ? lead.nameAr : lead.nameEn;
  const leadDesc = locale === 'ar' ? lead.descriptionAr : lead.descriptionEn;

  return (
    <section aria-labelledby="collections-heading" className="py-16 md:py-24">
      <div className="shell">
        <header className="mb-8 md:mb-12">
          <p className="eyebrow mb-3">{dict.home.featuredCollections}</p>
          <h2 id="collections-heading" className="text-h2">
            {dict.nav.collections}
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
          <Link
            href={`/${locale}/collections/${lead.slug}`}
            className="group relative block overflow-hidden md:col-span-7"
          >
            <div className="relative aspect-[4/5] w-full bg-sand-100 md:aspect-[3/4]">
              {lead.heroImage ? (
                <Image
                  src={lead.heroImage}
                  alt={leadName}
                  fill
                  sizes="(max-width: 767px) 100vw, 58vw"
                  className="object-cover transition-transform duration-[1200ms] ease-luxe group-hover:scale-[1.03]"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-paper md:p-10">
                <h3 className="text-h2">{leadName}</h3>
                {leadDesc ? <p className="mt-2 max-w-md text-small text-paper/80">{leadDesc}</p> : null}
                <span className="mt-4 inline-flex items-center gap-2 text-caption uppercase tracking-[0.16em]">
                  {dict.home.discoverCollection}
                  <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                </span>
              </div>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-4 md:col-span-5 md:grid-cols-1 md:gap-6">
            {rest.slice(0, 2).map((c) => {
              const name = locale === 'ar' ? c.nameAr : c.nameEn;
              const tagline = locale === 'ar' ? c.taglineAr : c.taglineEn;
              return (
                <Link
                  key={c.id}
                  href={`/${locale}/collections/${c.slug}`}
                  className="group relative block overflow-hidden"
                >
                  <div className="relative aspect-[4/5] w-full bg-sand-100 md:aspect-[16/10]">
                    {c.heroImage ? (
                      <Image
                        src={c.heroImage}
                        alt={name}
                        fill
                        sizes="(max-width: 767px) 45vw, 40vw"
                        className="object-cover transition-transform duration-[1200ms] ease-luxe group-hover:scale-[1.03]"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-paper">
                      <h3 className="text-h3">{name}</h3>
                      {tagline ? <p className="mt-1 text-caption text-paper/80">{tagline}</p> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {rest.length > 2 ? (
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6">
            {rest.slice(2).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${locale}/collections/${c.slug}`}
                  className="link-underline text-small uppercase tracking-[0.12em] text-ink-muted"
                >
                  {locale === 'ar' ? c.nameAr : c.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
