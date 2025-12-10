
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const history = await prisma.historyEntry.findMany({
        include: { user: true }
    });
    console.log('Total History Entries:', history.length);
    if (history.length > 0) {
        console.log('Latest Entry:', history[history.length - 1]);
    } else {
        console.log('No history entries found.');
    }

    const user = await prisma.user.findUnique({ where: { id: 'usr_1' } });
    console.log('User usr_1:', user);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
