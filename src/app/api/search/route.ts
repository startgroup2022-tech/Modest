import { NextRequest, NextResponse } from 'next/server';
import { searchCatalog } from '@/lib/catalog';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`search:${ip}`, 120, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const locale = req.nextUrl.searchParams.get('locale') === 'ar' ? 'ar' : 'en';
  const results = await searchCatalog(q, 8);
  return NextResponse.json({
    products: results.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      priceBhd: Number(p.priceBhd),
      image: p.media[0]?.url ?? null,
    })),
    categories: results.categories,
    collections: results.collections,
    total: results.total,
    locale,
  });
}
