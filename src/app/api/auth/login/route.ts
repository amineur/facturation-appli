import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email et mot de passe requis' },
                { status: 400 }
            );
        }

        // Find user by email
        // TIMING: Start
        const startQuery = Date.now();
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                societes: {
                    select: { id: true, nom: true }
                }
            }
        });
        console.log(`[PERF] Login Query: ${Date.now() - startQuery}ms`);
        // TIMING: End

        if (!user) {
            console.log('[AUTH_LOGIN] Account not found:', email);
            return NextResponse.json(
                { success: false, error: 'Compte introuvable' },
                { status: 401 }
            );
        }

        // Password verification (Bcrypt + Plain text fallback for legacy dev users)
        let passwordMatch = false;

        if (user.password) {
            // Check if it looks like a bcrypt hash
            if (user.password.startsWith('$2')) {
                passwordMatch = await bcrypt.compare(password, user.password);
            } else {
                // Fallback: Plain text comparison (Legacy/Dev)
                passwordMatch = user.password === password;
            }
        }

        console.log('[AUTH_LOGIN]', {
            email,
            ok: passwordMatch,
            userId: user.id
        });

        if (!passwordMatch) {
            return NextResponse.json(
                { success: false, error: 'Mot de passe incorrect' },
                { status: 401 }
            );
        }

        // TEMPORARY: Disable email verification check for testing
        // TODO: Re-enable after fixing signup redirect issue
        /*
        // Check if email is verified
        if (!user.emailVerified) {
            return NextResponse.json(
                { success: false, error: 'Email non vérifié. Vérifie ta boîte mail pour activer ton compte.' },
                { status: 403 }
            );
        }
        */

        // Set Cookie
        const cookieStore = await cookies(); // FIX: await cookies()
        cookieStore.set('session_userid', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7
        });

        // Success - return user info
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
        console.error('[AUTH API] Login error:', error);
        return NextResponse.json(
            {
                success: false,
                error: `Erreur serveur: ${error.message || 'Inconnue'}`,
                details: error.stack
            },
            { status: 500 }
        );
    }
}
