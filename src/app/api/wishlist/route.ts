import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getWishlistIds, toggleWishlist } from '@/lib/cart';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ productId: z.string().min(1) });

export async function GET() {
  const ids = await getWishlistIds();
  return NextResponse.json({ ids });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limit = rateLimit(`wishlist:${ip}`, 90, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  try {
    const result = await toggleWishlist(parsed.data.productId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
