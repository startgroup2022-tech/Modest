import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getSelectedCurrency } from '@/lib/currency';
import { createOrder, resolveCartLines, CheckoutError, orderFingerprint } from '@/lib/orders';
import { computeTotals } from '@/lib/money';
import { getShippingMethods } from '@/lib/site';
import { assertMethodAllowed, getPaymentConfigs } from '@/lib/payment-config';
import { hashGuestEmail } from '@/lib/tokens';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';
import { resolveQuickOrderLink } from '@/lib/quick-order-db';
import { isValidTokenFormat } from '@/lib/quick-order';
import { getCutForProduct } from '@/lib/size-guide-db';
import { validatePieces, type PieceInput } from '@/lib/measurement-plan';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;

/**
 * Places the order behind a Quick Order link. The client sends only the token,
 * delivery/contact details and — for a cut product — a per-piece intent list.
 * Never a price, product id or measurement snapshot: the link (and therefore
 * the product and its price) is resolved server-side and each piece is
 * re-validated against the product's stored cut, so a tampered payload cannot
 * change what is charged or which measurements are recorded. The link is then
 * claimed atomically so it yields at most one order.
 */
const pieceSchema = z.union([
  z.object({
    mode: z.literal('READY'),
    sizeCode: z.string().trim().min(1).max(20),
  }),
  z.object({
    mode: z.literal('CUSTOM'),
    values: z.record(z.string(), z.union([z.number(), z.string()])),
    profileId: z.string().min(1).max(64).nullable().optional(),
  }),
]);

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address').max(255).optional().or(z.literal('')),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().min(3).max(240),
  building: z.string().trim().max(80).optional().or(z.literal('')),
  unit: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  variantId: z.string().min(1).nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(20).optional().default(1),
  pieces: z.array(pieceSchema).max(20).optional(),
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'BENEFIT', 'TAPP']),
  shippingMethodCode: z.string().trim().max(60).optional().or(z.literal('')),
  acceptsTerms: z.coerce.boolean().refine((v) => v === true, 'You must accept the terms'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limit = rateLimit(`quick-order:${ip}`, 12, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

  if (!isValidTokenFormat(token)) return NextResponse.json({ error: 'INVALID' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input', field: parsed.error.issues[0]?.path?.[0] },
      { status: 400 },
    );
  }

  const resolved = await resolveQuickOrderLink(token);
  if (!resolved.ok) {
    const status = resolved.reason === 'INVALID' ? 404 : 410;
    return NextResponse.json({ error: resolved.reason }, { status });
  }
  const { link, product } = resolved.data;

  const user = await getCurrentUser();
  const currency = await getSelectedCurrency();

  // Idempotency: a retry of the exact same submission (same link + same key +
  // same commercial payload) must return the canonical order rather than
  // failing with USED or creating a second order. A different key against an
  // already-claimed link is a genuine second attempt and is refused below.
  const idempotencyKey = (req.headers.get('idempotency-key') ?? '').trim().slice(0, 80) || null;
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        paymentStatus: existing.payments[0]?.status ?? 'PENDING',
        redirectUrl: null,
        instructions: null,
        replayed: true,
      });
    }
  }

  if (link.orderId) {
    return NextResponse.json({ error: 'USED', orderId: link.orderId }, { status: 409 });
  }

  // Delivery is priced server-side from the active methods only.
  let shippingBhd = 0;
  const shippingMethods = await getShippingMethods();
  if (parsed.data.shippingMethodCode) {
    const method = shippingMethods.find((m) => m.code === parsed.data.shippingMethodCode);
    if (!method) {
      return NextResponse.json(
        { error: 'The selected delivery method is not available', code: 'INVALID_SHIPPING', field: 'shippingMethodCode' },
        { status: 400 },
      );
    }
    shippingBhd = Number(method.priceBhd);
  } else if (shippingMethods.length) {
    shippingBhd = Number(shippingMethods[0].priceBhd);
  }

  const quantity = parsed.data.quantity ?? 1;

  // For a cut product the client sends one intent per physical piece; each is
  // re-validated here against the stored cut. Saved-profile ids are verified to
  // belong to the signed-in customer before use, and guests can never supply
  // one. The variant requirement is satisfied by per-piece READY sizes.
  const cut = await getCutForProduct(product.id);
  let piecesByProduct: Record<string, PieceInput[]> | undefined;
  if (cut && cut.fieldRows.length > 0 && cut.sizes.length > 0) {
    const rawPieces = parsed.data.pieces;
    if (!rawPieces || rawPieces.length !== quantity) {
      return NextResponse.json({ error: 'Please choose your measurements', code: 'MEASUREMENTS_REQUIRED' }, { status: 400 });
    }
    const ownedProfileIds = new Set<string>();
    if (user?.customerId) {
      const ids = [...new Set(rawPieces.map((p) => (p.mode === 'CUSTOM' ? p.profileId : null)).filter((v): v is string => !!v))];
      if (ids.length) {
        const rows = await prisma.measurement.findMany({ where: { id: { in: ids }, customerId: user.customerId }, select: { id: true } });
        for (const r of rows) ownedProfileIds.add(r.id);
      }
    }
    const pieces: PieceInput[] = rawPieces.map((p) => {
      if (p.mode === 'READY') return { mode: 'READY', sizeCode: p.sizeCode };
      const profileId = p.profileId && ownedProfileIds.has(p.profileId) ? p.profileId : null;
      return { mode: 'CUSTOM', values: p.values, profileId };
    });
    const validated = validatePieces(cut, pieces);
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error.message, code: `MEASUREMENT_INVALID:${validated.error.code}`, field: validated.error.fieldKey, piece: validated.index },
        { status: 400 },
      );
    }
    piecesByProduct = { [product.id]: pieces };
  } else {
    // No cut: the product is sold by size (or as a single unit). A size is
    // required whenever it has variants so the size-matched variant — and
    // therefore its stock — is enforced.
    const variantId = parsed.data.variantId ?? null;
    if (product.variants.length > 0 && !variantId) {
      return NextResponse.json({ error: 'Please select a size', field: 'variantId' }, { status: 400 });
    }
  }

  const variantId = parsed.data.variantId ?? null;

  try {
    // Resolve the line(s) for the linked product only. No cart is touched, so
    // unrelated items already in a signed-in shopper's bag are never swept in,
    // and the URL cannot introduce a different product.
    const lines = await resolveCartLines(
      [{ productId: product.id, variantId, quantity }],
      { requireMeasurements: false, piecesByProduct },
    );
    const previewTotals = computeTotals(
      lines.map((l) => ({ unitPriceBhd: l.unitPriceBhd, quantity: l.quantity, lineTotalBhd: l.lineTotalBhd })),
      null,
      shippingBhd,
    );
    const methodConfigs = await getPaymentConfigs();
    const gate = assertMethodAllowed(methodConfigs[parsed.data.paymentMethod], previewTotals.totalBhd);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message, code: gate.code, field: 'paymentMethod' }, { status: 400 });
    }

    const email = parsed.data.email || `quick-${link.code.toLowerCase()}@guest.attention-modestfashion.com`;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;

    const fingerprint = orderFingerprint({
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        unitPriceBhd: l.unitPriceBhd,
        pieces: l.pieces.map((p) => ({
          measurementKind: p.measurementKind,
          sizeCode: p.sizeCode,
          values:
            p.measurementSnapshot && typeof p.measurementSnapshot === 'object' && 'values' in p.measurementSnapshot
              ? ((p.measurementSnapshot as { values: Record<string, number> }).values ?? null)
              : null,
        })),
      })),
      shippingBhd,
      paymentMethod: parsed.data.paymentMethod,
    });

    const order = await createOrder({
      checkout: {
        fullName: parsed.data.fullName,
        email,
        phone: parsed.data.phone,
        country: parsed.data.country,
        city: parsed.data.city,
        area: parsed.data.area || '',
        address: parsed.data.address,
        building: parsed.data.building || '',
        unit: parsed.data.unit || '',
        notes: parsed.data.notes || '',
        paymentMethod: parsed.data.paymentMethod,
        shippingMethodCode: parsed.data.shippingMethodCode || '',
        couponCode: '',
        acceptsTerms: true,
      },
      lines,
      customerId: user?.customerId ?? null,
      locale: req.nextUrl.searchParams.get('locale') === 'ar' ? 'ar' : 'en',
      currency: { code: currency.code, rateToBhd: currency.rateToBhd, decimals: currency.decimals },
      shippingBhd,
      coupon: null,
      baseUrl,
      idempotencyKey,
      idempotencyFingerprint: fingerprint,
      guestEmailHash: user?.customerId ? null : hashGuestEmail(email),
      quickOrder: { linkId: link.id, source: link.source },
    });

    if (!order.replayed) {
      await writeAudit({
        userId: user?.id ?? null,
        action: 'order.quick_order_placed',
        entity: 'Order',
        entityId: order.orderId,
        metadata: { orderNumber: order.orderNumber, linkCode: link.code, source: link.source },
        ip,
      });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      redirectUrl: order.redirectUrl ?? null,
      instructions: order.instructions ?? null,
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      if (err.code === 'LINK_USED') {
        return NextResponse.json({ error: 'USED' }, { status: 409 });
      }
      if (err.code === 'DUPLICATE') {
        return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error('[quick-order] failed', err);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }
}

/** Lightweight availability probe used by the landing page before rendering. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveQuickOrderLink(token);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, reason: resolved.reason }, { status: resolved.reason === 'INVALID' ? 404 : 410 });
  }
  return NextResponse.json({ ok: true, productId: resolved.data.product.id, orderId: resolved.data.link.orderId });
}
