import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    const cookieStore = await cookies();
    cookieStore.delete('session_userid'); // Standard delete

    // Also try setting it with maxAge 0 to be sure across browsers
    cookieStore.set('session_userid', '', { maxAge: 0, path: '/' });

    return NextResponse.json({ success: true });
}
