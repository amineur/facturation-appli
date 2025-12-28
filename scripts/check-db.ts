
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("⏳ Connecting to DB...");
        await prisma.$connect();
        console.log("✅ Connected!");

        console.log("🔍 Checking Users...");
        const userCount = await prisma.user.count();
        console.log(`👤 Users found: ${userCount}`);

        console.log("🔍 Checking Connection Pool...");
        // Simple query to ensure pool is responsive
        const result = await prisma.$queryRaw`SELECT 1 as res`;
        console.log("✅ Query successful:", result);

    } catch (e) {
        console.error("❌ DB ERROR:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
