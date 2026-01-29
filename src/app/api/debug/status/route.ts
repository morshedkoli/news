import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const envStatus = {
        project_id: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        client_email: !!process.env.FIREBASE_CLIENT_EMAIL,
        private_key: !!process.env.FIREBASE_PRIVATE_KEY,
        private_key_length: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
        node_env: process.env.NODE_ENV,
    };

    const isHealthy = envStatus.project_id && envStatus.client_email && envStatus.private_key;

    return NextResponse.json({
        status: isHealthy ? "healthy" : "misconfigured",
        environment_check: envStatus,
        message: isHealthy
            ? "Environment appears consistent."
            : "MISSING ENVIRONMENT VARIABLES. Please add them in Vercel Settings.",
        timestamp: new Date().toISOString()
    }, { status: isHealthy ? 200 : 500 });
}
