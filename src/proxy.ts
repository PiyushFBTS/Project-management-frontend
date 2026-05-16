import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

/**
 * Edge gate for the dashboard. After the admin_users + employees → users
 * merge, the unified `/auth/login` may not issue a refresh token for
 * every user type — clients still get one, but admin/employee don't. So
 * the proxy uses `app_login_type` as the "is signed in" signal, since
 * the auth provider sets that cookie on every successful login (refresh
 * cookie is still preferred but optional).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isSignedIn =
    request.cookies.has('app_refresh') || request.cookies.has('app_login_type');

  if (!isPublic && !isSignedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isPublic && isSignedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
