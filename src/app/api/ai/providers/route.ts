import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';
import { AiProvider } from '@/types/ai';

export async function GET() {
    try {
        const snapshot = await dbAdmin.collection('ai_providers')
            .orderBy('priority', 'asc')
            .get();

        const providers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json(providers);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        // Security: Verify Admin Token
        const { headers } = require('next/headers');
        const authHeader = headers().get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        // Dynamic import to avoid circular dep if any? No, just import standard.
        // But we need authAdmin which is in lib/firebase-admin
        const { authAdmin, dbAdmin } = require('@/lib/firebase-admin');

        const decodedToken = await authAdmin.verifyIdToken(token);
        const adminDoc = await dbAdmin.collection('admins').doc(decodedToken.email || '').get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
        }

        const body = await req.json();

        // Basic validation
        if (!body.name || !body.endpoint || !body.model) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newProvider: Omit<AiProvider, 'id'> = {
            name: body.name,
            type: body.type || 'openai-compatible',
            provider_category: body.provider_category || 'free',
            endpoint: body.endpoint,
            apiKey: body.apiKey || '',
            model: body.model,
            method: body.method || 'POST',
            headers: body.headers || {},
            body_template: body.body_template,
            response_path: body.response_path,
            success_condition: body.success_condition,
            timeout_ms: body.timeout_ms,
            priority: Number(body.priority) || 99,
            enabled: body.enabled ?? true,
            description: body.description || ''
        };

        const docRef = await dbAdmin.collection('ai_providers').add(newProvider);

        return NextResponse.json({ id: docRef.id, ...newProvider });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 });
    }
}
