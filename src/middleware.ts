import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const session = request.cookies.get('session_userid')?.value;
    const { pathname } = request.nextUrl;

    // 1. Define public paths (assets, images, etc.)
    // Note: middleware matcher handles most, but we can double check here if needed.
    // Assuming matcher filters out _next, static, images, api/auth.

    // 2. Define Guest Routes (Login/Signup) where:
    // - Logged in users should be redirected to Dashboard
    // - Logged out users should be ALLOWED to access
    const isGuestRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');

    // 3. Logic

    // Case A: User is logged in and tries to access Login page -> Redirect to Dashboard
    if (session && isGuestRoute) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Case B: User is NOT logged in and tries to access protected page -> Redirect to Login
    // Protected pages: Everything that is NOT an auth route and NOT a public asset
    // We can rely on negative logic: If no session AND not a guest route -> Redirect
    if (!session && !isGuestRoute) {
        // Allow access to /api/auth/* is handled by matcher or specific check?
        // The matcher below excludes /api, so we don't accidentally block API calls?
        // Wait, we WANT to block API calls if they require auth, but usually middleware for APIs 
        // returns 401 instead of redirect.
        // For simple APP protection, we focus on pages.

        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (auth endpoints)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public images/assets (if any generic pattern)
         */
        '/((?!api/auth|api/users/avatar|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
