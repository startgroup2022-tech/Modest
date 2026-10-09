/**
 * Redirect-target validation for user-supplied paths.
 *
 * The `redirect` query parameter is attacker-controllable (a link can point a
 * victim at `/account/sign-in?redirect=…`), so it must never be used as a
 * redirect target verbatim. Only a same-site absolute path is allowed:
 *
 *  - a scheme URL (`https://evil.example`) is refused;
 *  - a protocol-relative URL (`//evil.example`) is refused;
 *  - a backslash variant (`/\evil.example`) is refused because some browsers
 *    normalise `\` to `/`, turning it into a protocol-relative URL;
 *  - control characters are refused so a value cannot be trimmed into a host.
 *
 * This lives in a plain module (not `server-only`) so both the server pages and
 * the client `AuthForm` share exactly one rule.
 */
function isUnsafePath(value: string): boolean {
  // Must be an absolute path on this site — never a URL with a scheme or host.
  if (!value.startsWith('/')) return true;
  // `//host` and `/\host` are protocol-relative tricks.
  if (/^\/[\\/]/.test(value)) return true;
  // Control characters (and NUL) that a URL parser might strip or split on.
  if (/[\u0000-\u001f\u007f]/.test(value)) return true;
  return false;
}

export function safeRedirect(target: string | null | undefined): string | null {
  if (typeof target !== 'string' || target.length === 0) return null;
  if (isUnsafePath(target)) return null;
  // Reject percent-encoded variants (`/%2F%2Fevil`, `/%5Cevil`) that a URL
  // parser could decode into a protocol-relative target.
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    // A malformed escape cannot be a valid internal path either.
    return null;
  }
  if (isUnsafePath(decoded)) return null;
  return target;
}
