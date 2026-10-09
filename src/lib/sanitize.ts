/**
 * Minimal, dependency-free HTML sanitiser for admin-authored rich text.
 *
 * Page bodies are stored as HTML and rendered on the storefront. Without
 * sanitising, an admin-authored (or compromised-account) page could inject
 * script that runs for every visitor — a stored XSS. This allow-list approach
 * keeps a safe subset of formatting markup and strips everything else,
 * including all event handlers, scripts, styles and `javascript:` URLs.
 *
 * It is intentionally conservative: it is not a general-purpose sanitiser for
 * arbitrary untrusted HTML, but a strict filter for the small set of tags an
 * operator legitimately needs in a policy or content page.
 *
 * Pure and isomorphic (no Node APIs), so it is safe to run on the server and
 * in client components alike.
 */

// Tags permitted to remain. Anything not listed is removed (content kept).
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
  'a', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

// Tags removed together with their content (never merely unwrapped).
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template']);

// Attributes permitted per tag. `a` additionally gets `href`/`target`/`rel`.
const GLOBAL_ATTRS = new Set<string>([]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
};

function isSafeHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith('javascript:') || v.startsWith('data:') || v.startsWith('vbscript:')) return false;
  // Allow relative, mailto, tel, http(s), and protocol-relative links.
  return /^(https?:|mailto:|tel:|\/|#|\.)/.test(v) || !v.includes(':');
}

/** Removes every attribute from a single tag string, keeping only allowed ones. */
function sanitizeAttributes(tagName: string, rawAttrs: string): string {
  const allowed = new Set([...GLOBAL_ATTRS, ...(TAG_ATTRS[tagName] ?? [])]);
  if (allowed.size === 0) return '';

  const out: string[] = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(rawAttrs)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    if (name.startsWith('on')) continue; // event handlers
    if (!allowed.has(name)) continue;
    if (name === 'href' && !isSafeHref(value)) continue;
    out.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
  }
  return out.length ? ` ${out.join(' ')}` : '';
}

/**
 * Sanitises an HTML string, returning markup containing only allow-listed tags
 * and attributes. Void elements are emitted self-closed.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  let html = String(input);

  // Drop dangerous elements together with their inner content first.
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  // Process the remaining tags one at a time.
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_full, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return ''; // strip tag, keep inner text
    const attrs = sanitizeAttributes(name, rawAttrs ?? '');
    const selfClosing = /\/\s*$/.test(rawAttrs ?? '') || name === 'br' || name === 'hr';
    const closing = _full.startsWith('</');
    if (closing) return `</${name}>`;
    if (selfClosing) return `<${name}${attrs} />`;
    return `<${name}${attrs}>`;
  });
}

/** Plain-text version (for meta descriptions and search snippets). */
export function htmlToText(input: string | null | undefined): string {
  return sanitizeHtml(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
