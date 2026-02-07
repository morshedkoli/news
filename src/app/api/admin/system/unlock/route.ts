import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/admin/system/unlock
 * Manually unlocks the system by clearing the global_lock_until field.
 * Requires admin authentication.
 */
export async function POST(req: NextRequest) {
    try {
        // Auth: Expect Bearer token (Firebase ID Token)
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = await authAdmin.verifyIdToken(token);

        // Verify admin status
        const adminDoc = await dbAdmin.collection('admins').doc(decoded.email || '').get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Not an admin' }, { status: 403 });
        }

        // Clear the lock
        const settingsRef = dbAdmin.collection("system_stats").doc("rss_settings");
        await settingsRef.update({
            global_lock_until: null,
            manual_unlock_at: FieldValue.serverTimestamp(),
            manual_unlock_by: {
                uid: decoded.uid,
                email: decoded.email || null
            }
        });

        // Log the action
        await dbAdmin.collection("system_logs").add({
            action: "manual_unlock",
            performed_by: decoded.email,
            performed_at: FieldValue.serverTimestamp(),
            reason: "Admin triggered manual unlock via dashboard"
        });

        console.log(`🔓 System manually unlocked by ${decoded.email}`);

        return NextResponse.json({
            success: true,
            message: "System unlocked successfully",
            unlockedBy: decoded.email
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to unlock system:", error);
        return NextResponse.json(
            { error: message || "Failed to unlock system" },
            { status: 500 }
        );
    }
}
