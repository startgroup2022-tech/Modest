import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addToCart, getCartView, removeCartItem, updateCartItem } from '@/lib/cart';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const pieceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('READY'), sizeCode: z.string().min(1).max(8) }),
  z.object({
    mode: z.literal('CUSTOM'),
    values: z.record(z.string(), z.union([z.string(), z.number()])),
    profileId: z.string().min(1).max(64).nullable().optional(),
  }),
]);

const addSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  pieces: z.array(pieceSchema).max(20).optional(),
});

const patchSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(0).max(20),
});

function clientKey(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export async function GET() {
  const cart = await getCartView();
  return NextResponse.json(cart);
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(`cart:${clientKey(req)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });

  try {
    const cart = await addToCart(
      parsed.data.productId,
      parsed.data.variantId ?? null,
      parsed.data.quantity,
      parsed.data.pieces,
    );
    return NextResponse.json(cart);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    const message =
      code === 'VARIANT_REQUIRED' || code === 'MEASUREMENTS_REQUIRED'
        ? 'Please choose your measurements'
        : code.startsWith('MEASUREMENT_INVALID')
          ? 'One of your measurements is invalid'
          : code === 'MAX_QUANTITY'
            ? 'That is the maximum available for this piece'
            : code === 'PRODUCT_UNAVAILABLE' || code === 'VARIANT_UNAVAILABLE'
              ? 'This piece is no longer available'
              : 'Unable to add to bag';
    return NextResponse.json({ error: message, code: code.split(':')[0] }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const cart = await updateCartItem(parsed.data.itemId, parsed.data.quantity);
    return NextResponse.json(cart);
  } catch {
    return NextResponse.json({ error: 'Unable to update bag' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
  const cart = await removeCartItem(itemId);
  return NextResponse.json(cart);
}
