import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Ensure public/uploads directory exists
        const publicDir = path.join(process.cwd(), "public", "uploads");
        try {
            await mkdir(publicDir, { recursive: true });
        } catch (e) {
            // ignore if exists
        }

        // Generate unique filename to prevent conflicts
        const filename = `avatar-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;
        const filePath = path.join(publicDir, filename);

        await writeFile(filePath, buffer);

        // Return the URL relative to public
        return NextResponse.json({
            success: true,
            avatarUrl: `/uploads/${filename}`
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
