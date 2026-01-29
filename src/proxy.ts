import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    // Proxy logic can be added here if needed for more complex checks,
    // but for now we rely on AuthGuard in the (admin) layout.
    // The matcher below ensures we handle routing efficiently.
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - download (Public download page)
         * - login (Login page)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - apk (Static APK files)
         */
        "/((?!api|download|login|_next/static|_next/image|favicon.ico|apk).*)",
    ],
};
