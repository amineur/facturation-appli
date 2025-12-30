import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const { token, newPassword } = await request.json();

        if (!token || !newPassword) {
            return NextResponse.json({ error: "Token et nouveau mot de passe requis" }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
        }

        // Rate limiting by IP (basic protection)
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000)) {
            return NextResponse.json({ error: "Trop de tentatives. Réessaye plus tard." }, { status: 429 });
        }

        // Hash the token
        const tokenHash = hashToken(token);

        // Find the token
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true }
        });

        if (!resetToken) {
            return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 400 });
        }

        // Check expiration
        if (new Date() > resetToken.expiresAt) {
            await prisma.passwordResetToken.delete({
                where: { id: resetToken.id }
            });
            return NextResponse.json({ error: "Token expiré" }, { status: 400 });
        }

        // Check if already used
        if (resetToken.usedAt) {
            return NextResponse.json({ error: "Token déjà utilisé" }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { id: resetToken.userId },
            data: { password: hashedPassword }
        });

        // Mark token as used
        await prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { usedAt: new Date() }
        });

        // Optional: Delete all other reset tokens for this user
        await prisma.passwordResetToken.deleteMany({
            where: {
                userId: resetToken.userId,
                id: { not: resetToken.id }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Mot de passe réinitialisé avec succès"
        });

    } catch (error: any) {
        console.error("[RESET_PASSWORD_ERROR]", error);
        return NextResponse.json({ error: "Erreur lors de la réinitialisation" }, { status: 500 });
    }
}
