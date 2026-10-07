import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getPaymentProvider, normalizeCurrencyCode } from '@/lib/payments';
import { applyPaymentResult, CheckoutError } from '@/lib/orders';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * TAPP webhook. The payload is never trusted on its own — the signature is
 * verified with the shared secret before any order state changes. Money is also
 * verified before settlement: the reported amount and currency must both match
 * what this order was actually charged, so a signed callback in the wrong
 * currency can never mark an order paid.
 */

/**
 * Durable identity for a provider callback. It hashes the raw signed body, so
 * replaying the *exact* same callback maps to the same row and is ignored,
 * while a genuinely distinct transition (e.g. PENDING → FAILED, or a later
 * legitimate retry) hashes differently and is still applied.
 */
function hashCallback(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

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

  // Explicitly reject a settlement callback that omits the currency rather than
  // assuming BHD. A signed callback is not proof of the monetary unit.
  if (result.status === 'PAID' && !result.currency) {
    return NextResponse.json({ error: 'Currency missing' }, { status: 400 });
  }

  // A valid signature proves the sender, not the money. Refuse to settle an
  // order when the gateway reports an amount or currency that does not match
  // the transaction we opened (presentment currency + presentment amount).
  if (result.status === 'PAID') {
    const payment = await prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: { amountPresentment: true, amountBhd: true, currencyCode: true },
    });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { presentmentCode: true, presentmentTotal: true, totalBhd: true },
    });

    const expectedCurrency = normalizeCurrencyCode(payment?.currencyCode ?? order?.presentmentCode ?? null);
    // The captured presentment amount is the source of truth; fall back through
    // the order's presentment total and the BHD amounts only when a fixture or
    // legacy row did not record one (never to a zero default, which would make
    // every real callback look like a mismatch).
    const presentmentCandidates = [
      payment?.amountPresentment != null ? Number(payment.amountPresentment) : null,
      order?.presentmentTotal != null ? Number(order.presentmentTotal) : null,
      payment?.amountBhd != null ? Number(payment.amountBhd) : null,
      order?.totalBhd != null ? Number(order.totalBhd) : null,
    ];
    const expectedPresentment = presentmentCandidates.find((v): v is number => v != null && v > 0) ?? 0;

    // Currency mismatch — never settle in the wrong monetary unit.
    if (expectedCurrency && result.currency !== expectedCurrency) {
      await writeAudit({
        action: 'payment.webhook.currency_mismatch',
        entity: 'Order',
        entityId: orderId,
        metadata: { expected: expectedCurrency, received: result.currency, provider: 'tapp' },
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
      return NextResponse.json({ error: 'Currency mismatch' }, { status: 400 });
    }

    // Amount mismatch — a missing amount on a PAID callback is also rejected,
    // because settlement without a verifiable amount cannot be trusted.
    if (typeof result.amountBhd !== 'number') {
      return NextResponse.json({ error: 'Amount missing' }, { status: 400 });
    }
    if (Math.abs(expectedPresentment - result.amountBhd) > 0.01) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }
  }

  // Same verified callback delivered twice: the durable event ledger rejects a
  // replayed body up front so it can never append a duplicate business event.
  // (applyPaymentResult also inserts the key inside its transaction, so a
  // concurrent duplicate cannot slip between this check and the write.)
  const eventKey = hashCallback(rawBody);
  const seen = await prisma.paymentWebhookEvent.findUnique({ where: { eventKey }, select: { id: true } });
  if (seen) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await applyPaymentResult({
      orderId,
      providerRef: result.providerRef,
      status: result.status,
      signatureVerified: true,
      webhookEventKey: eventKey,
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
