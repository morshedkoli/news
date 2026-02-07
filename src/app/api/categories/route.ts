import { NextResponse } from "next/server";
import { CategoryService } from "@/lib/categories";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const isAdmin = searchParams.get("admin") === "true";

        let categories;
        if (isAdmin) {
            categories = await CategoryService.getAllCategories();
        } else {
            categories = await CategoryService.getActiveCategories();
        }

        return NextResponse.json({ categories });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
