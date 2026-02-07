import { NextRequest, NextResponse } from 'next/server';
import { FacebookService } from '@/lib/facebook-service';
import type { FacebookPageConnection } from '@/types/facebook';
import { authAdmin, dbAdmin } from '@/lib/firebase-admin';

/**
 * Test posting to a Facebook page
 * POST /api/facebook/test-post
 * Body: { pageId: string }
 */
export async function POST(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(token);

        // Parse request body
        const { pageId } = await req.json();

        if (!pageId) {
            return NextResponse.json({ error: 'Missing page ID' }, { status: 400 });
        }

        // Get page connection from Firestore
        const pageDoc = await dbAdmin.collection('facebook_pages').doc(pageId).get();

        if (!pageDoc.exists) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        const pageConnection = {
            id: pageDoc.id,
            ...pageDoc.data()
        } as FacebookPageConnection;

        // Create test post data
        const testPostData = {
            message: `🔔 Test post from your news admin panel!\n\nThis is a test to verify your Facebook page connection is working correctly.\n\nPosted at: ${new Date().toLocaleString()}`,
            link: undefined,
            picture: undefined
        };

        // Attempt to post
        const postId = await FacebookService.postToPage(pageConnection, testPostData);

        return NextResponse.json({
            success: true,
            postId,
            message: 'Test post created successfully!'
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Test post error:', error);
        return NextResponse.json(
            {
                success: false,
                error: message || 'Failed to create test post'
            },
            { status: 500 }
        );
    }
}
