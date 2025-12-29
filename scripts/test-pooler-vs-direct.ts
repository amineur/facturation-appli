import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Force load local .env
dotenv.config();

async function testConnection(name: string, url: string | undefined) {
    if (!url) {
        console.error(`❌ [${name}] URL not found in .env`);
        return;
    }

    console.log(`\nTesting [${name}]...`);
    // Mask password for display
    console.log(`URL: ${url.replace(/:[^:]*@/, ':****@')}`);

    const client = new PrismaClient({
        datasourceUrl: url,
        log: ['error'], // Only errors
    });

    const start = Date.now();
    try {
        await client.$connect();
        const connectTime = Date.now() - start;
        console.log(`✅ [${name}] Connected in ${connectTime}ms`);

        const startQuery = Date.now();
        const count = await client.user.count();
        const queryTime = Date.now() - startQuery;

        console.log(`✅ [${name}] Query fetch successful (Count: ${count}) in ${queryTime}ms`);
        console.log(`🚀 [${name}] Total Latency: ${connectTime + queryTime}ms`);

    } catch (e: any) {
        console.error(`❌ [${name}] FAILED`);
        console.error(`ERROR TYPE: ${e.name}`);
        console.error(`ERROR MESSAGE: ${e.message}`);
        if (e.message.includes('quota')) {
            console.error(`🚨 PROOF: This endpoint enforces a Quota Limit.`);
        }
    } finally {
        await client.$disconnect();
    }
}

async function main() {
    console.log("🔍 DIAGNOSIS: POOLER (6543) vs DIRECT (5432)");
    console.log("------------------------------------------");

    // 1. Test Pooler (The one that was failing in Prod)
    const poolerUrl = process.env.DATABASE_URL;
    await testConnection('POOLER (Port 6543)', poolerUrl);

    // 2. Test Direct (The one currently working but slow)
    // We expect this one to work.
    let directUrl = process.env.POSTGRES_URL_NON_POOLING;
    // Fallback if not set, construct it from main url
    if (!directUrl && poolerUrl) {
        directUrl = poolerUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '');
    }
    await testConnection('DIRECT (Port 5432)', directUrl);
}

main();
