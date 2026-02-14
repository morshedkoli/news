import * as admin from "firebase-admin";

if (!admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/"/g, "")
            : undefined;

        if (privateKey && process.env.FIREBASE_CLIENT_EMAIL) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
            });
            console.log("✅ Firebase Admin Initialized successfully.");
        } else {
            console.warn("⚠️ Firebase Admin: Missing credentials. Skipping initialization.");
        }
    } catch (error) {
        console.error("❌ Firebase Admin Init Error:", error);
    }
}

// Export lazy accessors or safe instances?
// If init failed, accessing these might throw. We'll stick to direct export but user must ensure env vars.
export const dbAdmin = admin.apps.length ? admin.firestore() : {} as FirebaseFirestore.Firestore;
export const messagingAdmin = admin.apps.length ? admin.messaging() : {} as admin.messaging.Messaging;
export const authAdmin = admin.apps.length ? admin.auth() : {} as admin.auth.Auth;
