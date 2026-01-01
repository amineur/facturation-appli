import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendEmail, getEmailVerificationTemplate } from '@/lib/email';

import { createTemplateSociete } from '@/lib/actions/template-societe';

export async function POST(request: Request) {
    try {
        const { email, password, fullName } = await request.json();

        // 1. Validation
        if (!email || !password || !fullName) {
            return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
        }

        // 2. Check for existing user
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create User with emailVerified = false
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
                role: 'user',
                emailVerified: false, // Not verified yet
            }
        });

        // 4b. Auto-create Template Society (Demo Mode)
        // This ensures the user has a society ready immediately.
        try {
            await createTemplateSociete(user.id);
        } catch (err) {
            console.error("[SIGNUP] Failed to create template society:", err);
            // Non-blocking error, user created successfully anyway
        }

        // 5. Generate verification token
        const token = generateToken(); // 64 char hex string
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            }
        });

        // 6. Send verification email
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
        const template = getEmailVerificationTemplate(verificationUrl);

        const emailResult = await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
            text: template.text,
        });

        // Log email result but don't fail signup if email fails
        if (!emailResult.success) {
            console.error('[SIGNUP] ⚠️ Email send failed but user created:', {
                email,
                error: emailResult.error
            });
        } else {
            console.log('[SIGNUP] ✅ Verification email sent:', {
                email,
                messageId: emailResult.messageId,
                previewUrl: emailResult.previewUrl
            });
        }

        // 7. Auto-login (Safe Mode) - Bypass verification enforcement
        const cookieStore = await cookies();
        cookieStore.set('session_userid', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return NextResponse.json({
            success: true,
            email: email,
            userId: user.id,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName
            },
            message: "Inscription réussie ! Connexion automatique...",
            emailSent: emailResult.success
        });

    } catch (error: any) {
        console.error("[SIGNUP_ERROR]", error);
        return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 });
    }
}
