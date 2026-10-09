/**
 * Origin / CSRF protection for cookie-authenticated state-changing requests.
 *
 * Session cookies are `SameSite=Lax`, which already blocks most cross-site
 * form posts, but Lax is not a complete CSRF defence (and some legacy browsers
 * treat it loosely). This adds an explicit origin check on top.
 *
 * Policy:
 *  - A browser always sends `Origin` on a cross-site state-changing request, so
 *    a present `Origin` must match the request's own host (or a configured
 *    public origin).
 *  - When `Origin` is absent (some same-origin navigations, older clients) we
 *    fall back to `Referer`.
 *  - When both are absent the caller is not a browser (curl, server-to-server,
 *    health checks); those clients do not carry the victim's cookies, so the
 *    request is allowed.
 *
 * This is deliberately layered on top of SameSite rather than replacing it.
 */

/** Hosts we consider "ours": the request host plus the configured public origin. */
function allowedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const forwarded = req.headers.get('x-forwarded-host');
  const host = forwarded?.split(',')[0]?.trim() || req.headers.get('host');
  if (host) hosts.add(host.toLowerCase());

  for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!value) continue;
    try {
      hosts.add(new URL(value).host.toLowerCase());
    } catch {
      // Ignore a malformed configured origin rather than failing closed on it.
    }
  }
  return hosts;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when a request carries no cross-site evidence. Safe to call for any
 * request; it never performs I/O.
 */
export function isSameOriginRequest(req: Request): boolean {
  const allowed = allowedHosts(req);

  const origin = req.headers.get('origin');
  if (origin && origin !== 'null') {
    const host = hostOf(origin);
    return !!host && allowed.has(host);
  }

  const referer = req.headers.get('referer');
  if (referer) {
    const host = hostOf(referer);
    return !!host && allowed.has(host);
  }

  // No browser-supplied origin or referer: not a CSRF vector.
  return true;
}

export const CSRF_ERROR = 'Request blocked: origin not allowed';
