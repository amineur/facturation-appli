
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const since = new Date('2025-12-09T23:00:00');

    const factures = await prisma.facture.findMany({
        where: { updatedAt: { gte: since } }
    });
    const devis = await prisma.devis.findMany({
        where: { updatedAt: { gte: since } }
    });

    console.log("=== FACTURES MODIFIÉES/CRÉÉES ===");
    factures.forEach(f => console.log(`- ${f.numero} (${f.statut}) - Updated: ${f.updatedAt}`));

    console.log("\n=== DEVIS MODIFIÉS/CRÉÉS ===");
    devis.forEach(d => console.log(`- ${d.numero} (${d.statut}) - Updated: ${d.updatedAt}`));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
