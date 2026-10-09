import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
import { listActiveCuts } from '@/lib/size-guide-db';
import { WhatsAppIcon } from '@/components/ui/icons';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const path = `/${locale}/size-guide`;
  return {
    title: dict.sizeGuide.title,
    description: dict.sizeGuide.lead,
    alternates: { canonical: path, languages: { en: '/en/size-guide', ar: '/ar/size-guide', 'x-default': '/en/size-guide' } },
  };
}

const CONVERSION_TABLE = [
  { attention: 'XS', eu: '34', uk: '6', us: '2' },
  { attention: 'S', eu: '36', uk: '8', us: '4' },
  { attention: 'M', eu: '38', uk: '10', us: '6' },
  { attention: 'L', eu: '40', uk: '12', us: '8' },
  { attention: 'XL', eu: '42', uk: '14', us: '10' },
  { attention: 'XXL', eu: '44', uk: '16', us: '12' },
];

export default async function SizeGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const ar = locale === 'ar';
  const cuts = await listActiveCuts();

  const measures = [
    dict.sizeGuide.measureBust,
    dict.sizeGuide.measureWaist,
    dict.sizeGuide.measureHip,
    dict.sizeGuide.measureShoulder,
    dict.sizeGuide.measureSleeve,
    dict.sizeGuide.measureLength,
    dict.sizeGuide.measureHeight,
  ];

  const measurementIntro = ar
    ? 'القياسات المعروضة أدناه مأخوذة على القطعة مفرودة (نصف المحيط) بوحدة الإنش، وفق مواصفات كل قَصّة. تُدار هذه الجداول من لوحة التحكم وتُحدَّث مباشرة هنا.'
    : 'The measurements below are taken across the garment when laid flat (half circumference), in inches, per silhouette. These charts are managed from Admin and update here immediately.';

  return (
    <div className="shell py-12 md:py-20">
      <header className="mb-10 max-w-3xl border-b border-line pb-8">
        <h1 className="text-h1">{dict.sizeGuide.title}</h1>
        <p className="mt-3 text-body text-ink-muted">{dict.sizeGuide.lead}</p>
      </header>

      <div className="grid gap-14 lg:grid-cols-[1fr_360px] lg:gap-20">
        <div className="space-y-14">
          <section>
            <h2 className="text-h2">{dict.sizeGuide.howToTitle}</h2>
            <ul className="mt-6 space-y-3">
              {measures.map((m, i) => (
                <li key={m} className="flex gap-4 border-t border-line pt-3 text-small text-ink-muted">
                  <span className="tabular-nums text-ink-faint">0{i + 1}</span>
                  {m}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-h2">{ar ? 'جداول القَصّات' : 'Silhouette charts'}</h2>
            <p className="mt-3 max-w-2xl text-small text-ink-muted">{measurementIntro}</p>
            <div className="mt-8 space-y-12">
              {cuts.length === 0 ? (
                <p className="border border-line px-5 py-6 text-small text-ink-muted">
                  {ar ? 'لم تُنشَر جداول القياسات بعد.' : 'Measurement charts are not published yet.'}
                </p>
              ) : (
                cuts.map((cut) => (
                  <div key={cut.id}>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h3 className="text-h3">{ar ? cut.cutNameAr : cut.cutNameEn}</h3>
                      <span className="font-mono text-caption uppercase tracking-[0.12em] text-ink-faint">
                        {cut.cutCode} · {cut.unit}
                      </span>
                    </div>
                    {(ar ? cut.descriptionAr : cut.descriptionEn) ? (
                      <p className="mt-1 text-small text-ink-muted">{ar ? cut.descriptionAr : cut.descriptionEn}</p>
                    ) : null}
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-small">
                        <thead>
                          <tr className="border-b border-ink">
                            <th className="py-3 pe-4 text-start text-caption uppercase tracking-[0.12em] text-ink-muted">
                              {dict.sizeGuide.columnSize}
                            </th>
                            {cut.fields.map((f) => (
                              <th
                                key={f.key}
                                className="py-3 pe-4 text-start text-caption uppercase tracking-[0.12em] text-ink-muted"
                              >
                                {ar ? f.labelAr : f.labelEn}
                                <span className="ms-1 normal-case tracking-normal text-ink-faint">({f.unit})</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cut.sizes.map((size) => (
                            <tr key={size} className="border-b border-line">
                              <td className="py-3 pe-4 font-medium">{size}</td>
                              {cut.fields.map((f) => (
                                <td key={f.key} className="py-3 pe-4 tabular-nums text-ink-muted">
                                  {cut.matrix[f.key]?.[size] ?? '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-h2">{dict.sizeGuide.conversionTitle}</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-small">
                <thead>
                  <tr className="border-b border-ink">
                    {['Attention', 'EU', 'UK', 'US'].map((h) => (
                      <th key={h} className="py-3 pe-4 text-start text-caption uppercase tracking-[0.12em] text-ink-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CONVERSION_TABLE.map((r) => (
                    <tr key={r.attention} className="border-b border-line">
                      <td className="py-3 pe-4 font-medium">{r.attention}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.eu}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.uk}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-line bg-paper-warm p-6">
            <h2 className="eyebrow mb-3">{dict.product.madeToOrderInfo}</h2>
            <p className="text-small text-ink-muted">{dict.sizeGuide.note}</p>
            <p className="mt-4 text-small text-ink-muted">{dict.sizeGuide.needHelp}</p>
            <Link href={`/${locale}/contact`} className="btn-outline mt-5 inline-flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4" />
              {dict.contact.whatsappCta}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
