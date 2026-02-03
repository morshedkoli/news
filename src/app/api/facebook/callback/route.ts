import { NextRequest, NextResponse } from 'next/server';
import { FacebookService } from '@/lib/facebook-service';
import { authAdmin } from '@/lib/firebase-admin';

/**
 * Handle Facebook OAuth callback
 * GET /api/facebook/callback?code=xxx&state=xxx
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors
        if (error) {
            console.error('Facebook OAuth error:', error, errorDescription);
            return NextResponse.redirect(
                new URL(`/facebook?error=${encodeURIComponent(errorDescription || error)}`, req.url)
            );
        }

        // Validate required parameters
        if (!code) {
            return NextResponse.redirect(
                new URL('/facebook?error=missing_code', req.url)
            );
        }

        // Optional: Validate state for CSRF protection
        const savedState = req.cookies.get('fb_oauth_state')?.value;
        if (savedState && state !== savedState) {
            return NextResponse.redirect(
                new URL('/facebook?error=invalid_state', req.url)
            );
        }

        // Exchange code for access token
        const shortLivedToken = await FacebookService.exchangeCodeForToken(code);

        // Get long-lived token (60 days)
        const tokenResponse = await FacebookService.getLongLivedToken(shortLivedToken);

        // Fetch user's pages
        const pages = await FacebookService.getUserPages(tokenResponse.access_token);

        if (pages.length === 0) {
            return NextResponse.redirect(
                new URL('/facebook?error=no_pages_found', req.url)
            );
        }

        // Get current user ID from session/auth
        // For now, we'll use a placeholder. In production, you'd get this from the session
        const userId = 'admin'; // TODO: Get from authenticated session

        // Save all pages to Firestore
        const savePromises = pages.map(page =>
            FacebookService.savePageConnection(
                page,
                userId,
                tokenResponse.expires_in || 5184000 // 60 days default
            )
        );

        await Promise.all(savePromises);

        // Redirect back to Facebook management page with success
        const response = NextResponse.redirect(
            new URL(`/facebook?success=true&pages=${pages.length}`, req.url)
        );

        // Clear the state cookie
        response.cookies.delete('fb_oauth_state');

        return response;

    } catch (error: any) {
        console.error('Facebook callback error:', error);
        return NextResponse.redirect(
            new URL(`/facebook?error=${encodeURIComponent(error.message || 'callback_failed')}`, req.url)
        );
    }
}
