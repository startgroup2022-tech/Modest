/**
 * Client IP resolution for rate limiting and audit logs.
 *
 * `X-Forwarded-For` is fully attacker-controlled: any client can send it, and a
 * value injected by the client sits to the *left* of the hops appended by our
 * own proxies. Trusting the left-most entry (the previous behaviour) let anyone
 * rotate the header to mint a fresh rate-limit bucket per request, defeating the
 * limiter entirely.
 *
 * The correct algorithm is to trust only the hops appended by our own reverse
 * proxies and take the address the *last* trusted proxy saw. The number of
 * trusted proxies is deployment configuration, supplied as `TRUSTED_PROXY_COUNT`:
 *
 *   - `TRUSTED_PROXY_COUNT` unset or `0`  → **no header is trusted**. Every
 *     caller collapses to a single stable key. This is the safe default: with no
 *     trusted ingress there is no way to tell clients apart, and sharing one
 *     bucket can only make limiting *stricter*, never weaker.
 *   - `TRUSTED_PROXY_COUNT = N (>=1)` → the client is the Nth address counted
 *     from the right of `X-Forwarded-For`. nginx (`$proxy_add_x_forwarded_for`)
 *     appends the address it saw, so a single nginx ingress is `N = 1`.
 *
 * Any client-supplied entries to the left of the trusted hops are ignored, so a
 * spoofed header cannot move the caller into a different bucket.
 */

const UNKNOWN = 'unknown';

function trustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalize(value: string): string {
  const trimmed = value.trim();
  // Strip an IPv4 port or IPv6 brackets/zone that some proxies include.
  const v4 = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (v4) return v4[1];
  return trimmed || UNKNOWN;
}

export function clientIp(req: Request): string {
  const trusted = trustedProxyCount();
  if (trusted === 0) return UNKNOWN;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
    // The right-most `trusted` entries were appended by our own proxies; the
    // address the outermost trusted proxy saw is `trusted` from the right.
    const index = hops.length - trusted;
    if (index >= 0 && hops[index]) return normalize(hops[index]);
    // Fewer hops than trusted proxies: the chain is shorter than configured, so
    // the header cannot be trusted — fall through.
  }

  // nginx sets `X-Real-IP` from `$remote_addr`, overwriting any client value.
  const real = req.headers.get('x-real-ip');
  if (real) return normalize(real);

  return UNKNOWN;
}
