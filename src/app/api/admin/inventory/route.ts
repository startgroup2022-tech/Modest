import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminHandler } from '@/lib/admin-auth';
import { adjustStock } from '@/lib/admin/inventory';

export const dynamic = 'force-dynamic';

const schema = z.object({
  variantId: z.string().min(1),
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().max(300).optional(),
  type: z
    .enum(['MANUAL_ADJUSTMENT', 'RESTOCK', 'DAMAGE', 'RETURN', 'QC_REJECTED'])
    .optional(),
});

export const POST = adminHandler('inventory.adjust', async ({ admin, req }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
  const updated = await adjustStock(admin, parsed.data);
  return NextResponse.json({ ok: true, stock: updated.stock, stockStatus: updated.stockStatus });
});
