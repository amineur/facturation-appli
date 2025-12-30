import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email requis" }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                societes: {
                    select: { id: true, nom: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
        }

        // Mark email as verified if not already
        if (!user.emailVerified) {
            await prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true }
            });

            // Delete verification tokens
            await prisma.emailVerificationToken.deleteMany({
                where: { userId: user.id }
            });

            console.log('[MANUAL_VERIFY] ✅ Email verified manually:', { email });
        }

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set('session_userid', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                currentSocieteId: user.currentSocieteId,
                societes: user.societes.map(s => ({
                    id: s.id,
                    nom: s.nom
                }))
            }
        });

    } catch (error: any) {
        console.error("[MANUAL_VERIFY_ERROR]", error);
        return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
    }
}
