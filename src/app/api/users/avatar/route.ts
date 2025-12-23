
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const userId = formData.get('userId') as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 401 });
        }

        // Validate File Type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: "Invalid file type. Only images allowed." }, { status: 400 });
        }

        // Validate File Size (e.g. 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        console.log("[DEBUG SERVER] Received File:", file.name, "Size:", file.size, "Type:", file.type);

        // Update User in DB
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarBytes: buffer,
                avatarMime: file.type,
                hasAvatar: true
                // avatarUrl: null - Removed per instruction
            }
        });

        console.log("[DEBUG SERVER] DB Updated. User hasAvatar:", updatedUser.hasAvatar);

        return NextResponse.json({ success: true, hasAvatar: true });

    } catch (error: any) {
        console.error("Avatar Upload Error:", error);
        return NextResponse.json({ error: "Upload failed: " + error.message }, { status: 500 });
    }
}
