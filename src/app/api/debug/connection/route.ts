import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check Env Vars availability (partial)
        const hasDbUrl = !!process.env.DATABASE_URL;
        const hasDirectUrl = !!process.env.POSTGRES_URL_NON_POOLING;
        const nodeEnv = process.env.NODE_ENV;

        // 2. Test Connection
        const start = Date.now();
        await prisma.$connect();

        // 3. Test Simple Query
        const userCount = await prisma.user.count();
        const duration = Date.now() - start;

        return NextResponse.json({
            status: 'ok',
            message: 'Database connection successful',
            latency: `${duration}ms`,
            userCount,
            env: {
                hasDbUrl,
                hasDirectUrl,
                nodeEnv
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message,
            stack: error.stack, // Safe to expose temporarily for debugging this specific issue
            env: {
                hasDbUrl: !!process.env.DATABASE_URL,
                nodeEnv: process.env.NODE_ENV
            }
        }, { status: 500 });
    }
}
