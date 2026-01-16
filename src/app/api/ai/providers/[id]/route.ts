import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();

        await dbAdmin.collection('ai_providers').doc(id).update(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        await dbAdmin.collection('ai_providers').doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
