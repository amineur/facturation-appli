const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching societies...");
    const societes = await prisma.societe.findMany();
    console.log("Societies found:", societes.length);
    societes.forEach(s => {
        console.log(`- [${s.id}] ${s.nom} (Pays: ${s.pays})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
