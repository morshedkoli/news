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
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
