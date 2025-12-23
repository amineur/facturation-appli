import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json({ error: "No code provided" }, { status: 400 });
        }

        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
            return NextResponse.json({ error: "Configuration error" }, { status: 500 });
        }

        // 1. Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error("Google Token Error:", tokens);
            return NextResponse.json({ error: "Failed to exchange token" }, { status: 400 });
        }

        // 2. Get User Info
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const googleUser = await userRes.json();

        if (!googleUser.email) {
            return NextResponse.json({ error: "No email provided by Google" }, { status: 400 });
        }

        // 3. User Logic (Lookup by Email ONLY)
        const email = googleUser.email;
        const name = googleUser.name || googleUser.email.split('@')[0];
        const picture = googleUser.picture;

        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (user) {
            // UPDATE existing user (preserve ID)
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    fullName: name || user.fullName,
                    avatarUrl: picture // Allow updating avatar from Google
                    // hasAvatar: !!picture // Optional logic
                }
            });
        } else {
            // CREATE new user
            user = await prisma.user.create({
                data: {
                    email,
                    fullName: name,
                    avatarUrl: picture,
                    hasAvatar: !!picture,
                    password: "", // No password
                    role: "user"
                }
            });
        }

        // 4. Set Session Cookie (HttpOnly)
        const cookieStore = await cookies();
        cookieStore.set('session_userid', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        // 5. Redirect to Home
        return NextResponse.redirect(new URL('/', request.url));

    } catch (error: any) {
        console.error("Auth Callback Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
