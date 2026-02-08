import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const maxDuration = 60;
export const revalidate = 0;
export const runtime = 'nodejs';

// Webhook verification for cron-job.org
async function verifyWebhook(req: NextRequest): Promise<boolean> {
    const userAgent = req.headers.get('user-agent');
    if (userAgent?.includes('cron-job.org')) return true;
    
    // Check for custom header that cron-job.org sends (optional)
    const cronHeader = req.headers.get('x-cron-job-org');
    if (cronHeader) return true;
    
    // Allow query parameter verification
    const key = req.nextUrl.searchParams.get('key');
    const secret = process.env.CRON_SECRET;
    if (!secret) return true; // Dev mode
    return key === secret;
}

export async function POST(req: NextRequest) {
    if (!await verifyWebhook(req)) {
        return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { job, status, execution_time } = body;

        // Log webhook reception
        await dbAdmin.collection("webhook_logs").add({
            source: "cron-job.org",
            job_id: job?.id,
            job_name: job?.title,
            status,
            execution_time,
            received_at: FieldValue.serverTimestamp(),
            ip: req.headers.get('x-forwarded-for') || 'unknown'
        });

        // Respond immediately - actual cron work happens in the API routes
        return NextResponse.json({ 
            status: "webhook_received",
            message: "Cron job notification logged"
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Webhook error:", error);
        return NextResponse.json({ 
            error: message 
        }, { status: 500 });
    }
}

// Support GET for simple health check
export async function GET() {
    return NextResponse.json({ 
        status: "webhook_ready",
        endpoint: "/api/webhooks/cron-job"
    });
}
