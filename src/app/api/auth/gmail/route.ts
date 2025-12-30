
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Contains societeId
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL('/settings?error=oauth_denied', req.url));
    }

    // 1. INITIATE FLOW
    if (action === 'connect') {
        const societeId = searchParams.get('societeId');
        if (!societeId) return NextResponse.json({ error: 'Missing societeId' }, { status: 400 });
        if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.json({ error: 'Missing GOOGLE_CLIENT_ID' }, { status: 500 });

        // Define scopes: send email is critical
        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ].join(' ');

        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail`;

        const url = `${GOOGLE_AUTH_URL}?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${societeId}`;

        return NextResponse.redirect(url);
    }

    // 2. CALLBACK HANDLER
    if (code && state) {
        const societeId = state;
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail`;

        try {
            // Exchange code for tokens
            const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code'
                })
            });

            const tokens = await tokenResponse.json();

            if (!tokenResponse.ok) {
                console.error("Gmail Token Exchange Error:", tokens);
                throw new Error(tokens.error_description || 'Failed to exchange token');
            }

            if (!tokens.refresh_token) {
                // If no refresh token, permission might have been granted previously. 
                // We should ideally force prompt=consent (added above).
                console.warn("No refresh token received. User might have already authorized app.");
                // In dev, sometimes we lose it. But prompt=consent should force it.
            }

            // Get user info to save sender email
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const userData = await userRes.json();

            // Save to DB
            await prisma.societe.update({
                where: { id: societeId },
                data: {
                    emailProvider: 'GMAIL',
                    googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined, // Keep old if not provided? No, undefined updates nothing in prisma if we don't pass it? checking...
                    // Actually if keys are undefined in `data`, prisma ignores them? No, we need object construction.
                    ...(tokens.refresh_token ? { googleRefreshToken: encrypt(tokens.refresh_token) } : {}),
                    smtpFrom: userData.email // Auto se sender email
                }
            });

            return NextResponse.redirect(new URL('/settings?success=gmail_connected', req.url));

        } catch (e) {
            console.error(e);
            return NextResponse.redirect(new URL('/settings?error=oauth_failed', req.url));
        }
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
