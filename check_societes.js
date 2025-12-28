
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const societes = await prisma.societe.findMany();
    console.log(`Found ${societes.length} societes:`);
    societes.forEach(s => console.log(`- ${s.nom} (ID: ${s.id})`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
