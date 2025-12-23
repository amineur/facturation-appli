import { NextResponse } from 'next/server';

/**
 * GOOGLE OAUTH CONFIGURATION
 * 
 * To enable the "Continue with Google" feature:
 * 1. Create a project in Google Cloud Console.
 * 2. Configure OAuth Consent Screen (External/Internal).
 * 3. Create OAuth 2.0 Client ID Credentials.
 * 4. Add the following environment variables to your .env file:
 * 
 *    GOOGLE_CLIENT_ID=your_client_id
 *    GOOGLE_CLIENT_SECRET=your_client_secret
 *    GOOGLE_REDIRECT_URI=http(s)://your-domain/api/auth/google/callback
 * 
 * AUTO-ACTIVATION:
 * The login button is automatically enabled/disabled via the `isGoogleAuthEnabled` 
 * server action, which checks for the presence of `GOOGLE_CLIENT_ID`.
 * If missing, the button appears disabled ("Bientôt disponible") and this route returns 404.
 */
export async function GET(request: Request) {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
        return NextResponse.json(
            { error: "Google Auth is not configured on this server." },
            { status: 404 }
        );
    }

    const scope = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', scope);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    return NextResponse.redirect(googleAuthUrl);
}
