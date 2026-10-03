export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function dir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'ar' : 'en';
}

export function localeLabel(locale: Locale): string {
  return locale === 'ar' ? 'العربية' : 'English';
}

/** Builds a locale-prefixed path: href('/en', 'shop') -> '/en/shop' */
export function href(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+/, '');
  return clean ? `/${locale}/${clean}` : `/${locale}`;
}
