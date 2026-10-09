import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Deployment version probe.
 *
 * Returns only build metadata inlined by `next.config.mjs` at build time:
 * the package version, the git commit the artifact was built from, and the
 * build timestamp. It deliberately exposes **no** environment configuration,
 * secrets, database state, or request data — it is safe to serve publicly and
 * lets operations confirm the commit actually running in production matches the
 * commit that was deployed.
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: process.env.APP_BUILD_VERSION ?? '0.0.0',
      commit: process.env.APP_BUILD_COMMIT ?? 'unknown',
      buildTime: process.env.APP_BUILD_TIME ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
