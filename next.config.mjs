/** @type {import('next').NextConfig} */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Resolve the commit this artifact was built from, at build time. */
function buildCommit() {
  const fromEnv = process.env.GIT_COMMIT_SHA || process.env.GIT_COMMIT || process.env.SOURCE_COMMIT;
  if (fromEnv) return fromEnv.trim();
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Inlined into the server bundle at build time so /api/version reports the
  // exact commit and build timestamp of the deployed artifact (no secrets).
  env: {
    APP_BUILD_COMMIT: buildCommit(),
    APP_BUILD_TIME: new Date().toISOString(),
    APP_BUILD_VERSION: pkg.version ?? '0.0.0',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'attention-modestfashion.com' },
      { protocol: 'https', hostname: '**.attention-modestfashion.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // Next.js emits inline hydration/bootstrapping scripts; 'unsafe-inline'
      // is required unless a nonce is wired through middleware. Everything
      // else stays locked to the origin.
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Content-Security-Policy', value: csp },
          // Two years, subdomains included. Browsers ignore this over plain
          // HTTP, so it is safe to send unconditionally behind the proxy.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
