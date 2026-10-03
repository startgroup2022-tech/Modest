import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/admin-auth';
import { testTappConnection } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * Verifies the saved TAPP configuration. Intentionally non-destructive: it
 * reports missing fields or the transport result, and never fabricates a
 * "connected" state. Requires the same permission as editing settings.
 */
export const POST = adminHandler('settings.edit', async () => {
  const result = await testTappConnection();
  return NextResponse.json(result, { status: result.state === 'failed' ? 502 : 200 });
});
