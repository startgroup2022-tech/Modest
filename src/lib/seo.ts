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
