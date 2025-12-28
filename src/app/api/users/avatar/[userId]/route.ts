import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const { searchParams } = new URL(request.url);
        const sizeParam = searchParams.get('size');
        const size = sizeParam ? parseInt(sizeParam) : null;

        if (!userId) {
            return new NextResponse("User ID required", { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { avatarBytes: true, avatarMime: true }
        });

        if (!user || !user.avatarBytes || !user.avatarMime) {
            console.warn(`Avatar not found for user ${userId}`);
            return new NextResponse("Avatar not found", { status: 404 });
        }

        // Ensure we have a Buffer
        let imageBuffer = Buffer.from(user.avatarBytes);
        let mimeType = user.avatarMime;

        console.log(`[AvatarAPI] User ${userId} | Original Size: ${imageBuffer.length} | Mime: ${mimeType} | Requested Size: ${size}`);

        // Optimization with Sharp if size requested
        if (size || mimeType !== 'image/webp') {
            try {
                let pipeline = sharp(imageBuffer);

                if (size) {
                    pipeline = pipeline.resize(size, size, { fit: 'cover' });
                }

                const processedBuffer = await pipeline.webp({ quality: 80 }).toBuffer();
                imageBuffer = processedBuffer;
                mimeType = 'image/webp';
                console.log(`[AvatarAPI] Optimization Success | New Size: ${imageBuffer.length}`);
            } catch (e) {
                console.error("[AvatarAPI] Sharp optimization failed, serving original", e);
                // Fallback to original is already set in imageBuffer
            }
        }

        console.log(`[AvatarAPI] Returning response | Mime: ${mimeType} | Length: ${imageBuffer.length}`);

        // Return Image
        const headers = new Headers();
        headers.set('Content-Type', mimeType);
        // headers.set('Content-Length', imageBuffer.length.toString()); // Let Next handles chunking if needed
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new NextResponse(imageBuffer as any, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error("Avatar Fetch Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
