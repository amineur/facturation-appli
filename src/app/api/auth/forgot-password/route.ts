import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendEmail, getPasswordResetTemplate } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email requis" }, { status: 400 });
        }

        // Rate limiting by email
        const rateLimitKey = `forgot-password:${email}`;
        if (!checkRateLimit(rateLimitKey, 3, 15 * 60 * 1000)) { // 3 attempts per 15 min
            return NextResponse.json(
                { success: true, message: "Si un compte existe, tu recevras un email." },
                { status: 200 }
            );
        }

        // Always return same response (anti-enumeration)
        const response = {
            success: true,
            message: "Si un compte existe, tu recevras un email."
        };

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // Only send email if user exists AND email is verified
        if (user && user.emailVerified) {
            // Generate reset token
            const token = generateToken();
            const tokenHash = hashToken(token);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Delete any existing reset tokens for this user
            await prisma.passwordResetToken.deleteMany({
                where: { userId: user.id }
            });

            // Create new reset token
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                }
            });

            // Send reset email
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const resetUrl = `${baseUrl}/reset-password?token=${token}`;
            const template = getPasswordResetTemplate(resetUrl);

            await sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });
        }

        // Always return success (don't reveal if email exists)
        return NextResponse.json(response, { status: 200 });

    } catch (error: any) {
        console.error("[FORGOT_PASSWORD_ERROR]", error);
        return NextResponse.json(
            { success: true, message: "Si un compte existe, tu recevras un email." },
            { status: 200 }
        );
    }
}
