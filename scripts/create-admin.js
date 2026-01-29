const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

// Check for required env vars
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("Error: Missing credentials in .env.local");
    console.log("Ensure FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, and NEXT_PUBLIC_FIREBASE_PROJECT_ID are set.");
    process.exit(1);
}

// Initialize Admin SDK
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
        });
    } catch (error) {
        console.error("Firebase Init Error:", error);
        process.exit(1);
    }
}

const auth = admin.auth();
const db = admin.firestore();

const createAdmin = async () => {
    const email = process.argv[2]; // Get email from command line arg
    const password = process.argv[3]; // Get password from command line arg

    if (!email || !password) {
        console.log("Usage: node scripts/create-admin.js <email> <password>");
        process.exit(1);
    }

    try {
        console.log(`Creating admin account for: ${email}...`);

        // 1. Create or Get User in Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log("User already exists in Auth, updating role...");
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                userRecord = await auth.createUser({
                    email: email,
                    password: password,
                    emailVerified: true,
                });
                console.log("User created in Auth.");
            } else {
                throw e;
            }
        }

        // 2. Add to Firestore 'admins' collection
        await db.collection("admins").doc(email).set({
            email: email,
            role: "admin",
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            created_via: "script"
        });

        console.log("✅ Success! Admin privileges granted.");
        console.log(`You can now login with ${email}`);

    } catch (error) {
        console.error("Failed to create admin:", error);
    } finally {
        process.exit(0);
    }
};

createAdmin();
