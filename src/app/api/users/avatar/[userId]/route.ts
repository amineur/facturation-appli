
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> } // Next.js 15 requires awaiting params
) {
    try {
        const { userId } = await params;

        if (!userId) {
            return new NextResponse("User ID required", { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { avatarBytes: true, avatarMime: true }
        });

        if (!user || !user.avatarBytes || !user.avatarMime) {
            return new NextResponse("Avatar not found", { status: 404 });
        }

        // Return Image
        const headers = new Headers();
        headers.set('Content-Type', user.avatarMime);
        headers.set('Cache-Control', 'public, max-age=3600, must-revalidate'); // Cache for 1 hour

        return new NextResponse(user.avatarBytes as any, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error("Avatar Fetch Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
