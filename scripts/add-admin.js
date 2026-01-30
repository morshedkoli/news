const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('❌ Error: Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL in .env.local');
    process.exit(1);
}

// Initialize Firebase Admin
try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
    console.log('✅ Firebase Admin Initialized');
} catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    process.exit(1);
}

const db = admin.firestore();

async function addAdmin(email) {
    if (!email) {
        console.error('❌ Please provide an email address.');
        console.log('Usage: node scripts/add-admin.js <email>');
        process.exit(1);
    }

    try {
        const adminRef = db.collection('admins').doc(email);
        await adminRef.set({
            email: email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            role: 'admin' // Optional: for future role-based access
        });
        console.log(`✅ Successfully added admin: ${email}`);
    } catch (error) {
        console.error('❌ Error adding admin:', error);
    }
}

// Get email from command line arguments
const email = process.argv[2];
addAdmin(email);
