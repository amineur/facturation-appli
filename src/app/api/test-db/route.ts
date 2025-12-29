import { prisma } from '@/lib/prisma';

export async function GET() {
    const tests: any[] = [];

    try {
        // Test 1: Connexion
        const startConnect = Date.now();
        await prisma.$connect();
        const connectTime = Date.now() - startConnect;
        tests.push({ test: 'connect', time: connectTime, unit: 'ms' });

        // Test 2: Query simple
        const startSimple = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const simpleTime = Date.now() - startSimple;
        tests.push({ test: 'simple query (SELECT 1)', time: simpleTime, unit: 'ms' });

        // Test 3: Count factures
        const startCount = Date.now();
        const count = await prisma.facture.count();
        const countTime = Date.now() - startCount;
        tests.push({ test: 'count factures', time: countTime, count, unit: 'ms' });

        // Test 4: FindMany avec limit
        const startFind = Date.now();
        const factures = await prisma.facture.findMany({
            take: 10,
            select: { id: true, numero: true }
        });
        const findTime = Date.now() - startFind;
        tests.push({ test: 'findMany(10)', time: findTime, count: factures.length, unit: 'ms' });

        // Test 5: FindMany avec include
        const startFindInclude = Date.now();
        const facturesWithClient = await prisma.facture.findMany({
            take: 10,
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });
        const findIncludeTime = Date.now() - startFindInclude;
        tests.push({ test: 'findMany(10) with include', time: findIncludeTime, count: facturesWithClient.length, unit: 'ms' });

        await prisma.$disconnect();

        return Response.json({
            success: true,
            tests,
            summary: {
                totalTests: tests.length,
                slowestTest: tests.reduce((max, t) => t.time > max.time ? t : max, tests[0])
            }
        });

    } catch (error: any) {
        return Response.json({
            success: false,
            error: error.message,
            tests
        }, { status: 500 });
    }
}
