import type { Locale } from './config';
import { adminDict } from './admin-dict';

export function getAdminDict(locale: string) {
  return adminDict[locale === 'ar' ? 'ar' : 'en'];
}

export type { AdminDict } from './admin-dict';

export type AdminLocale = Locale;

/** Locale-prefixed admin path: adminHref('en', 'orders') -> '/en/admin/orders' */
export function adminHref(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+/, '');
  return clean ? `/${locale}/admin/${clean}` : `/${locale}/admin`;
}
