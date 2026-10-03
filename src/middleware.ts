import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isLocale } from '@/i18n/config';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next internals, API routes, and static files.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/media') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.webmanifest' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/');
  const first = segments[1];

  if (isLocale(first)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-locale', first);
    requestHeaders.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Redirect any un-prefixed path to the visitor's preferred locale.
  const cookieLocale = request.cookies.get('att_locale')?.value;
  const accept = request.headers.get('accept-language')?.toLowerCase() ?? '';
  const preferred: string = isLocale(cookieLocale)
    ? cookieLocale
    : accept.includes('ar')
      ? 'ar'
      : defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|media|.*\\..*).*)'],
};
