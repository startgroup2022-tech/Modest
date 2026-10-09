import { NextRequest, NextResponse, after } from 'next/server';

/**
 * Admin SEO redirects live in the database, which the edge middleware cannot
 * query. Middleware instead reads this small map from the public
 * `/api/redirects-map` endpoint and caches it in module scope. Hits are recorded
 * off the hot path with `after()`, so the admin "hits" column reflects real
 * traffic without slowing the redirect down.
 */

interface RedirectHit {
  id: string;
  to: string;
  code: number;
}

const TTL = 30_000;
let cache: { at: number; map: Record<string, RedirectHit> } | null = null;

async function loadMap(req: NextRequest): Promise<Record<string, RedirectHit>> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  try {
    const url = new URL('/api/redirects-map', req.nextUrl.origin);
    const res = await fetch(url);
    if (!res.ok) return cache?.map ?? {};
    const map = (await res.json()) as Record<string, RedirectHit>;
    cache = { at: Date.now(), map };
    return map;
  } catch {
    return cache?.map ?? {}; // A DB/network hiccup must never block the site.
  }
}

function candidates(pathname: string): string[] {
  const bare = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
  const out = new Set<string>([pathname, bare]);
  if (bare !== '/') out.add(`${bare}/`);
  return [...out];
}

export async function resolveRedirect(
  req: NextRequest,
  pathname: string,
): Promise<NextResponse | null> {
  // Never interfere with admin, API, checkout or account flows.
  if (/^\/(?:[a-z]{2}\/)?(?:admin|api|account|checkout|cart)(?:\/|$)/.test(pathname)) return null;

  const map = await loadMap(req);
  for (const candidate of candidates(pathname)) {
    const hit = map[candidate];
    if (!hit) continue;
    if (hit.to === pathname || hit.to === candidate) return null;

    after(async () => {
      try {
        const url = new URL('/api/redirects-map', req.nextUrl.origin);
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: hit.id }),
        });
      } catch {
        /* non-critical */
      }
    });

    const dest = req.nextUrl.clone();
    dest.pathname = hit.to;
    return NextResponse.redirect(dest, hit.code);
  }
  return null;
}
