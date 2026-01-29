import { NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";

export const maxDuration = 60; // Allow 1 minute
export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        console.log("Starting bulk news deletion...");

        const collectionRef = dbAdmin.collection('news');
        const batchSize = 400; // Firebase batch limit is 500

        // Security: Verify Admin Token
        const authHeader = require('next/headers').headers().get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(token);
        const adminDoc = await dbAdmin.collection('admins').doc(decodedToken.email || '').get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
        }

        let deletedCount = 0;

        while (true) {
            const snapshot = await collectionRef.limit(batchSize).get();

            if (snapshot.empty) {
                break;
            }

            const batch = dbAdmin.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deletedCount += snapshot.size;
            console.log(`Deleted batch of ${snapshot.size}, total: ${deletedCount}`);

            // Safety break for single request limit
            if (deletedCount > 5000) {
                break;
            }
        }

        console.log(`Deletion complete. Total deleted: ${deletedCount}`);

        return NextResponse.json({
            success: true,
            count: deletedCount,
            message: `Successfully deleted ${deletedCount} news articles.`
        });

    } catch (error: any) {
        console.error("Delete failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
