import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payments';
import { applyPaymentResult, CheckoutError } from '@/lib/orders';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * TAPP webhook. The payload is never trusted on its own — the signature is
 * verified with the shared secret before any order state changes.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const provider = getPaymentProvider('TAPP');
  const result = await provider.verifyWebhook(rawBody, headers);
  if (!result.signatureVerified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Resolve the order. `result.orderId` carries the merchant reference we sent
  // at init time (the human-facing order number), while `providerRef` is the
  // gateway's own reference stored on the payment row. Try the gateway
  // reference first, then match the merchant reference against either the
  // order number or the order's primary key.
  const reference = result.orderId;
  let orderId: string | undefined;
  if (result.providerRef) {
    const payment = await prisma.payment.findFirst({
      where: { providerRef: result.providerRef },
      select: { orderId: true },
    });
    orderId = payment?.orderId;
  }
  if (!orderId && reference) {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: reference }, { orderNumber: reference }] },
      select: { id: true },
    });
    orderId = order?.id;
  }
  if (!orderId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // A valid signature proves the sender, not the amount. Refuse to settle an
  // order when the gateway reports a total that does not match what we charged.
  if (result.status === 'PAID' && typeof result.amountBhd === 'number') {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { totalBhd: true },
    });
    const expected = Number(order?.totalBhd ?? 0);
    if (Math.abs(expected - result.amountBhd) > 0.01) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }
  }

  try {
    await applyPaymentResult({
      orderId,
      providerRef: result.providerRef,
      status: result.status,
      signatureVerified: true,
      rawPayload: { source: 'webhook' },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
