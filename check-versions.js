
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 23h yesterday = 2025-12-09 23:00:00
    // Actually user refers to "since 23h". 
    const since = new Date('2025-12-09T23:00:00');

    const history = await prisma.historyEntry.findMany({
        where: {
            timestamp: {
                gte: since
            }
        },
        orderBy: {
            timestamp: 'desc'
        },
        include: { user: true }
    });

    console.log(`Found ${history.length} entries since ${since.toISOString()}`);
    history.forEach(h => {
        console.log(`[${h.timestamp.toISOString()}] ${h.action} - ${h.description} (User: ${h.user?.fullName || h.userId})`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
