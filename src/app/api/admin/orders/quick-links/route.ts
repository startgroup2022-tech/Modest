import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler, AdminActionError, auditAdmin } from '@/lib/admin-auth';
import {
  createQuickOrderLink,
  listQuickOrderLinks,
  markQuickOrderLinkSent,
  revokeQuickOrderLink,
} from '@/lib/quick-order-db';
import { buildWhatsAppDeepLink, quickOrderMessage, quickOrderUrl } from '@/lib/quick-order';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  productId: z.string().min(1),
  source: z.enum(['WHATSAPP', 'INSTAGRAM']).default('WHATSAPP'),
  customerPhone: z.string().trim().max(40).optional().or(z.literal('')),
  ttlDays: z.coerce.number().int().min(1).max(365).optional(),
});

const actionSchema = z.object({
  action: z.enum(['mark_sent', 'revoke']),
});

/** Lists recent Quick Order links for the staff console. */
export const GET = adminHandler('orders.create', async ({ searchParams }) => {
  const links = await listQuickOrderLinks({
    productId: searchParams.get('productId') ?? undefined,
    source: (searchParams.get('source') as 'WHATSAPP' | 'INSTAGRAM' | null) ?? undefined,
    take: 100,
  });
  return NextResponse.json({ ok: true, links });
});

/**
 * Creates a link and returns the raw token/URL exactly once. The token is
 * stored only as a hash, so this response is the only time the full URL is
 * available — the console must show it to the staff member immediately.
 */
export const POST = adminHandler('orders.create', async ({ admin, req, ip }) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw new AdminActionError('Invalid request', 'INVALID', 400);

  let created;
  try {
    created = await createQuickOrderLink({
      productId: parsed.data.productId,
      source: parsed.data.source,
      createdById: admin.id,
      customerPhone: parsed.data.customerPhone || null,
      ttlDays: parsed.data.ttlDays,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'PRODUCT_UNAVAILABLE') {
      throw new AdminActionError('That product is not available for a quick order link', 'UNAVAILABLE', 400);
    }
    throw err;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const urlEn = quickOrderUrl(baseUrl, 'en', created.rawToken);
  const urlAr = quickOrderUrl(baseUrl, 'ar', created.rawToken);
  const whatsappUrl = buildWhatsAppDeepLink(
    parsed.data.customerPhone || null,
    quickOrderMessage('en', created.link.product.nameEn, urlEn),
  );

  await auditAdmin(admin, 'quick_order.link_create', 'QuickOrderLink', created.link.id, {
    code: created.link.code,
    productId: parsed.data.productId,
    source: parsed.data.source,
  }, ip);

  return NextResponse.json({
    ok: true,
    link: created.link,
    token: created.rawToken,
    urls: { en: urlEn, ar: urlAr },
    whatsappUrl,
  });
});

/** Marks a send as initiated, or revokes the link. */
export const PATCH = adminHandler('orders.create', async ({ admin, req, ip }) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) throw new AdminActionError('Missing id', 'INVALID', 400);

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new AdminActionError('Invalid request', 'INVALID', 400);

  if (parsed.data.action === 'mark_sent') {
    const ok = await markQuickOrderLinkSent(id);
    if (!ok) throw new AdminActionError('Link not found or already sent', 'NOT_FOUND', 404);
    await auditAdmin(admin, 'quick_order.link_send_initiated', 'QuickOrderLink', id, {}, ip);
    return NextResponse.json({ ok: true });
  }

  const ok = await revokeQuickOrderLink(id);
  if (!ok) throw new AdminActionError('Link not found or already revoked', 'NOT_FOUND', 404);
  await auditAdmin(admin, 'quick_order.link_revoke', 'QuickOrderLink', id, {}, ip);
  return NextResponse.json({ ok: true });
});
