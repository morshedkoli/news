import { NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { AppAdConfig } from "@/types/ads";

export const revalidate = 0; // Disable Vercel cache for real-time updates

const DEFAULT_CONFIG: AppAdConfig = {
    global_enabled: false,
    banner: { enabled: false, provider: 'none' },
    native: { enabled: false, provider: 'none' },
    interstitial: { enabled: false, provider: 'none' }
};

export async function GET() {
    try {
        const doc = await dbAdmin.collection("system_ads").doc("config").get();
        const data = (doc.data() as AppAdConfig) || DEFAULT_CONFIG;

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, max-age=0', // Ensure app always gets fresh config
            }
        });
    } catch (error) {
        console.error("Failed to fetch ad config:", error);
        return NextResponse.json(DEFAULT_CONFIG, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // Auth: Expect Bearer token (Firebase ID Token)
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = await authAdmin.verifyIdToken(token);

        const body = await req.json();

        // Basic validation
        const cfg = body as AppAdConfig;
        if (typeof cfg.global_enabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid config: global_enabled must be boolean' }, { status: 400 });
        }

        const positions: Array<keyof Pick<AppAdConfig, 'banner' | 'native' | 'interstitial'>> = ['banner', 'native', 'interstitial'];
        const validProviders = ['admob', 'custom', 'none'];

        for (const pos of positions) {
            const p = cfg[pos];
            if (!p || typeof p.enabled !== 'boolean') {
                return NextResponse.json({ error: `Invalid config: ${pos}.enabled must be boolean` }, { status: 400 });
            }
            if (p.enabled) {
                if (!validProviders.includes(p.provider)) {
                    return NextResponse.json({ error: `Invalid provider for ${pos}` }, { status: 400 });
                }

                if (p.provider === 'admob' && (!p.unit_id || typeof p.unit_id !== 'string')) {
                    return NextResponse.json({ error: `Missing ad unit id for ${pos}` }, { status: 400 });
                }
                if (p.provider === 'custom' && (!p.custom_image_url || typeof p.custom_image_url !== 'string')) {
                    return NextResponse.json({ error: `Missing custom_image_url for ${pos}` }, { status: 400 });
                }
            }
        }

        // Persist with audit fields and versioning
        const docRef = dbAdmin.collection('system_ads').doc('config');

        // Get current version for increment
        const currentDoc = await docRef.get();
        const currentVersion = (currentDoc.data()?.config_version as number) || 0;

        await docRef.set({
            ...cfg,
            last_updated: new Date().toISOString(),
            last_updated_by: { uid: decoded.uid, email: decoded.email || null },
            config_version: currentVersion + 1
        }, { merge: true });

        return NextResponse.json({ success: true, config: cfg });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Failed to update ad config:', error);
        return NextResponse.json({ error: message || 'Failed to update ad config' }, { status: 500 });
    }
}
