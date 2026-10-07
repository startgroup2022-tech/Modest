import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/lib/permission-defs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@attention-modestfashion.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const DEMO_EMAIL = process.env.SEED_DEMO_CUSTOMER ?? 'customer@example.com';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Customer123!';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const ABAYA_SIZES = ['52', '54', '56', '58', '60'];

interface ProductSeed {
  slug: string;
  nameEn: string;
  nameAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  priceBhd: number;
  compareAtBhd?: number;
  categorySlugs: string[];
  collectionSlugs: string[];
  images: string[];
  descriptionEn: string;
  descriptionAr: string;
  detailsEn: string;
  detailsAr: string;
  materialsEn: string;
  materialsAr: string;
  careEn: string;
  careAr: string;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  madeToOrder?: boolean;
  preOrder?: boolean;
  sizes: string[];
  metaTitleEn?: string;
  metaTitleAr?: string;
  metaDescEn?: string;
  metaDescAr?: string;
}

// The approved storefront catalog is exactly the eight pieces currently shown
// on the live site's homepage ("Latest Products"). Everything else in the
// historical seed list is archived — never deleted — so orders that reference
// it keep their integrity while the storefront stops showing it.
const APPROVED_SLUGS = [
  'midnight-garden-kimono-ii',
  'ligne-sauvage',
  'le-retour',
  'hidden-in-the-dark',
  'black-tie-pre-order',
  'the-queen-b-cape',
  'tide-over-gown',
  'etoile-de-soi',
] as const;

// Silhouette / cut assignment and the approved default tailoring fee. The fee
// is set only where the specification names it unambiguously; no fallback is
// invented for other products.
const CUT_BY_SLUG: Record<string, string> = {
  'midnight-garden-kimono-ii': 'TAILORED',
  'tide-over-gown': 'TAILORED',
  'etoile-de-soi': 'BISHT',
};
const TAILOR_FEE_BY_SLUG: Record<string, number> = {
  'tide-over-gown': 20,
  'etoile-de-soi': 20,
};

const products: ProductSeed[] = [
  {
    slug: 'midnight-garden-kimono-ii',
    nameEn: 'Midnight Garden Kimono II',
    nameAr: 'كيمونو حديقة منتصف الليل II',
    subtitleEn: 'Silk abaya with a kimono-inspired wrap neckline',
    subtitleAr: 'عباية حريرية بقَصّة كيمونو',
    priceBhd: 95,
    categorySlugs: ['ec26'],
    collectionSlugs: ['signature'],
    images: ['/media/products/midnight-1.webp', '/media/products/midnight-2.webp'],
    descriptionEn:
      'Refined expression of sculpted elegance, the Midnight Garden Kimono Abaya is designed as a modern interpretation of timeless tailoring, where traditional kimono influence meets quiet artistry and contemporary sophistication. Created for the woman who values refined details, fluid structure, and understated luxury, this piece embodies effortless elegance with a distinctive modern spirit.',
    descriptionAr:
      'تعبير راقٍ عن الأناقة المنحوتة، صُممت عباية كيمونو حديقة منتصف الليل كتفسير عصري للخياطة الخالدة، حيث يلتقي تأثير الكيمونو التقليدي بالحرفية الهادئة والرقي المعاصر. صُنعت للمرأة التي تقدّر التفاصيل الدقيقة والبنية الانسيابية والفخامة الهادئة.',
    detailsEn:
      'Kimono-inspired wrap neckline with refined contrast piping\nGarden-inspired abstract print in deep midnight plum tones\nRelaxed straight silhouette with graceful movement\nWide kimono-inspired sleeves with tonal cuff detailing\nModel is 168 cm and wears size M, abaya length 57"',
    detailsAr:
      'قَصّة كيمونو مع حواف متباينة أنيقة\nطبعة زهرية تجريدية بدرجات البرقوق العميق\nقَصّة مستقيمة مريحة بحركة رشيقة\nأكمام كيمونو واسعة بتفاصيل مبطنة\nالعارضة بطول 168 سم وترتدي مقاس M، بطول عباية 57 إنش',
    materialsEn: 'Luxurious premium silk with a soft satin sheen',
    materialsAr: 'حرير فاخر عالي الجودة بلمعة ساتان ناعمة',
    careEn: 'Dry clean only. Store on a padded hanger away from direct sunlight.',
    careAr: 'تنظيف جاف فقط. يُحفظ على علاقة مبطنة بعيداً عن أشعة الشمس المباشرة.',
    isNewArrival: true,
    isFeatured: true,
    sizes: ABAYA_SIZES,
    metaTitleEn: 'Midnight Garden Kimono II — Silk Abaya | Attention Modest Fashion',
    metaTitleAr: 'كيمونو حديقة منتصف الليل II — عباية حريرية | أتنشن',
    metaDescEn:
      'A silk abaya with a kimono-inspired wrap neckline and deep plum abstract print. Made in Bahrain by Attention Modest Fashion.',
    metaDescAr: 'عباية حريرية بقَصّة كيمونو وطبعة تجريدية بلون البرقوق. صناعة البحرين من أتنشن.',
  },
  {
    slug: 'ligne-sauvage',
    nameEn: 'Ligne Sauvage',
    nameAr: 'خط بري',
    subtitleEn: 'Sculpted line abaya',
    subtitleAr: 'عباية بخط منحوت',
    priceBhd: 87,
    categorySlugs: ['ss25'],
    collectionSlugs: ['signature'],
    images: ['/media/products/ligne-1.webp', '/media/products/ligne-2.webp'],
    descriptionEn:
      'A study in sculptural restraint, Ligne Sauvage traces a single confident line from shoulder to hem. The result is a quiet, architectural abaya that moves with intention.',
    descriptionAr:
      'دراسة في الانضباط النحتي، يرسم خط بري خطاً واحداً واثقاً من الكتف إلى الحاشية، لتكون عباية هادئة معمارية تتحرك بعمق.',
    detailsEn: 'Architectural seam line\nFluid crepe construction\nConcealed placket\nModel is 170 cm and wears size M',
    detailsAr: 'خط خياطة معماري\nقماش كريب انسيابي\nإغلاق مخفي\nالعارضة بطول 170 سم وترتدي مقاس M',
    materialsEn: 'Italian crepe',
    materialsAr: 'كريب إيطالي',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    isFeatured: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'An architectural crepe abaya with a single sculpted line. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية كريب معمارية بخط منحوت. من أتنشن، البحرين.',
  },
  {
    slug: 'le-retour',
    nameEn: 'Le Retour',
    nameAr: 'العودة',
    subtitleEn: 'Return to form',
    subtitleAr: 'عودة إلى الشكل',
    priceBhd: 58.8,
    categorySlugs: ['ss25'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/retour-1.webp', '/media/products/retour-2.webp'],
    descriptionEn:
      'Le Retour is the quiet return to essentials — a clean, everyday abaya cut for ease and finished with considered detail.',
    descriptionAr:
      'العودة هي الرجوع الهادئ إلى الأساسيات — عباية يومية نظيفة مصممة للراحة ومنتهية بتفاصيل مدروسة.',
    detailsEn: 'Relaxed everyday cut\nSoft drape\nDiscreet side pockets',
    detailsAr: 'قَصّة يومية مريحة\nانسدال ناعم\nجيوب جانبية مخفية',
    materialsEn: 'Washed crepe',
    materialsAr: 'كريب مغسول',
    careEn: 'Machine wash cold, gentle cycle.',
    careAr: 'غسيل آلي بماء بارد على دورة لطيفة.',
    sizes: ABAYA_SIZES,
    metaDescEn: 'A clean everyday abaya in washed crepe. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية يومية نظيفة من الكريب المغسول. من أتنشن، البحرين.',
  },
  {
    slug: 'hidden-in-the-dark',
    nameEn: 'Hidden in the Dark',
    nameAr: 'مخفية في العتمة',
    subtitleEn: 'Deep tone, quiet detail',
    subtitleAr: 'لون عميق وتفاصيل هادئة',
    priceBhd: 90,
    categorySlugs: ['fw25'],
    collectionSlugs: ['signature'],
    images: ['/media/products/hidden-1.webp', '/media/products/hidden-2.webp'],
    descriptionEn:
      'Hidden in the Dark is a meditation on depth — a tonal abaya whose detail reveals itself only on approach.',
    descriptionAr:
      'مخفية في العتمة تأمل في العمق — عباية بلون واحد تكشف تفاصيلها عند الاقتراب فقط.',
    detailsEn: 'Tonal embroidery detail\nStructured shoulder\nColumn silhouette',
    detailsAr: 'تفاصيل تطريز بلون واحد\nكتف مهيكل\nقَصّة عمودية',
    materialsEn: 'Textured jacquard',
    materialsAr: 'جاكار محبب',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    isFeatured: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'A tonal jacquard abaya with embroidery that reveals itself on approach. By Attention.',
    metaDescAr: 'عباية جاكار بلون واحد بتطريز يظهر عند الاقتراب. من أتنشن.',
  },
  {
    slug: 'black-tie-pre-order',
    nameEn: 'Black Tie',
    nameAr: 'ربطة سوداء',
    subtitleEn: 'Evening abaya, made to order',
    subtitleAr: 'عباية سهرة، حسب الطلب',
    priceBhd: 90,
    categorySlugs: ['fw25'],
    collectionSlugs: ['made-to-order'],
    images: ['/media/products/blacktie-1.webp', '/media/products/blacktie-2.webp'],
    descriptionEn:
      'Black Tie is an evening abaya for the formal occasion, produced to order in our Bahrain atelier so that fit, length and finish are yours alone.',
    descriptionAr:
      'ربطة سوداء عباية سهرة للمناسبات الرسمية، تُنتج حسب الطلب في أتيليه البحرين ليكون المقاس والطول والتشطيب خاصاً بك وحدك.',
    detailsEn: 'Made to order in 2–3 weeks\nSatin-trimmed placket\nTailored to your measurements\nFinal sale — made-to-order pieces are non-returnable',
    detailsAr: 'تُصنع حسب الطلب خلال 2–3 أسابيع\nإغلاق بحاشية ساتان\nمخيطة على مقاساتك\nبيع نهائي — القطع حسب الطلب غير قابلة للاسترجاع',
    materialsEn: 'Silk blend with satin trim',
    materialsAr: 'مزيج حريري مع حاشية ساتان',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    madeToOrder: true,
    preOrder: true,
    isNewArrival: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'An evening abaya produced to order in Bahrain. Allow 2–3 weeks for atelier production.',
    metaDescAr: 'عباية سهرة تُنتج حسب الطلب في البحرين. تُمنح 2–3 أسابيع للإنتاج.',
  },
  {
    slug: 'the-queen-b-cape',
    nameEn: 'The Queen B Cape',
    nameAr: 'كيب الملكة B',
    subtitleEn: 'Cape silhouette with presence',
    subtitleAr: 'قَصّة كيب بحضور قوي',
    priceBhd: 89,
    categorySlugs: ['ec26'],
    collectionSlugs: ['signature'],
    images: ['/media/products/queenb-1.webp', '/media/products/queenb-2.webp'],
    descriptionEn:
      'The Queen B Cape is a statement of quiet authority — a cape silhouette that frames the figure without effort.',
    descriptionAr:
      'كيب الملكة B تعبير عن سلطة هادئة — قَصّة كيب تؤطر القوام بلا جهد.',
    detailsEn: 'Cape construction\nOpen front\nExtended shoulder line',
    detailsAr: 'تصميم كيب\nمقدمة مفتوحة\nخط كتف ممتد',
    materialsEn: 'Wool crepe',
    materialsAr: 'كريب صوف',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    isNewArrival: true,
    sizes: SIZES,
    metaDescEn: 'A cape-silhouette abaya with an extended shoulder line. By Attention Modest Fashion.',
    metaDescAr: 'عباية بقَصّة كيب وخط كتف ممتد. من أتنشن.',
  },
  {
    slug: 'tide-over-gown',
    nameEn: 'Tide Over Gown',
    nameAr: 'فستان المد',
    subtitleEn: 'Flowing gown',
    subtitleAr: 'فستان منسدل',
    priceBhd: 63,
    categorySlugs: ['ss25'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/tide-1.webp', '/media/products/tide-2.webp'],
    descriptionEn:
      'Tide Over Gown moves like water — a flowing gown cut for ease and finished for evening.',
    descriptionAr:
      'فستان المد يتحرك كالماء — فستان منسدل مصمم للراحة ومنتهى للسهرة.',
    detailsEn: 'Flowing bias cut\nFloor length\nConcealed back closure',
    detailsAr: 'قَصّة مائلة منسدلة\nبطول الأرض\nإغلاق خلفي مخفي',
    materialsEn: 'Satin-back crepe',
    materialsAr: 'كريب بظهر ساتان',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    sizes: SIZES,
    metaDescEn: 'A flowing bias-cut gown in satin-back crepe. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'فستان منسدل بقَصّة مائلة من الكريب. من أتنشن، البحرين.',
  },
  {
    slug: 'etoile-de-soi',
    nameEn: 'Étoile de Soi',
    nameAr: 'نجمة الذات',
    subtitleEn: 'Evening star',
    subtitleAr: 'نجمة المساء',
    priceBhd: 69,
    categorySlugs: ['ss25'],
    collectionSlugs: ['signature'],
    images: ['/media/products/etoile-1.webp', '/media/products/etoile-2.webp'],
    descriptionEn:
      'Étoile de Soi — the evening star you carry within. A softly embellished abaya for the woman who lights her own way.',
    descriptionAr:
      'نجمة الذات — النجمة التي تحملينها في داخلك. عباية بزخرفة ناعمة للمرأة التي تضيء طريقها بنفسها.',
    detailsEn: 'Subtle beadwork\nSoft shoulder\nStraight fall',
    detailsAr: 'تطريز خرزي ناعم\nكتف ناعم\nانسدال مستقيم',
    materialsEn: 'Silk georgette',
    materialsAr: 'حرير جورجيت',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    isFeatured: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'A softly embellished silk georgette abaya. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية جورجيت حريري بزخرفة ناعمة. من أتنشن، البحرين.',
  },
  {
    slug: 'atelier-de-lin',
    nameEn: 'Atelier de Lin',
    nameAr: 'أتيليه الكتان',
    subtitleEn: 'Linen atelier piece',
    subtitleAr: 'قطعة الأتيليه الكتانية',
    priceBhd: 67,
    categorySlugs: ['ec26'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/atelier-1.webp', '/media/products/atelier-2.webp'],
    descriptionEn:
      'Atelier de Lin is cut from breathable linen for warm days — relaxed, natural and quietly refined.',
    descriptionAr:
      'أتيليه الكتان مقصوص من الكتان المسامي للأيام الدافئة — مريح وطبيعي وراقٍ بهدوء.',
    detailsEn: 'Breathable linen\nRelaxed fit\nNatural texture',
    detailsAr: 'كتان مسامي\nقَصّة مريحة\nملمس طبيعي',
    materialsEn: '100% linen',
    materialsAr: 'كتان 100%',
    careEn: 'Machine wash cold, hang to dry.',
    careAr: 'غسيل آلي بماء بارد، تجفيف بالتعليق.',
    isNewArrival: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'A breathable linen abaya for warm days. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية كتان مسامية للأيام الدافئة. من أتنشن، البحرين.',
  },
  {
    slug: 'leveil-lent',
    nameEn: "L'eveil Lent",
    nameAr: 'اليقظة البطيئة',
    subtitleEn: 'Slow awakening',
    subtitleAr: 'صحو هادئ',
    priceBhd: 67,
    categorySlugs: ['fw25'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/eveil-1.webp', '/media/products/eveil-2.webp'],
    descriptionEn:
      "L'eveil Lent is a slow, soft awakening — a layered piece for transitional weather.",
    descriptionAr:
      'اليقظة البطيئة صحو ناعم ومتأنٍ — قطعة متعددة الطبقات للطقس المتغير.',
    detailsEn: 'Layered construction\nSoft structure\nTransitional weight',
    detailsAr: 'بنية متعددة الطبقات\nهيكل ناعم\nوزن انتقالي',
    materialsEn: 'Brushed cotton blend',
    materialsAr: 'مزيج قطن مفروش',
    careEn: 'Machine wash cold.',
    careAr: 'غسيل آلي بماء بارد.',
    sizes: ABAYA_SIZES,
    metaDescEn: 'A layered abaya for transitional weather. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية متعددة الطبقات للطقس المتغير. من أتنشن، البحرين.',
  },
  {
    slug: 'ecume-douce-pre-order',
    nameEn: "E'cume Douce",
    nameAr: 'رغوة ناعمة',
    subtitleEn: 'Soft foam, made to order',
    subtitleAr: 'رغوة ناعمة، حسب الطلب',
    priceBhd: 73,
    categorySlugs: ['ec26'],
    collectionSlugs: ['made-to-order'],
    images: ['/media/products/ecume-pre-1.webp', '/media/products/ecume-pre-2.webp'],
    descriptionEn:
      "E'cume Douce is produced to order in soft, foam-light silk — a made-to-order piece shaped to your measurements.",
    descriptionAr:
      'رغوة ناعمة تُنتج حسب الطلب من حرير خفيف كالرغوة — قطعة تُشكّل على مقاساتك.',
    detailsEn: 'Made to order in 2–3 weeks\nCustom length available\nFinal sale — made-to-order pieces are non-returnable',
    detailsAr: 'تُصنع حسب الطلب خلال 2–3 أسابيع\nطول مخصص متاح\nبيع نهائي — القطع حسب الطلب غير قابلة للاسترجاع',
    materialsEn: 'Lightweight silk',
    materialsAr: 'حرير خفيف',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    madeToOrder: true,
    preOrder: true,
    isNewArrival: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'A made-to-order silk abaya shaped to your measurements. Allow 2–3 weeks.',
    metaDescAr: 'عباية حريرية حسب الطلب تُشكّل على مقاساتك. تُمنح 2–3 أسابيع.',
  },
  {
    slug: 'ecume-douce',
    nameEn: "E'cume Douce",
    nameAr: 'رغوة ناعمة',
    subtitleEn: 'Soft foam',
    subtitleAr: 'رغوة ناعمة',
    priceBhd: 73,
    categorySlugs: ['ss25'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/ecume-1.webp', '/media/products/ecume-2.webp'],
    descriptionEn:
      "E'cume Douce is a light, foam-soft abaya that floats rather than falls.",
    descriptionAr:
      'رغوة ناعمة عباية خفيفة ناعمة كالرغوة تطفو بدلاً من أن تسقط.',
    detailsEn: 'Lightweight silk\nFloating drape\nSoft hem',
    detailsAr: 'حرير خفيف\nانسدال طافٍ\nحاشية ناعمة',
    materialsEn: 'Lightweight silk',
    materialsAr: 'حرير خفيف',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    sizes: ABAYA_SIZES,
    metaDescEn: 'A lightweight silk abaya with a floating drape. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية حريرية خفيفة بانسدال طافٍ. من أتنشن، البحرين.',
  },
  {
    slug: 'nuit-claire',
    nameEn: 'Nuit Claire',
    nameAr: 'ليلة صافية',
    subtitleEn: 'Clear night',
    subtitleAr: 'ليلة صافية',
    priceBhd: 82,
    categorySlugs: ['fw25'],
    collectionSlugs: ['signature'],
    images: ['/media/products/hidden-1.webp', '/media/products/etoile-2.webp'],
    descriptionEn: 'Nuit Claire is a clear, uncluttered evening abaya with a single quiet detail.',
    descriptionAr: 'ليلة صافية عباية سهرة نظيفة بلا زخرفة، بتفصيل واحد هادئ.',
    detailsEn: 'Minimal construction\nEvening weight\nClean finish',
    detailsAr: 'تصميم بسيط\nوزن سهرة\nتشطيب نظيف',
    materialsEn: 'Silk blend',
    materialsAr: 'مزيج حريري',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    sizes: ABAYA_SIZES,
    metaDescEn: 'A minimal evening abaya in silk blend. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية سهرة بسيطة من مزيج حريري. من أتنشن، البحرين.',
  },
  {
    slug: 'sable-dore',
    nameEn: 'Sable Doré',
    nameAr: 'رمل ذهبي',
    subtitleEn: 'Warm sand',
    subtitleAr: 'رمل دافئ',
    priceBhd: 79,
    categorySlugs: ['ec26'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/atelier-1.webp', '/media/products/ligne-2.webp'],
    descriptionEn: 'Sable Doré is drawn from the warm sand tones of the Gulf — an easy, luminous everyday piece.',
    descriptionAr: 'رمل ذهبي مستوحى من درجات الرمل الدافئة في الخليج — قطعة يومية مضيئة ومريحة.',
    detailsEn: 'Warm neutral tone\nEveryday weight\nStraight cut',
    detailsAr: 'لون محايد دافئ\nوزن يومي\nقَصّة مستقيمة',
    materialsEn: 'Cotton-silk blend',
    materialsAr: 'مزيج قطن وحرير',
    careEn: 'Dry clean recommended.',
    careAr: 'يُفضّل التنظيف الجاف.',
    isNewArrival: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'A luminous everyday abaya in warm sand tones. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية يومية مضيئة بدرجات الرمل الدافئة. من أتنشن، البحرين.',
  },
  {
    slug: 'ombre-legere',
    nameEn: 'Ombre Légère',
    nameAr: 'ظل خفيف',
    subtitleEn: 'Light shadow',
    subtitleAr: 'ظل خفيف',
    priceBhd: 71,
    categorySlugs: ['ss25'],
    collectionSlugs: ['essentials'],
    images: ['/media/products/eveil-2.webp', '/media/products/tide-1.webp'],
    descriptionEn: 'Ombre Légère is a light-shadow layer for warm evenings.',
    descriptionAr: 'ظل خفيف طبقة رقيقة لأمسيات دافئة.',
    detailsEn: 'Sheer overlay\nLight layer\nSoft movement',
    detailsAr: 'طبقة شفافة\nوزن خفيف\nحركة ناعمة',
    materialsEn: 'Chiffon overlay',
    materialsAr: 'طبقة شيفون',
    careEn: 'Hand wash cold.',
    careAr: 'غسيل يدوي بماء بارد.',
    sizes: ABAYA_SIZES,
    metaDescEn: 'A light chiffon-layer abaya for warm evenings. By Attention Modest Fashion, Bahrain.',
    metaDescAr: 'عباية بطبقة شيفون خفيفة للأمسيات الدافئة. من أتنشن، البحرين.',
  },
  {
    slug: 'the-signature-abaya',
    nameEn: 'The Signature Abaya',
    nameAr: 'العباية المميزة',
    subtitleEn: 'The house silhouette',
    subtitleAr: 'قَصّة الدار',
    priceBhd: 110,
    categorySlugs: ['ec26'],
    collectionSlugs: ['signature'],
    images: ['/media/products/midnight-2.webp', '/media/products/queenb-1.webp'],
    descriptionEn:
      'The Signature Abaya is the house silhouette — the definitive Attention cut, made to order in the fabric of your choosing.',
    descriptionAr:
      'العباية المميزة هي قَصّة الدار — قَصّة أتنشن المعتمدة، تُصنع حسب الطلب من القماش الذي تختارينه.',
    detailsEn: 'Made to order in 2–3 weeks\nFabric selection consultation\nTailored to your measurements\nFinal sale — made-to-order pieces are non-returnable',
    detailsAr: 'تُصنع حسب الطلب خلال 2–3 أسابيع\nاستشارة لاختيار القماش\nمخيطة على مقاساتك\nبيع نهائي — القطع حسب الطلب غير قابلة للاسترجاع',
    materialsEn: 'Premium silk or crepe (your choice)',
    materialsAr: 'حرير أو كريب فاخر (حسب اختيارك)',
    careEn: 'Dry clean only.',
    careAr: 'تنظيف جاف فقط.',
    madeToOrder: true,
    isFeatured: true,
    sizes: ABAYA_SIZES,
    metaDescEn: 'The signature Attention abaya, made to order in your chosen fabric. Allow 2–3 weeks.',
    metaDescAr: 'العباية المميزة من أتنشن، حسب الطلب من قماشك المختار. تُمنح 2–3 أسابيع.',
  },
];

async function main() {
  console.log('▶ Seeding Attention Modest Fashion…');

  // ── Roles ──────────────────────────────────────────────
  const roleDefs = [
    { name: 'ADMIN' as const, description: 'Full access' },
    { name: 'MANAGER' as const, description: 'Catalogue & orders' },
    { name: 'SUPPORT' as const, description: 'Orders & customers' },
    { name: 'CUSTOMER' as const, description: 'Storefront customer' },
    { name: 'TAILOR' as const, description: 'Tailor Portal (separate credential)' },
  ];
  const roles: Record<string, string> = {};
  for (const r of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roles[r.name] = role.id;
  }

  // ── Role permissions ───────────────────────────────────
  for (const [roleName, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = roles[roleName];
    if (!roleId) continue;
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    if (perms.length) {
      await prisma.rolePermission.createMany({
        data: perms.map((permission) => ({ roleId, permission })),
        skipDuplicates: true,
      });
    }
  }

  // ── Expense categories ─────────────────────────────────
  const expenseCategories = [
    { nameEn: 'Fabric & Materials', nameAr: 'الأقمشة والمواد' },
    { nameEn: 'Tailor Wages', nameAr: 'أجور الخياطة' },
    { nameEn: 'Packaging', nameAr: 'التغليف' },
    { nameEn: 'Shipping & Courier', nameAr: 'الشحن والتوصيل' },
    { nameEn: 'Marketing', nameAr: 'التسويق' },
    { nameEn: 'Software & Subscriptions', nameAr: 'البرمجيات والاشتراكات' },
    { nameEn: 'Rent & Utilities', nameAr: 'الإيجار والمرافق' },
    { nameEn: 'Other', nameAr: 'أخرى' },
  ];
  for (const c of expenseCategories) {
    const existing = await prisma.expenseCategory.findFirst({ where: { nameEn: c.nameEn } });
    if (!existing) await prisma.expenseCategory.create({ data: c });
  }

  // ── Tailors (atelier) ──────────────────────────────────
  const tailors = [
    { code: 'TL-001', nameEn: 'Atelier A — Abayas', nameAr: 'الأتيليه أ — العبايات', specialization: 'Abayas', capacity: 6, rateBhd: 12 },
    { code: 'TL-002', nameEn: 'Atelier B — Dresses', nameAr: 'الأتيليه ب — الفساتين', specialization: 'Dresses', capacity: 5, rateBhd: 14 },
    { code: 'TL-003', nameEn: 'Atelier C — Embroidery', nameAr: 'الأتيليه ج — التطريز', specialization: 'Embroidery', capacity: 4, rateBhd: 18 },
  ];
  for (const t of tailors) {
    await prisma.tailor.upsert({
      where: { code: t.code },
      update: t,
      create: { ...t, status: 'ACTIVE' },
    });
  }

  // ── Users ──────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { roleId: roles.ADMIN },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      firstName: 'Attention',
      lastName: 'Admin',
      roleId: roles.ADMIN,
      locale: 'en',
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { roleId: roles.CUSTOMER },
    create: {
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      firstName: 'Layla',
      lastName: 'Ahmed',
      phone: '+973 3225 0467',
      roleId: roles.CUSTOMER,
      locale: 'en',
    },
  });

  const demoCustomer = await prisma.customer.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: { userId: demoUser.id, phone: '+973 3225 0467' },
  });

  await prisma.measurement.upsert({
    where: { id: 'seed-measurement-demo' },
    update: {},
    create: {
      id: 'seed-measurement-demo',
      customerId: demoCustomer.id,
      name: 'My measurements',
      height: 168,
      shoulder: 38,
      bust: 90,
      waist: 72,
      hip: 98,
      sleeve: 58,
      armhole: 42,
      length: 145,
      isDefault: true,
    },
  });

  // ── Currencies ─────────────────────────────────────────
  const currencies = [
    { code: 'BHD', nameEn: 'Bahraini Dinar', nameAr: 'دينار بحريني', symbolEn: 'BHD', symbolAr: 'د.ب', decimals: 3, rateToBhd: 1, isDefault: true, sortOrder: 0 },
    { code: 'SAR', nameEn: 'Saudi Riyal', nameAr: 'ريال سعودي', symbolEn: 'SAR', symbolAr: 'ر.س', decimals: 2, rateToBhd: 9.97, isDefault: false, sortOrder: 1 },
    { code: 'AED', nameEn: 'UAE Dirham', nameAr: 'درهم إماراتي', symbolEn: 'AED', symbolAr: 'د.إ', decimals: 2, rateToBhd: 9.77, isDefault: false, sortOrder: 2 },
    { code: 'KWD', nameEn: 'Kuwaiti Dinar', nameAr: 'دينار كويتي', symbolEn: 'KWD', symbolAr: 'د.ك', decimals: 3, rateToBhd: 0.81, isDefault: false, sortOrder: 3 },
    { code: 'QAR', nameEn: 'Qatari Riyal', nameAr: 'ريال قطري', symbolEn: 'QAR', symbolAr: 'ر.ق', decimals: 2, rateToBhd: 9.68, isDefault: false, sortOrder: 4 },
    { code: 'OMR', nameEn: 'Omani Rial', nameAr: 'ريال عماني', symbolEn: 'OMR', symbolAr: 'ر.ع', decimals: 3, rateToBhd: 1.02, isDefault: false, sortOrder: 5 },
  ];
  for (const c of currencies) {
    const row = await prisma.currency.upsert({ where: { code: c.code }, update: c, create: c });
    await prisma.exchangeRate.create({
      data: { currencyId: row.id, code: c.code, rateToBhd: c.rateToBhd },
    });
  }

  // ── Categories ─────────────────────────────────────────
  const categories = [
    { slug: 'ss25', nameEn: 'SS25', nameAr: 'ربيع/صيف 25', descriptionEn: 'Spring/Summer 2025 collection', descriptionAr: 'مجموعة ربيع/صيف 2025', sortOrder: 1 },
    { slug: 'fw25', nameEn: 'FW25', nameAr: 'خريف/شتاء 25', descriptionEn: 'Autumn/Winter 2025 collection', descriptionAr: 'مجموعة خريف/شتاء 2025', sortOrder: 2 },
    { slug: 'ec26', nameEn: 'EC26', nameAr: 'EC26', descriptionEn: 'Eid Collection 2026', descriptionAr: 'مجموعة العيد 2026', sortOrder: 3 },
    { slug: 'essn', nameEn: 'ESSN', nameAr: 'الأساسيات', descriptionEn: 'Everyday essentials', descriptionAr: 'أساسيات يومية', sortOrder: 4 },
  ];
  const categoryIds: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
    categoryIds[c.slug] = row.id;
  }

  // ── Collections ────────────────────────────────────────
  const collections = [
    { slug: 'new-season', nameEn: 'New Season', nameAr: 'الموسم الجديد', taglineEn: 'The latest arrivals', taglineAr: 'أحدث ما وصل', heroImage: '/media/products/atelier-1.webp', isFeatured: true, sortOrder: 1 },
    { slug: 'made-to-order', nameEn: 'Made to Order', nameAr: 'حسب الطلب', taglineEn: 'Cut and finished by hand', taglineAr: 'تُقص وتُنهى يدوياً', heroImage: '/media/products/blacktie-1.webp', isFeatured: true, sortOrder: 2 },
    { slug: 'signature', nameEn: 'Signature', nameAr: 'التوقيع', taglineEn: 'The house silhouettes', taglineAr: 'قَصّات الدار', heroImage: '/media/products/midnight-1.webp', isFeatured: true, sortOrder: 3 },
    { slug: 'essentials', nameEn: 'Essentials', nameAr: 'الأساسيات', taglineEn: 'Everyday modest luxury', taglineAr: 'فخامة يومية محتشمة', heroImage: '/media/products/retour-1.webp', isFeatured: true, sortOrder: 4 },
  ];
  const collectionIds: Record<string, string> = {};
  for (const c of collections) {
    const row = await prisma.collection.upsert({ where: { slug: c.slug }, update: c, create: c });
    collectionIds[c.slug] = row.id;
  }

  // ── Silhouettes / cuts + size guide (specification values) ──
  // The database is the source of truth for the storefront size guide. These
  // seeded values come from the authoritative operating specification; no
  // values are invented. Editing them in Admin later never changes historical
  // order snapshots.
  const READY_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const cuts = [
    {
      code: 'TAILORED',
      nameEn: 'Tailored Silhouette',
      nameAr: 'القَصّة المُخيطة',
      descriptionEn: 'A structured, tailored cut.',
      descriptionAr: 'قَصّة مُخيطة ومهيكلة.',
      sortOrder: 1,
      fields: [
        { key: 'shoulder_width', labelEn: 'Shoulder Width', labelAr: 'عرض الكتف', min: 12, max: 22, helperEn: null, helperAr: null, sortOrder: 1 },
        {
          key: 'half_bust', labelEn: 'Half Bust', labelAr: 'نصف الصدر', min: 16, max: 34, sortOrder: 2,
          helperEn: 'Measured across the garment laid flat — half circumference.',
          helperAr: 'يُقاس عرضاً على القطعة مفرودة — نصف المحيط.',
        },
        {
          key: 'sleeve_length', labelEn: 'Sleeve Length', labelAr: 'طول الكم', min: 16, max: 34, sortOrder: 3,
          helperEn: null, helperAr: null,
        },
        { key: 'half_sleeve_bicep', labelEn: 'Half Sleeve Bicep', labelAr: 'نصف عَضلة الكم', min: 4, max: 12, sortOrder: 4, helperEn: 'Across the sleeve at the bicep, laid flat.', helperAr: 'عرض الكم عند العَضلة، مفروداً.' },
        { key: 'half_sleeve_hem', labelEn: 'Half Sleeve Hem', labelAr: 'نصف حاشية الكم', min: 3, max: 10, sortOrder: 5, helperEn: 'Across the sleeve opening, laid flat.', helperAr: 'عرض فتحة الكم، مفرودة.' },
      ],
      values: {
        shoulder_width: { XS: 15.2, S: 15.6, M: 15.8, L: 16, XL: 16.2 },
        half_bust: { XS: 22, S: 23, M: 24, L: 27, XL: 28 },
        sleeve_length: { XS: 22, S: 23, M: 24, L: 25, XL: 26 },
        half_sleeve_bicep: { XS: 6, S: 6.5, M: 7, L: 7.5, XL: 8.2 },
        half_sleeve_hem: { XS: 4.75, S: 5.25, M: 5.5, L: 6, XL: 6.7 },
      },
    },
    {
      code: 'BISHT',
      nameEn: 'Bisht Silhouette',
      nameAr: 'قَصّة البشت',
      descriptionEn: 'A flowing bisht cut.',
      descriptionAr: 'قَصّة بشت منسدلة.',
      sortOrder: 2,
      fields: [
        { key: 'shoulder_width', labelEn: 'Shoulder Width', labelAr: 'عرض الكتف', min: 12, max: 22, sortOrder: 1, helperEn: null, helperAr: null },
        { key: 'half_bust', labelEn: 'Half Bust', labelAr: 'نصف الصدر', min: 16, max: 40, sortOrder: 2, helperEn: 'Measured across the garment laid flat — half circumference.', helperAr: 'يُقاس عرضاً على القطعة مفرودة — نصف المحيط.' },
        { key: 'sleeve_length', labelEn: 'Sleeve Length', labelAr: 'طول الكم', min: 14, max: 30, sortOrder: 3, helperEn: null, helperAr: null },
      ],
      values: {
        shoulder_width: { XS: 14.5, S: 14.9, M: 15, L: 15.2, XL: 15.5 },
        half_bust: { XS: 25, S: 27, M: 30, L: 36, XL: 39 },
        sleeve_length: { XS: 17, S: 18, M: 19, L: 20, XL: 21 },
      },
    },
  ];
  const cutIds: Record<string, string> = {};
  for (const cut of cuts) {
    // `update: {}` keeps an admin's live edits intact on repeated seed runs.
    const row = await prisma.productCut.upsert({
      where: { code: cut.code },
      update: {},
      create: {
        code: cut.code,
        nameEn: cut.nameEn,
        nameAr: cut.nameAr,
        descriptionEn: cut.descriptionEn,
        descriptionAr: cut.descriptionAr,
        sortOrder: cut.sortOrder,
      },
    });
    cutIds[cut.code] = row.id;

    const chart = await prisma.sizeChart.upsert({
      where: { cutId: row.id },
      update: {},
      create: { cutId: row.id, unit: 'inch' },
    });

    for (const f of cut.fields) {
      const field = await prisma.measurementField.upsert({
        where: { cutId_key: { cutId: row.id, key: f.key } },
        update: {},
        create: {
          cutId: row.id,
          key: f.key,
          labelEn: f.labelEn,
          labelAr: f.labelAr,
          unit: 'inch',
          minValue: f.min,
          maxValue: f.max,
          helperEn: f.helperEn,
          helperAr: f.helperAr,
          sortOrder: f.sortOrder,
        },
      });
      const sizeValues = (cut.values as Record<string, Record<string, number>>)[f.key] ?? {};
      for (const sizeCode of READY_SIZES) {
        const value = sizeValues[sizeCode];
        if (value == null) continue;
        await prisma.sizeChartValue.upsert({
          where: { chartId_fieldId_sizeCode: { chartId: chart.id, fieldId: field.id, sizeCode } },
          update: {},
          create: { chartId: chart.id, fieldId: field.id, sizeCode, value, sortOrder: READY_SIZES.indexOf(sizeCode) },
        });
      }
    }
  }

  // ── Products ───────────────────────────────────────────
  for (const p of products) {
    const approved = (APPROVED_SLUGS as readonly string[]).includes(p.slug);
    // Published-but-unavailable is distinct from unpublished: an archived
    // product is hidden everywhere; a preorder keeps its own lifecycle state.
    const status = !approved ? ('ARCHIVED' as const) : p.preOrder ? ('PREORDER' as const) : ('ACTIVE' as const);
    const cutCode = CUT_BY_SLUG[p.slug];
    const data = {
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      subtitleEn: p.subtitleEn,
      subtitleAr: p.subtitleAr,
      descriptionEn: p.descriptionEn,
      descriptionAr: p.descriptionAr,
      detailsEn: p.detailsEn,
      detailsAr: p.detailsAr,
      materialsEn: p.materialsEn,
      materialsAr: p.materialsAr,
      careEn: p.careEn,
      careAr: p.careAr,
      priceBhd: p.priceBhd,
      compareAtBhd: p.compareAtBhd,
      status,
      kind: p.madeToOrder ? ('MADE_TO_ORDER' as const) : ('READY_TO_WEAR' as const),
      cutId: cutCode ? cutIds[cutCode] : null,
      tailorFeeBhd: TAILOR_FEE_BY_SLUG[p.slug] ?? null,
      isFeatured: p.isFeatured ?? false,
      isNewArrival: p.isNewArrival ?? false,
      madeToOrder: p.madeToOrder ?? false,
      metaTitleEn: p.metaTitleEn,
      metaTitleAr: p.metaTitleAr,
      metaDescEn: p.metaDescEn,
      metaDescAr: p.metaDescAr,
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: data,
    });

    await prisma.productMedia.deleteMany({ where: { productId: product.id } });
    await prisma.productMedia.createMany({
      data: p.images.map((url, i) => ({
        productId: product.id,
        url,
        altEn: `${p.nameEn} — view ${i + 1}`,
        altAr: `${p.nameAr} — عرض ${i + 1}`,
        sortOrder: i,
        isPrimary: i === 0,
      })),
    });

    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    for (const cs of p.categorySlugs) {
      await prisma.productCategory.create({ data: { productId: product.id, categoryId: categoryIds[cs] } });
    }
    await prisma.productCollection.deleteMany({ where: { productId: product.id } });
    for (const cs of p.collectionSlugs) {
      await prisma.productCollection.create({ data: { productId: product.id, collectionId: collectionIds[cs] } });
    }

    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    // A cut product is sold by the ready sizes of its own size chart, so its
    // variants must be exactly those codes. Deriving them here (rather than from
    // a hand-maintained `sizes` list) keeps variants and chart in lockstep — a
    // cut product can never be seeded with sizes its chart does not offer.
    const variantSizes = cutCode ? READY_SIZES : p.sizes;
    for (let i = 0; i < variantSizes.length; i++) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${p.slug.toUpperCase().replace(/-/g, '').slice(0, 12)}-${variantSizes[i]}`,
          size: variantSizes[i],
          stock: p.preOrder ? 0 : 4 + ((i * 3) % 7),
          stockStatus: p.preOrder ? 'PRE_ORDER' : 'IN_STOCK',
          sortOrder: i,
        },
      });
    }
  }

  // ── Shipping methods ───────────────────────────────────
  const shipping = [
    { code: 'bh-standard', nameEn: 'Bahrain Delivery', nameAr: 'التوصيل داخل البحرين', descriptionEn: 'Delivered within Bahrain in 2–4 working days.', descriptionAr: 'التوصيل داخل البحرين خلال 2–4 أيام عمل.', priceBhd: 2, freeOverBhd: 50, etaMinDays: 2, etaMaxDays: 4, sortOrder: 1, countries: ['BH'] },
    { code: 'gcc-standard', nameEn: 'GCC Delivery', nameAr: 'التوصيل لدول الخليج', descriptionEn: 'Delivered across the GCC in 4–7 working days.', descriptionAr: 'التوصيل إلى دول الخليج خلال 4–7 أيام عمل.', priceBhd: 6, freeOverBhd: 120, etaMinDays: 4, etaMaxDays: 7, sortOrder: 2, countries: ['SA', 'AE', 'KW', 'QA', 'OM'] },
    { code: 'intl-standard', nameEn: 'International Delivery', nameAr: 'التوصيل الدولي', descriptionEn: 'International delivery in 7–14 working days.', descriptionAr: 'التوصيل الدولي خلال 7–14 يوم عمل.', priceBhd: 12, freeOverBhd: 250, etaMinDays: 7, etaMaxDays: 14, sortOrder: 3, countries: [] },
  ];
  for (const s of shipping) {
    await prisma.shippingMethod.upsert({ where: { code: s.code }, update: s, create: s });
  }

  // ── Coupons ────────────────────────────────────────────
  const coupons = [
    { code: 'ATTENTION10', descriptionEn: '10% off your order', descriptionAr: 'خصم 10% على طلبك', discountType: 'PERCENTAGE' as const, valueBhd: 10, minOrderBhd: 30, maxDiscountBhd: 25, isActive: true },
    { code: 'WELCOME5', descriptionEn: 'BHD 5 off orders over BHD 40', descriptionAr: 'خصم 5 د.ب على الطلبات فوق 40 د.ب', discountType: 'FIXED' as const, valueBhd: 5, minOrderBhd: 40, isActive: true },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, update: c, create: c });
  }

  // ── Membership tiers ───────────────────────────────────
  // Tiers are thresholds on the count of qualifying paid, non-refunded pieces.
  // The count itself is derived (see src/lib/membership-db.ts); only the
  // thresholds are stored, so an owner can retune them without touching orders.
  const membershipTiers = [
    { code: 'SIGNATURE', nameEn: 'Signature', nameAr: 'سيجنتشر', minQualifying: 0, sortOrder: 1 },
    { code: 'GOLD', nameEn: 'Gold', nameAr: 'ذهبي', minQualifying: 5, sortOrder: 2 },
    { code: 'PLATINUM', nameEn: 'Platinum', nameAr: 'بلاتيني', minQualifying: 12, sortOrder: 3 },
  ];
  for (const t of membershipTiers) {
    await prisma.membershipTier.upsert({ where: { code: t.code }, update: t, create: t });
  }

  // ── Social links ───────────────────────────────────────
  await prisma.socialLink.deleteMany({});
  await prisma.socialLink.createMany({
    data: [
      { platform: 'instagram', url: 'https://www.instagram.com/attention_modestfashion', labelEn: 'Instagram', labelAr: 'إنستغرام', sortOrder: 1 },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@attentionmodestfashion', labelEn: 'TikTok', labelAr: 'تيك توك', sortOrder: 2 },
      { platform: 'whatsapp', url: 'https://wa.me/97332250467', labelEn: 'WhatsApp', labelAr: 'واتساب', sortOrder: 3 },
    ],
  });

  // ── Pages (policies) ───────────────────────────────────
  const pages = [
    {
      slug: 'size-guide',
      titleEn: 'Size Guide',
      titleAr: 'دليل المقاسات',
      bodyEn: `<h2>How to Measure</h2><p>Measure over light clothing and keep the tape level and snug, not tight. Ask someone to help for the most accurate result.</p><h3>Body Measurements</h3><ul><li><strong>Height</strong> — standing straight without shoes.</li><li><strong>Shoulder</strong> — from shoulder tip to shoulder tip across the back.</li><li><strong>Bust</strong> — around the fullest part of the bust.</li><li><strong>Waist</strong> — around the narrowest part of the waist.</li><li><strong>Hip</strong> — around the fullest part of the hips.</li><li><strong>Sleeve</strong> — from shoulder tip to wrist with the arm slightly bent.</li><li><strong>Armhole</strong> — around the top of the arm where it meets the shoulder.</li><li><strong>Length</strong> — from the shoulder to the desired hem.</li></ul><h3>Garment Sizes</h3><table><thead><tr><th>Size</th><th>Bust (cm)</th><th>Waist (cm)</th><th>Hip (cm)</th><th>Abaya Length (in)</th></tr></thead><tbody><tr><td>XS</td><td>82–86</td><td>62–66</td><td>88–92</td><td>54</td></tr><tr><td>S</td><td>86–90</td><td>66–70</td><td>92–96</td><td>55</td></tr><tr><td>M</td><td>90–94</td><td>70–74</td><td>96–100</td><td>56</td></tr><tr><td>L</td><td>94–99</td><td>74–79</td><td>100–105</td><td>57</td></tr><tr><td>XL</td><td>99–105</td><td>79–85</td><td>105–111</td><td>58</td></tr></tbody></table><p>Abaya numeric sizes (52–60) refer to length in inches. If you are between sizes, we recommend sizing up. For made-to-order pieces, your saved measurements are used directly.</p>`,
      bodyAr: `<h2>كيف تقيسين</h2><p>قيسي فوق ملابس خفيفة واجعلي الشريط مستوياً وملامساً دون شد. اطلبي المساعدة للحصول على أدق نتيجة.</p><h3>مقاسات الجسم</h3><ul><li><strong>الطول</strong> — واقفة بشكل مستقيم بدون حذاء.</li><li><strong>الكتف</strong> — من طرف الكتف إلى الطرف الآخر عبر الظهر.</li><li><strong>الصدر</strong> — حول أوسع جزء من الصدر.</li><li><strong>الخصر</strong> — حول أضيق جزء من الخصر.</li><li><strong>الورك</strong> — حول أوسع جزء من الوركين.</li><li><strong>الكم</strong> — من طرف الكتف إلى الرسغ والذراع مثنية قليلاً.</li><li><strong>فتحة الإبط</strong> — حول أعلى الذراع عند التقاء الكتف.</li><li><strong>الطول</strong> — من الكتف إلى الحاشية المطلوبة.</li></ul><h3>مقاسات القطعة</h3><table><thead><tr><th>المقاس</th><th>الصدر (سم)</th><th>الخصر (سم)</th><th>الورك (سم)</th><th>طول العباية (إنش)</th></tr></thead><tbody><tr><td>XS</td><td>82–86</td><td>62–66</td><td>88–92</td><td>54</td></tr><tr><td>S</td><td>86–90</td><td>66–70</td><td>92–96</td><td>55</td></tr><tr><td>M</td><td>90–94</td><td>70–74</td><td>96–100</td><td>56</td></tr><tr><td>L</td><td>94–99</td><td>74–79</td><td>100–105</td><td>57</td></tr><tr><td>XL</td><td>99–105</td><td>79–85</td><td>105–111</td><td>58</td></tr></tbody></table><p>المقاسات الرقمية للعباية (52–60) تشير إلى الطول بالإنش. إذا كنت بين مقاسين، نوصي بالمقاس الأكبر. للقطع حسب الطلب، تُستخدم مقاساتك المحفوظة مباشرة.</p>`,
    },
    {
      slug: 'return-policy',
      titleEn: 'Return Policy',
      titleAr: 'سياسة الاسترجاع',
      bodyEn: `<h2>Return &amp; Refund Policy</h2><p>At Attention Modest Fashion we strive to provide the best shopping experience. If you are not completely satisfied with your purchase, you may request a return or exchange under the following terms.</p><h3>1. Return Conditions</h3><p>You may request a return within 7 days from the date of delivery, provided that: the item is unused and in its original condition; the item includes all original tags and packaging; proof of purchase is provided (order number or receipt).</p><h3>2. Non-Returnable Items</h3><ul><li>Used or damaged items caused by the customer</li><li>Sale or discounted items</li><li>Customised or made-to-order products</li></ul><h3>3. Exchanges</h3><p>You may request an exchange if the item has a manufacturing defect or you received the wrong item. The item will be replaced with the same product or another item of equal value, subject to availability.</p><h3>4. Return Process</h3><p>Contact us via WhatsApp on +973 3225 0467 with your order number and product details (photos may be required). We will provide return instructions.</p><h3>5. Shipping Fees</h3><p>Customers are responsible for return shipping costs unless the return is due to our error. If the item is defective or incorrect, we cover the shipping costs.</p><h3>6. Refunds</h3><p>Once the returned item is received and inspected, your refund will be approved. Refunds are issued within 5–10 business days via the original payment method. Processing time may vary depending on your bank or payment provider.</p><h3>7. Order Cancellation</h3><p>Orders can only be cancelled before they are shipped. Once shipped, the return policy applies.</p><h3>8. Contact Us</h3><p>Phone / WhatsApp: +973 3225 0467</p>`,
      bodyAr: `<h2>سياسة الاسترجاع والاستبدال</h2><p>في أتنشن للموضة المحتشمة نسعى لتقديم أفضل تجربة تسوق. إذا لم تكوني راضية تماماً عن مشترياتك، يمكنك طلب الاسترجاع أو الاستبدال وفق الشروط التالية.</p><h3>1. شروط الاسترجاع</h3><p>يمكنك طلب الاسترجاع خلال 7 أيام من تاريخ التسليم، بشرط أن تكون القطعة غير مستخدمة وفي حالتها الأصلية، وأن تتضمن جميع البطاقات والتغليف الأصلي، مع تقديم إثبات الشراء (رقم الطلب أو الإيصال).</p><h3>2. القطع غير القابلة للاسترجاع</h3><ul><li>القطع المستخدمة أو المتضررة بسبب العميلة</li><li>القطع المخفّضة أو ضمن العروض</li><li>القطع المخصصة أو المصنوعة حسب الطلب</li></ul><h3>3. الاستبدال</h3><p>يمكنك طلب الاستبدال في حال وجود عيب صناعي أو استلام قطعة خاطئة. تُستبدل القطعة بنفس المنتج أو منتج آخر بالقيمة ذاتها حسب التوفر.</p><h3>4. إجراءات الاسترجاع</h3><p>تواصلي معنا عبر واتساب على ‎+973 3225 0467 مع رقم الطلب وتفاصيل المنتج (قد تُطلب صور). سنزودك بتعليمات الإرجاع.</p><h3>5. رسوم الشحن</h3><p>العميلة مسؤولة عن تكاليف شحن الإرجاع إلا إذا كان الإرجاع بسبب خطأ منا. إذا كانت القطعة معيبة أو خاطئة، نتحمل نحن تكاليف الشحن.</p><h3>6. الاسترداد</h3><p>بعد استلام القطعة المرتجعة وفحصها، تتم الموافقة على الاسترداد. يتم الاسترداد خلال 5–10 أيام عمل عبر طريقة الدفع الأصلية. قد تختلف المدة حسب البنك أو مزود الدفع.</p><h3>7. إلغاء الطلب</h3><p>يمكن إلغاء الطلبات قبل شحنها فقط. بعد الشحن، تنطبق سياسة الاسترجاع.</p><h3>8. تواصلي معنا</h3><p>الهاتف / واتساب: ‎+973 3225 0467</p>`,
    },
    {
      slug: 'terms-and-conditions',
      titleEn: 'Terms & Conditions',
      titleAr: 'الشروط والأحكام',
      bodyEn: `<h2>Terms &amp; Conditions</h2><p>These terms govern your use of attention-modestfashion.com and your purchase of products from Attention Modest Fashion, a brand registered in the Kingdom of Bahrain (Commercial Registration 192498-1).</p><h3>Orders</h3><p>All orders are subject to acceptance and availability. Prices are shown in your selected currency and accounted in Bahraini Dinar (BHD). Made-to-order pieces require 2–3 weeks for production; busy periods may extend this lead time.</p><h3>Payment</h3><p>We accept Cash on Delivery, Bank Transfer, BenefitPay Transfer and TAPP. Online payments are confirmed only after verification by the payment provider.</p><h3>Made to Order</h3><p>Made-to-order pieces are produced to your measurements and are non-returnable and non-refundable except where faulty.</p><h3>Intellectual Property</h3><p>All designs, imagery and content on this site are the property of Attention Modest Fashion and may not be reproduced without permission.</p><h3>Governing Law</h3><p>These terms are governed by the laws of the Kingdom of Bahrain.</p>`,
      bodyAr: `<h2>الشروط والأحكام</h2><p>تحكم هذه الشروط استخدامك لموقع attention-modestfashion.com وشراء المنتجات من أتنشن للموضة المحتشمة، وهي علامة مسجلة في مملكة البحرين (السجل التجاري 192498-1).</p><h3>الطلبات</h3><p>تخضع جميع الطلبات للقبول والتوفر. تُعرض الأسعار بالعملة التي تختارينها وتُحسب بالدينار البحريني (د.ب). تتطلب القطع حسب الطلب 2–3 أسابيع للإنتاج، وقد تمتد هذه المدة في المواسم المزدحمة.</p><h3>الدفع</h3><p>نقبل الدفع عند الاستلام والتحويل البنكي وتحويل بنفت بي وتاب. لا يتم تأكيد المدفوعات الإلكترونية إلا بعد التحقق من مزود الدفع.</p><h3>حسب الطلب</h3><p>تُصنع القطع حسب الطلب وفق مقاساتك وهي غير قابلة للاسترجاع أو الاسترداد إلا في حال وجود عيب.</p><h3>الملكية الفكرية</h3><p>جميع التصاميم والصور والمحتوى في هذا الموقع ملك لأتنشن للموضة المحتشمة ولا يجوز إعادة إنتاجها دون إذن.</p><h3>القانون الحاكم</h3><p>تخضع هذه الشروط لقوانين مملكة البحرين.</p>`,
    },
    {
      slug: 'privacy-policy',
      titleEn: 'Privacy Policy',
      titleAr: 'سياسة الخصوصية',
      bodyEn: `<h2>Privacy Policy</h2><p>Welcome to Attention Modest Fashion. Your privacy is important to us. This policy explains how we collect, use, disclose and protect your information when you visit attention-modestfashion.com.</p><h3>1. Information We Collect</h3><p><strong>Personal information:</strong> full name, email address, phone number, billing and shipping address, and payment details (processed securely through third-party providers).</p><p><strong>Non-personal information:</strong> IP address, browser type, device information, and pages visited.</p><h3>2. How We Use Your Information</h3><ul><li>Process and fulfil your orders</li><li>Communicate with you regarding orders or support</li><li>Improve our website and customer experience</li><li>Send marketing emails only if you opt in</li><li>Detect and prevent fraud</li></ul><h3>3. Sharing Your Information</h3><p>We do not sell your personal information. We may share data with payment providers, shipping partners, service providers, and legal authorities where required by law.</p><h3>4. Cookies</h3><p>We use cookies to enhance your browsing experience, analyse traffic and store your preferences. You can disable cookies through your browser settings.</p><h3>5. Data Security</h3><p>We implement appropriate security measures to protect your information. However, no method of transmission over the Internet is completely secure.</p><h3>6. Your Rights</h3><p>You may request access to, correction of, or deletion of your personal information by contacting us at info@attention-modestfashion.com.</p>`,
      bodyAr: `<h2>سياسة الخصوصية</h2><p>مرحباً بك في أتنشن للموضة المحتشمة. خصوصيتك تهمنا. توضح هذه السياسة كيفية جمعنا واستخدامنا والإفصاح عن معلوماتك وحمايتها عند زيارتك لموقع attention-modestfashion.com.</p><h3>1. المعلومات التي نجمعها</h3><p><strong>المعلومات الشخصية:</strong> الاسم الكامل، البريد الإلكتروني، رقم الهاتف، عنوان الفوترة والشحن، وتفاصيل الدفع (تُعالج بأمان عبر مزودين خارجيين).</p><p><strong>معلومات غير شخصية:</strong> عنوان IP، نوع المتصفح، معلومات الجهاز، والصفحات التي تمت زيارتها.</p><h3>2. كيف نستخدم معلوماتك</h3><ul><li>معالجة طلباتك وتنفيذها</li><li>التواصل معك بخصوص الطلبات أو الدعم</li><li>تحسين موقعنا وتجربة العميلات</li><li>إرسال رسائل تسويقية فقط عند موافقتك</li><li>كشف ومنع الاحتيال</li></ul><h3>3. مشاركة معلوماتك</h3><p>لا نبيع معلوماتك الشخصية. قد نشارك البيانات مع مزودي الدفع وشركاء الشحن ومزودي الخدمات والجهات القانونية عند الاقتضاء.</p><h3>4. ملفات تعريف الارتباط</h3><p>نستخدم ملفات تعريف الارتباط لتحسين تجربة التصفح وتحليل الزيارات وتخزين تفضيلاتك. يمكنك تعطيلها من إعدادات المتصفح.</p><h3>5. أمن البيانات</h3><p>نطبق إجراءات أمنية مناسبة لحماية معلوماتك. ومع ذلك، لا توجد طريقة نقل عبر الإنترنت آمنة تماماً.</p><h3>6. حقوقك</h3><p>يمكنك طلب الوصول إلى معلوماتك الشخصية أو تصحيحها أو حذفها بالتواصل معنا على info@attention-modestfashion.com.</p>`,
    },
  ];
  for (const p of pages) {
    await prisma.page.upsert({ where: { slug: p.slug }, update: p, create: p });
  }

  // ── Home sections ──────────────────────────────────────
  const sections = [
    { key: 'hero', kind: 'hero', titleEn: 'Attention', titleAr: 'أتنشن', bodyEn: 'Modern Modesty', bodyAr: 'الحشمة العصرية', ctaLabelEn: 'Discover the Collection', ctaLabelAr: 'اكتشفي المجموعة', ctaHref: '/shop', imageUrl: '/media/brand/hero-1.webp', mobileImageUrl: '/media/brand/hero-2.webp', sortOrder: 1 },
    { key: 'collections', kind: 'collections', titleEn: 'Featured Collections', titleAr: 'مجموعات مختارة', sortOrder: 2 },
    { key: 'featured', kind: 'featured', titleEn: 'Featured Pieces', titleAr: 'قطع مختارة', sortOrder: 3 },
    { key: 'story', kind: 'story', titleEn: 'Our Story', titleAr: 'قصتنا', bodyEn: 'Attention is more than a fashion brand — it is a reflection of every woman’s story. Founded in Bahrain by designer Fatima, we celebrate femininity with depth, awareness and intention.', bodyAr: 'أتنشن أكثر من مجرد علامة أزياء — إنها انعكاس لقصة كل امرأة. تأسست في البحرين على يد المصممة فاطمة، لنحتفي بالأنوثة بعمق ووعي وقصد.', ctaLabelEn: 'Discover Attention', ctaLabelAr: 'تعرّفي على أتنشن', ctaHref: '/about', imageUrl: '/media/products/midnight-1.webp', sortOrder: 4 },
    { key: 'made_to_order', kind: 'made_to_order', titleEn: 'Made to Order', titleAr: 'حسب الطلب', bodyEn: 'Each made-to-order piece is cut and finished by hand in Bahrain, tailored to your measurements. Allow two to three weeks for atelier production.', bodyAr: 'كل قطعة حسب الطلب تُقص وتُنهى يدوياً في البحرين وفق مقاساتك. تُمنح أسبوعين إلى ثلاثة أسابيع لإنتاجها في الأتيليه.', ctaLabelEn: 'Explore Made to Order', ctaLabelAr: 'استكشفي القطع حسب الطلب', ctaHref: '/collections/made-to-order', imageUrl: '/media/products/blacktie-1.webp', sortOrder: 5 },
    { key: 'social', kind: 'social', titleEn: 'Follow the Atelier', titleAr: 'تابعي الأتيليه', sortOrder: 6 },
    { key: 'newsletter', kind: 'newsletter', titleEn: 'Join Attention', titleAr: 'انضمي إلى أتنشن', bodyEn: 'Be the first to know about new collections, atelier openings and private events.', bodyAr: 'كوني أول من يعرف عن المجموعات الجديدة ومواعيد الأتيليه والفعاليات الخاصة.', sortOrder: 7 },
  ];
  for (const s of sections) {
    await prisma.homeSection.upsert({ where: { key: s.key }, update: s, create: s });
  }

  // ── Site settings ──────────────────────────────────────
  const settings: { key: string; value: unknown }[] = [
    {
      key: 'store',
      value: {
        name: 'Attention Modest Fashion',
        nameAr: 'أتنشن للموضة المحتشمة',
        email: 'info@attention-modestfashion.com',
        phone: '+97332250467',
        whatsapp: 'https://wa.me/97332250467',
        country: 'Bahrain',
        city: 'Manama',
        cr: '192498-1',
        currency: 'BHD',
        timezone: 'Asia/Bahrain',
        leadTimeEn: 'Please allow 2–3 weeks for processing. During busy periods, lead times may be extended.',
        leadTimeAr: 'يُرجى منح 2–3 أسابيع للمعالجة. خلال المواسم المزدحمة قد تمتد المدة.',
      },
    },
    {
      key: 'checkout',
      value: { allowGuestCheckout: true, requirePhone: true, enableOrderNotes: true, enableCoupons: true, requireTerms: true },
    },
    {
      // Products excluded from membership qualification (accessories, gift
      // cards, etc.). Empty means every paid piece qualifies.
      key: 'membership',
      value: { excludedProductIds: [] },
    },
    {
      key: 'tapp_config',
      value: {
        enabled: false,
        environment: process.env.TAPP_ENV === 'live' ? 'live' : 'sandbox',
        baseUrl: process.env.TAPP_BASE_URL ?? 'https://api.tapp.sa',
        merchantId: process.env.TAPP_MERCHANT_ID ?? '',
        apiKey: '',
        webhookSecret: '',
      },
    },
    {
      key: 'bank_transfer_details',
      value: {
        bankName: process.env.BANK_NAME ?? '',
        iban: process.env.BANK_IBAN ?? '',
        accountName: process.env.BANK_ACCOUNT_NAME ?? 'Attention Modest Fashion',
      },
    },
    {
      key: 'benefit_details',
      value: {
        alias: process.env.BENEFIT_ALIAS ?? '',
        accountName: process.env.BENEFIT_ACCOUNT_NAME ?? 'Attention Modest Fashion',
        accountNumber: process.env.BENEFIT_ACCOUNT_NUMBER ?? '',
      },
    },
  ];
  for (const s of settings) {
    await prisma.siteSetting.upsert({ where: { key: s.key }, update: { value: s.value as never }, create: { key: s.key, value: s.value as never } });
  }

  console.log(`✔ Seed complete — ${APPROVED_SLUGS.length} approved storefront products (of ${products.length} seeded), ${categories.length} categories, ${collections.length} collections, ${cuts.length} silhouettes.`);
  console.log(`  Admin: ${adminUser.email} (password from SEED_ADMIN_PASSWORD)`);
  console.log(`  Demo customer: ${demoUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
