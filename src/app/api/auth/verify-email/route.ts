import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.redirect(new URL('/verify-email?error=invalid', request.url));
        }

        // Hash the token to compare with DB
        const tokenHash = hashToken(token);

        // Find the token
        const verificationToken = await prisma.emailVerificationToken.findUnique({
            where: { tokenHash },
            include: { user: true }
        });

        if (!verificationToken) {
            return NextResponse.redirect(new URL('/verify-email?error=invalid', request.url));
        }

        // Check expiration
        if (new Date() > verificationToken.expiresAt) {
            // Delete expired token
            await prisma.emailVerificationToken.delete({
                where: { id: verificationToken.id }
            });
            return NextResponse.redirect(new URL('/verify-email?error=expired', request.url));
        }

        // Verify the email
        await prisma.user.update({
            where: { id: verificationToken.userId },
            data: { emailVerified: true }
        });

        // Delete the used token
        await prisma.emailVerificationToken.delete({
            where: { id: verificationToken.id }
        });

        return NextResponse.redirect(new URL('/verify-email?success=true', request.url));

    } catch (error: any) {
        console.error("[VERIFY_EMAIL_ERROR]", error);
        return NextResponse.redirect(new URL('/verify-email?error=server', request.url));
    }
}
