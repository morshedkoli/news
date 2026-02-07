import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const maxResults = parseInt(searchParams.get("maxResults") || "100", 10);
        const pageToken = searchParams.get("pageToken") || undefined;

        const listUsersResult = await authAdmin.listUsers(maxResults, pageToken);

        const users = listUsersResult.users.map((userRecord) => ({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            metadata: userRecord.metadata,
            providerData: userRecord.providerData.map((exp) => exp.providerId),
        }));

        return NextResponse.json({
            users,
            pageToken: listUsersResult.pageToken,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error listing users:", error);
        return NextResponse.json(
            { error: message || "Failed to list users" },
            { status: 500 }
        );
    }
}
