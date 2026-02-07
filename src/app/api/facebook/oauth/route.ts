import { NextResponse } from 'next/server';
import { FacebookService } from '@/lib/facebook-service';

/**
 * Initiate Facebook OAuth flow
 * GET /api/facebook/oauth
 */
export async function GET() {
    try {
        // Generate a random state for CSRF protection
        const state = Math.random().toString(36).substring(7);

        // Get OAuth URL
        const oauthUrl = await FacebookService.getOAuthURL(state);

        // Store state in session/cookie for validation (optional but recommended)
        const response = NextResponse.redirect(oauthUrl);
        response.cookies.set('fb_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 600 // 10 minutes
        });

        return response;

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Facebook OAuth initiation error:', error);
        return NextResponse.json(
            { error: message || 'Failed to initiate Facebook OAuth' },
            { status: 500 }
        );
    }
}
