import { NextResponse } from 'next/server';
import { getAnalyticsData } from '@/lib/analytics';

export const dynamic = 'force-dynamic'; // Real-time data required

export async function GET() {
    try {
        const data = await getAnalyticsData();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Analytics Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
