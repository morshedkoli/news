import { NextRequest, NextResponse } from 'next/server';
import { FacebookService } from '@/lib/facebook-service';
import { authAdmin } from '@/lib/firebase-admin';

/**
 * Manage Facebook pages
 * GET /api/facebook/pages - Get all connected pages
 * DELETE /api/facebook/pages?id=xxx - Remove a page
 * PATCH /api/facebook/pages - Update page settings
 */
export async function GET(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(token);

        // Fetch all connected pages
        const pages = await FacebookService.getConnectedPages();

        return NextResponse.json(pages);

    } catch (error: any) {
        console.error('Error fetching Facebook pages:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch pages' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(token);

        // Get page ID from query params
        const { searchParams } = new URL(req.url);
        const pageId = searchParams.get('id');

        if (!pageId) {
            return NextResponse.json({ error: 'Missing page ID' }, { status: 400 });
        }

        // Delete the page
        await FacebookService.deletePage(pageId);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting Facebook page:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete page' },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(token);

        // Parse request body
        const { id, enabled } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing page ID' }, { status: 400 });
        }

        // Update page settings
        const settings: { enabled?: boolean } = {};
        if (typeof enabled === 'boolean') {
            settings.enabled = enabled;
        }

        await FacebookService.updatePageSettings(id, settings);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error updating Facebook page:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update page' },
            { status: 500 }
        );
    }
}
