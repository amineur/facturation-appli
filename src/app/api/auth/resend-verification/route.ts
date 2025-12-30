import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendEmail, getEmailVerificationTemplate } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email requis" }, { status: 400 });
        }

        // Rate limiting: 1 resend per 60 seconds per email
        const rateLimitKey = `resend-verification:${email}`;
        if (!checkRateLimit(rateLimitKey, 1, 60 * 1000)) {
            return NextResponse.json(
                { error: "Attends 60 secondes avant de renvoyer l'email" },
                { status: 429 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Don't reveal if user exists (anti-enumeration)
            return NextResponse.json({
                success: true,
                message: "Si un compte existe, un email a été envoyé."
            });
        }

        // If already verified, no need to resend
        if (user.emailVerified) {
            return NextResponse.json({
                success: true,
                alreadyVerified: true,
                message: "Ton email est déjà vérifié ! Tu peux te connecter."
            });
        }

        // Delete old verification tokens
        await prisma.emailVerificationToken.deleteMany({
            where: { userId: user.id }
        });

        // Generate new token
        const token = generateToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            }
        });

        // Send verification email
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
        const template = getEmailVerificationTemplate(verificationUrl);

        const emailResult = await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
            text: template.text,
        });

        if (!emailResult.success) {
            console.error('[RESEND_VERIFICATION] Email send failed:', {
                email,
                error: emailResult.error
            });
            return NextResponse.json(
                { error: "Erreur lors de l'envoi de l'email. Réessaye plus tard." },
                { status: 500 }
            );
        }

        console.log('[RESEND_VERIFICATION] ✅ Email sent:', {
            email,
            messageId: emailResult.messageId
        });

        return NextResponse.json({
            success: true,
            message: "Email de vérification renvoyé !"
        });

    } catch (error: any) {
        console.error("[RESEND_VERIFICATION_ERROR]", error);
        return NextResponse.json(
            { error: "Erreur lors du renvoi de l'email" },
            { status: 500 }
        );
    }
}
