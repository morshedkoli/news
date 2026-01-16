import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";

export async function POST(req: Request) {
    try {
        const { title, summary, newsId } = await req.json();

        if (!title || !summary || !newsId) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const result = await sendNotification(title, summary, newsId);
        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Notification API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
