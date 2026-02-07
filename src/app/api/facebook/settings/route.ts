import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin } from '@/lib/firebase-admin';

/**
 * Get or update Facebook app credentials
 * GET /api/facebook/settings - Get current settings
 * POST /api/facebook/settings - Update settings
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

        // Get settings from Firestore
        const settingsDoc = await dbAdmin.collection('system_settings').doc('facebook').get();

        if (!settingsDoc.exists) {
            return NextResponse.json({
                app_id: '',
                app_secret: '',
                redirect_uri: '',
                configured: false
            });
        }

        const data = settingsDoc.data();

        // Mask the app secret for security (only show last 4 characters)
        const maskedSecret = data?.app_secret
            ? '••••••••' + (data.app_secret.slice(-4) || '')
            : '';

        return NextResponse.json({
            app_id: data?.app_id || '',
            app_secret: maskedSecret,
            redirect_uri: data?.redirect_uri || '',
            configured: !!(data?.app_id && data?.app_secret)
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Error fetching Facebook settings:', error);
        return NextResponse.json(
            { error: message || 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(token);

        // Parse request body
        const { app_id, app_secret, redirect_uri } = await req.json();

        if (!app_id || !app_secret || !redirect_uri) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate redirect URI format
        try {
            new URL(redirect_uri);
        } catch {
            return NextResponse.json(
                { error: 'Invalid redirect URI format' },
                { status: 400 }
            );
        }

        // Save to Firestore
        await dbAdmin.collection('system_settings').doc('facebook').set({
            app_id,
            app_secret,
            redirect_uri,
            updated_at: new Date().toISOString(),
            updated_by: decodedToken.uid
        });

        return NextResponse.json({
            success: true,
            message: 'Facebook credentials saved successfully'
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Error saving Facebook settings:', error);
        return NextResponse.json(
            { error: message || 'Failed to save settings' },
            { status: 500 }
        );
    }
}
