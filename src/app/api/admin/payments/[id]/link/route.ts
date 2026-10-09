import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/admin-auth';
import { resendPaymentLink } from '@/lib/admin/orders';

export const dynamic = 'force-dynamic';

/**
 * Mints a fresh hosted-payment link for an unsettled payment. Requires the
 * dedicated `payments.send` permission so verifying and sending are separable
 * duties. The provider must actually return a redirect URL — a configured-but
 * unreachable gateway surfaces as a 502, never a fake success.
 */
export const POST = adminHandler('payments.send', async ({ admin, req }) => {
  const paymentId = new URL(req.url).pathname.split('/').slice(-2)[0];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const result = await resendPaymentLink(admin, paymentId, baseUrl);
  return NextResponse.json({ ok: true, url: result.url, sentAt: result.sentAt });
});
