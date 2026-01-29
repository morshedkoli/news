import { NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
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
