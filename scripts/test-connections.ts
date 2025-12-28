
import { PrismaClient } from '@prisma/client';

async function testConnection(url: string, label: string) {
    console.log(`Testing ${label}...`);
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: url
            }
        }
    });

    try {
        await prisma.$connect();
        const res = await prisma.$queryRaw`SELECT 1`;
        console.log(`✅ ${label} Success!`, res);
        await prisma.$disconnect();
    } catch (error: any) {
        console.error(`❌ ${label} Failed:`, error.message);
    }
}

async function main() {
    // Read from process.env manually since we aren't using @prisma/client automated env loading here fully in this snippet context if we want to be explicit,
    // but PrismaClient usually picks up .env. 
    // However, to be sure, let's hardcode the values we just saw in cat .env to be 100% sure we are testing the EXACT strings.
    // Or just rely on standard env picking.

    // We will use the strings we saw in `cat .env`.
    const poolerUrl = "postgresql://postgres.txscfxxqonywvsovjbdg:11frJVLKK78%3F@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20";
    const directUrl = "postgresql://postgres.txscfxxqonywvsovjbdg:11frJVLKK78%3F@aws-1-eu-north-1.pooler.supabase.com:5432/postgres";

    await testConnection(poolerUrl, "Pooler (6543)");
    await testConnection(directUrl, "Direct (5432)");
}

main();
