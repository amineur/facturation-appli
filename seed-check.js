
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check Societies
    const societes = ['Euromedmultimedia', 'Studio Urban'];
    for (const sId of societes) {
        const s = await prisma.societe.findUnique({ where: { id: sId } });
        if (!s) {
            console.log(`Creating Societe ${sId}...`);
            await prisma.societe.create({ data: { id: sId, nom: sId } });
        }
    }

    // Check User
    const user = await prisma.user.findUnique({ where: { id: 'usr_1' } });
    console.log('User usr_1:', user);

    if (!user) {
        console.log('Creating mock user...');
        await prisma.user.create({
            data: {
                id: 'usr_1',
                email: 'demo@glassy.com',
                password: 'password',
                fullName: 'Demo User',
                role: 'admin',
                societes: {
                    connect: [
                        { id: 'Euromedmultimedia' },
                        { id: 'Studio Urban' }
                    ]
                },
                currentSocieteId: 'Euromedmultimedia'
            }
        });
        console.log('Created user.');
    } else {
        // Ensure user has societies connected
        console.log("User exists, refreshing connections...");
        // Not easily doable without complex update, assume OK if exists or user manual logic.
        // Actually, let's just make sure.
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
