import { NextResponse } from 'next/server';
import { AUTH_COOKIE, READ_ONLY_VIEWS, authEnabled, isValidSession, safeEqual, screenshotKey } from './lib/auth';

export function proxy(request) {
  if (!authEnabled()) return NextResponse.next();

  if (isValidSession(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  const { searchParams, pathname, search } = request.nextUrl;
  const key = searchParams.get('key');
  if (request.method === 'GET' && key && safeEqual(key, screenshotKey()) && READ_ONLY_VIEWS.includes(searchParams.get('view'))) {
    return NextResponse.next();
  }

  if (request.method !== 'GET') {
    return new NextResponse('Não autorizado', { status: 401 });
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!api/webhook|api/ping|login|manifest.webmanifest|pwa-icon|sw.js|favicon.ico|_next/static|_next/image).*)'],
};
