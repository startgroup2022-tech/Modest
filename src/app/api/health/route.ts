import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe for cPanel and uptime monitors. It exercises the
 * database so a broken connection is reported rather than masked, and it never
 * leaks configuration or stack traces.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'down', latencyMs: Date.now() - startedAt },
      { status: 503 },
    );
  }
}
