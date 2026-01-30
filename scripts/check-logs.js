const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ Error: Missing FIREBASE_PRIVATE_KEY in .env.local');
    process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
    } catch (error) {
        console.error('❌ Error initializing Firebase Admin:', error);
        process.exit(1);
    }
}

const db = admin.firestore();

async function checkLogs() {
    console.log('🔍 Fetching recent RSS run logs...');
    try {
        const snapshot = await db.collection('rss_run_logs')
            .orderBy('started_at', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            console.log('No logs found.');
            return;
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            let time = 'Unknown';
            if (data.started_at) {
                if (typeof data.started_at.toDate === 'function') {
                    time = data.started_at.toDate().toLocaleString();
                } else {
                    time = new Date(data.started_at).toLocaleString();
                }
            }
            console.log(`\n[${time}] ID: ${doc.id}`);
            console.log('Raw Data:', JSON.stringify(data, null, 2));

            if (data.skip_reasons && data.skip_reasons.length > 0) {
                console.log('   ⚠️ Skip Reasons:');
                data.skip_reasons.forEach(r => console.log(`      - ${r}`));
            }

            if (data.error) {
                console.log(`   ❌ Error: ${data.error}`);
            }
        });

    } catch (error) {
        console.error('❌ Error fetching logs:', error);
    }
}

checkLogs();
