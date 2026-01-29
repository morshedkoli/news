import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";

export async function POST(req: Request) {
    try {
        // Security: Verify Admin Token
        const { headers } = require('next/headers');
        const authHeader = headers().get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Lazy load admin to ensure init
        const { authAdmin, dbAdmin } = require('@/lib/firebase-admin');
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(token);

        // Check if user is actually an admin in Firestore
        const adminDoc = await dbAdmin.collection('admins').doc(decodedToken.email || '').get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
        }

        const { title, summary, newsId } = await req.json();

        if (!title || !summary || !newsId) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const result = await sendNotification(title, summary, newsId);
        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Notification API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
