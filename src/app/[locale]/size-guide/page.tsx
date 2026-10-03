import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/config';
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

const BODY_TABLE = [
  { size: 'XS', bust: '80–84', waist: '62–66', hip: '86–90' },
  { size: 'S', bust: '84–88', waist: '66–70', hip: '90–94' },
  { size: 'M', bust: '88–92', waist: '70–74', hip: '94–98' },
  { size: 'L', bust: '92–97', waist: '74–79', hip: '98–103' },
  { size: 'XL', bust: '97–102', waist: '79–85', hip: '103–108' },
  { size: 'XXL', bust: '102–108', waist: '85–91', hip: '108–114' },
];

const GARMENT_TABLE = [
  { size: 'XS', length: '132', shoulder: '37', sleeve: '56' },
  { size: 'S', length: '134', shoulder: '38', sleeve: '57' },
  { size: 'M', length: '136', shoulder: '39', sleeve: '58' },
  { size: 'L', length: '138', shoulder: '40', sleeve: '59' },
  { size: 'XL', length: '140', shoulder: '41', sleeve: '60' },
  { size: 'XXL', length: '142', shoulder: '42', sleeve: '61' },
];

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

  const measures = [
    dict.sizeGuide.measureBust,
    dict.sizeGuide.measureWaist,
    dict.sizeGuide.measureHip,
    dict.sizeGuide.measureShoulder,
    dict.sizeGuide.measureSleeve,
    dict.sizeGuide.measureLength,
    dict.sizeGuide.measureHeight,
  ];

  const tableHead = [dict.sizeGuide.columnSize, dict.sizeGuide.columnBust, dict.sizeGuide.columnWaist, dict.sizeGuide.columnHip];
  const garmentHead = [dict.sizeGuide.columnSize, dict.sizeGuide.columnLength, ar ? 'الكتف' : 'Shoulder', ar ? 'الكم' : 'Sleeve'];

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
            <h2 className="text-h2">{dict.sizeGuide.bodyTitle}</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-small">
                <thead>
                  <tr className="border-b border-ink text-start">
                    {tableHead.map((h) => (
                      <th key={h} className="py-3 pe-4 text-start text-caption uppercase tracking-[0.12em] text-ink-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BODY_TABLE.map((r) => (
                    <tr key={r.size} className="border-b border-line">
                      <td className="py-3 pe-4 font-medium">{r.size}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.bust}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.waist}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.hip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-h2">{dict.sizeGuide.garmentTitle}</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-small">
                <thead>
                  <tr className="border-b border-ink">
                    {garmentHead.map((h) => (
                      <th key={h} className="py-3 pe-4 text-start text-caption uppercase tracking-[0.12em] text-ink-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GARMENT_TABLE.map((r) => (
                    <tr key={r.size} className="border-b border-line">
                      <td className="py-3 pe-4 font-medium">{r.size}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.length}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.shoulder}</td>
                      <td className="py-3 pe-4 tabular-nums text-ink-muted">{r.sleeve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
