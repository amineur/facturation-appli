// DÉSACTIVÉ TEMPORAIREMENT - CONNECTION POOL ISSUE
// Ceci empêche le cron job de s'exécuter et de consommer des connexions DB
export async function GET() {
    return Response.json({
        disabled: true,
        message: "Cron disabled - use manual email sending instead"
    }, { status: 200 });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
