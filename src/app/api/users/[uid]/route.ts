import { NextRequest, NextResponse } from "next/server";
import { authAdmin, dbAdmin } from "@/lib/firebase-admin";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ uid: string }> }
) {
    try {
        const { uid } = await params;
        const body = await req.json();
        const { displayName, email, password } = body;

        // 1. Get the current user data BEFORE update to check for email changes
        const currentUser = await authAdmin.getUser(uid);
        const oldEmail = currentUser.email;

        const updateData: any = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (email !== undefined) updateData.email = email;
        if (password && password.trim() !== "") updateData.password = password;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { message: "No data to update" },
                { status: 400 }
            );
        }

        // 2. Perform the update in Firebase Auth
        const userRecord = await authAdmin.updateUser(uid, updateData);

        // 3. Handle Admin Email Migration
        // If the email changed, we need to migrate the 'admins' Firestore document
        // because it is keyed by email.
        if (email && oldEmail && email !== oldEmail) {
            try {
                const oldAdminDocRef = dbAdmin.collection("admins").doc(oldEmail);
                const oldAdminSnapshot = await oldAdminDocRef.get();

                if (oldAdminSnapshot.exists) {
                    console.log(`Migrating admin document from ${oldEmail} to ${email}`);
                    const newAdminDocRef = dbAdmin.collection("admins").doc(email);

                    const batch = dbAdmin.batch();
                    batch.set(newAdminDocRef, oldAdminSnapshot.data() || {});
                    batch.delete(oldAdminDocRef);

                    await batch.commit();
                    console.log("Admin document migration successful.");
                } else {
                    console.log(`No admin document found for ${oldEmail}, skipping migration.`);
                }
            } catch (firestoreError) {
                console.error("Error migrating admin document in Firestore:", firestoreError);
                // We don't fail the request here, but we log the error.
                // The user auth is updated, but they might lose admin access until fixed.
            }
        }

        return NextResponse.json({
            message: "User updated successfully",
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
            },
        });
    } catch (error: any) {
        console.error("Error updating user:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update user" },
            { status: 500 }
        );
    }
}
