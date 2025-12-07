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

        // Ensure public directory exists (it should in standard Next.js, but safe to check if we were creating subfolder)
        // We will save to public/reference.pdf
        const publicDir = path.join(process.cwd(), "public");
        try {
            await mkdir(publicDir, { recursive: true });
        } catch (e) {
            // ignore if exists
        }

        const filePath = path.join(publicDir, "reference.pdf");
        await writeFile(filePath, buffer);

        return NextResponse.json({ success: true, path: "/reference.pdf" });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
