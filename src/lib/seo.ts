import 'server-only';

const BRAND = 'Attention Modest Fashion';
const BRAND_AR = 'أتنشن';

/**
 * Resolve a page title against the root metadata template (`%s | Attention`).
 *
 * An explicit, admin-authored meta title is treated as absolute so the brand is
 * not appended twice; an auto-derived title keeps the template so the brand is
 * always present. This keeps every page consistent whether or not the owner
 * filled in the SEO field.
 */
export function seoTitle(
  metaTitle: string | null | undefined,
  fallback: string,
  locale: 'en' | 'ar' = 'en',
): { absolute: string } {
  const explicit = metaTitle?.trim();
  if (explicit) return { absolute: explicit };
  const brand = locale === 'ar' ? BRAND_AR : BRAND;
  return { absolute: `${fallback} | ${brand}` };
}

/**
 * Serialise structured data for a `<script type="application/ld+json">` block.
 *
 * `JSON.stringify` leaves `<` intact, so any admin-authored value containing
 * `</script>` would close the tag early and allow HTML/JS injection into the
 * page. Escaping `<`, `>`, `&` and the JS line separators keeps the payload
 * valid JSON while making it inert inside the document.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
