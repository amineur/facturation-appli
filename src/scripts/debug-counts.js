const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Database Counts ---");
    const societes = await prisma.societe.count();
    const clients = await prisma.client.count();
    const factures = await prisma.facture.count();
    const devis = await prisma.devis.count();
    const produits = await prisma.produit.count();

    console.log(`Societes: ${societes}`);
    console.log(`Clients: ${clients}`);
    console.log(`Factures: ${factures}`);
    console.log(`Devis: ${devis}`);
    console.log(`Produits: ${produits}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
