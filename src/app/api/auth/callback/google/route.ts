import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock function to simulate getting user info from Google
// In production, this would exchange the 'code' for tokens and fetch user profile
async function getGoogleParams(request: Request) {
    const { searchParams } = new URL(request.url);
    const mockEmail = searchParams.get('mock_email');
    const mockName = searchParams.get('mock_name');
    const mockAvatar = searchParams.get('mock_avatar');

    // In a real app, we would fail if no code is present. 
    // Here we support a mock mode for validation as requested.
    if (mockEmail) {
        return {
            email: mockEmail,
            name: mockName || mockEmail.split('@')[0],
            picture: mockAvatar || null
        };
    }

    return null;
}

export async function GET(request: Request) {
    try {
        const googleUser = await getGoogleParams(request);

        if (!googleUser) {
            return NextResponse.json({ error: "No user info retrieved" }, { status: 400 });
        }

        const { email, name, picture } = googleUser;

        // 1. Search DB exclusively by email
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        let userId = "";

        if (existingUser) {
            // 2. Update existing user (safe updates only)
            // We update name if missing, or update avatar if allowed. 
            // The requirement says "update uniquement ce user". 
            // We do NOT change the ID.
            const updated = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    // Optional: Update name if provided and allowed? 
                    // User requirement: "update uniquement ce user (name, hasAvatar...)"
                    fullName: name || existingUser.fullName,
                    avatarUrl: picture || existingUser.avatarUrl,
                    hasAvatar: !!(picture || existingUser.hasAvatar)
                }
            });
            userId = updated.id;
        } else {
            // 3. Create new user
            const newUser = await prisma.user.create({
                data: {
                    email,
                    fullName: name,
                    avatarUrl: picture,
                    hasAvatar: !!picture,
                    password: "", // No password for OAuth users (or random garbage)
                    role: "user" // Default role
                }
            });
            userId = newUser.id;
        }

        // 4. Session Handling
        // Redirect to home with a token/id that the client handles.
        // We use a query param 'auth_callback_id' which the DataProvider or Layout will intercept.
        const redirectUrl = new URL('/', request.url);
        redirectUrl.searchParams.set('auth_callback_id', userId);

        return NextResponse.redirect(redirectUrl);

    } catch (error: any) {
        console.error("[GOOGLE_AUTH] Error:", error);
        return NextResponse.json({ error: "Server error during auth" }, { status: 500 });
    }
}
