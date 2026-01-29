import { NextResponse } from "next/server";
import { CategoryService } from "@/lib/categories";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const isAdmin = searchParams.get("admin") === "true";

        let categories;
        if (isAdmin) {
            // Check auth if needed, but for now assuming the page consuming this is protected or we trust the internal flag for MVP
            // Ideally we check headers for admin token here too if public can guess this URL
            categories = await CategoryService.getAllCategories();
        } else {
            categories = await CategoryService.getActiveCategories();
        }

        return NextResponse.json({ categories });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
