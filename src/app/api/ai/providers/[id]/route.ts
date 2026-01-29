import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Helper for Auth Check
async function verifyAdmin() {
    const { headers } = require('next/headers');
    const authHeader = headers().get('authorization');
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');

    const { authAdmin, dbAdmin } = require('@/lib/firebase-admin');
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(token);
    const adminDoc = await dbAdmin.collection('admins').doc(decodedToken.email || '').get();
    if (!adminDoc.exists) throw new Error('Forbidden');
    return true;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        await verifyAdmin();
        const { id } = await params;
        const body = await req.json();

        await dbAdmin.collection('ai_providers').doc(id).update(body);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: error.message || 'Failed to update provider' }, { status: status });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        await verifyAdmin();
        const { id } = await params;

        await dbAdmin.collection('ai_providers').doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
