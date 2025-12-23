
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAvatar() {
    try {
        // Get the first user or specific if known. 
        // Assuming 'usr_1' is the default or one of the first.
        // Or fetch all to be safe.
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                hasAvatar: true,
                avatarMime: true,
                avatarUrl: true
                // avatarBytes: true // Don't dump bytes
            }
        });

        console.log("--- DB USER DUMP ---");
        users.forEach(u => {
            console.log(`User: ${u.email} (${u.id})`);
            console.log(`  hasAvatar: ${u.hasAvatar}`);
            console.log(`  avatarMime: ${u.avatarMime}`);
            console.log(`  avatarUrl: ${u.avatarUrl}`);
        });
        console.log("--------------------");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkAvatar();
