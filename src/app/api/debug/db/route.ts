import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Read-only verification endpoint
        const [facturesCount, devisCount, societesCount, usersCount] = await Promise.all([
            prisma.facture.count(),
            prisma.devis.count(),
            prisma.societe.count(),
            prisma.user.count()
        ]);

        return NextResponse.json({
            dbUrl: process.env.DATABASE_URL,
            counts: {
                factures: facturesCount,
                devis: devisCount,
                societes: societesCount,
                users: usersCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            dbUrl: process.env.DATABASE_URL
        }, { status: 500 });
    }
}
